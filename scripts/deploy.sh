#!/usr/bin/env bash
# Deploy Pinn BAI -> VPS Pinn (host SSH alias: pinn-vps).
# Estrategia: tar streamado via SSH, swap atomico, rebuild containers.
#
# Uso:
#   ./scripts/deploy.sh             # deploy completo
#   ./scripts/deploy.sh --dry-run   # lista arquivos sem enviar
#   ./scripts/deploy.sh --no-build  # so transfere arquivos, nao roda docker build
#   ./scripts/deploy.sh --skip-git-check

set -euo pipefail

DRY_RUN=0
NO_BUILD=0
SKIP_GIT=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --no-build) NO_BUILD=1 ;;
        --skip-git-check) SKIP_GIT=1 ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="pinn-vps"
VPS_PATH="/root/pinn-bai"

step()  { echo; echo -e "\033[36m==> $1\033[0m"; }
ok()    { echo -e "    \033[32m[OK]\033[0m $1"; }
warn()  { echo -e "    \033[33m[WARN]\033[0m $1"; }
err()   { echo -e "    \033[31m[ERROR]\033[0m $1"; }

# Excludes — node_modules, dist, .env, .git, etc.
EXCLUDES=(
    --exclude=./node_modules --exclude=./dist
    --exclude=./.env --exclude=./.env.local
    --exclude=./.git --exclude=./.lovable
    --exclude=./.vscode --exclude=./.idea
    --exclude='*.log' --exclude='*.tar.gz'
    --exclude='*.pyc' --exclude=./__pycache__
    --exclude=./.DS_Store
    --exclude=./node_modules/.cache
)

# ─── 1. Validacoes locais ────────────────────────────────────────────────────
step "Validacoes locais"
cd "$PROJECT_ROOT"

[ -f Dockerfile ] || { err "Dockerfile nao encontrado"; exit 1; }
[ -d src ] || { err "src/ nao encontrada"; exit 1; }
[ -f package.json ] || { err "package.json nao encontrado"; exit 1; }
ok "Estrutura local valida"

if [ "$SKIP_GIT" -eq 0 ] && command -v git &>/dev/null; then
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        warn "Arvore git tem mudancas nao commitadas:"
        git status --short | head -10
        if [ "$DRY_RUN" -eq 0 ]; then
            read -rp "Continuar? [s/N] " resp
            [[ "$resp" =~ ^[sS]$ ]] || { echo "Cancelado"; exit 1; }
        fi
    else
        ok "Arvore git limpa"
    fi
fi

# ─── 2. SSH probe ────────────────────────────────────────────────────────────
step "Testando conexao SSH"
if ! ssh "$VPS_HOST" "echo CONNECTED && docker --version" >/dev/null 2>&1; then
    err "Falha SSH em $VPS_HOST"
    exit 1
fi
ok "SSH ok"

# ─── 3. tar -> ssh ───────────────────────────────────────────────────────────
step "Empacotando e enviando codigo"

if [ "$DRY_RUN" -eq 1 ]; then
    echo "    [dry-run] Top 30 arquivos que seriam enviados:"
    tar czf - "${EXCLUDES[@]}" -C "$PROJECT_ROOT" . 2>/dev/null | tar tzf - | head -30 | sed 's/^/      /'
    total=$(tar czf - "${EXCLUDES[@]}" -C "$PROJECT_ROOT" . 2>/dev/null | tar tzf - | wc -l)
    echo "    total: $total arquivos"
    step "DRY-RUN concluido — nenhuma escrita no VPS"
    exit 0
fi

ssh "$VPS_HOST" "rm -rf ${VPS_PATH}.new && mkdir -p ${VPS_PATH}.new"
tar czf - "${EXCLUDES[@]}" -C "$PROJECT_ROOT" . | \
    ssh "$VPS_HOST" "tar xzf - -C ${VPS_PATH}.new"
ok "Codigo enviado para ${VPS_PATH}.new"

# ─── 4. Preserva .env e node_modules existentes no destino ───────────────────
step "Preservando .env e node_modules existentes"
ssh "$VPS_HOST" "
    if [ -f ${VPS_PATH}/.env ]; then
        cp ${VPS_PATH}/.env ${VPS_PATH}.new/.env
        echo '    .env preservado'
    fi
    # node_modules nao copiamos via tar; se existe, mantem para acelerar build
    if [ -d ${VPS_PATH}/node_modules ]; then
        mv ${VPS_PATH}/node_modules ${VPS_PATH}.new/node_modules || true
        echo '    node_modules movido'
    fi
"

# ─── 5. Swap atomico ─────────────────────────────────────────────────────────
step "Swap atomico no VPS"
ssh "$VPS_HOST" "
    rm -rf ${VPS_PATH}.old
    if [ -d ${VPS_PATH} ]; then mv ${VPS_PATH} ${VPS_PATH}.old; fi
    mv ${VPS_PATH}.new ${VPS_PATH}
    rm -rf ${VPS_PATH}.old
"
ok "Swap concluido"

if [ "$NO_BUILD" -eq 1 ]; then
    step "--no-build: pulando docker build"
    exit 0
fi

# ─── 6. docker compose up --build ────────────────────────────────────────────
step "Rebuild + up dos containers BAI"
ssh "$VPS_HOST" "cd ${VPS_PATH} && docker compose up -d --build 2>&1 | tail -30"
ok "Rebuild concluido"

# ─── 7. Healthcheck ──────────────────────────────────────────────────────────
step "Aguardando healthcheck (ate 90s)"
TIMEOUT=90
START=$SECONDS
HEALTHY=0
while [ $((SECONDS - START)) -lt $TIMEOUT ]; do
    sleep 5
    STATUS_API=$(ssh "$VPS_HOST" "docker inspect pinn-bai-api-1 --format '{{.State.Health.Status}}' 2>/dev/null || echo none" | tr -d '\r\n ')
    STATUS_WEB=$(ssh "$VPS_HOST" "docker inspect pinn-bai-web-1 --format '{{.State.Status}}' 2>/dev/null || echo none" | tr -d '\r\n ')
    echo "    api=$STATUS_API web=$STATUS_WEB"
    if [ "$STATUS_API" = "healthy" ] && [ "$STATUS_WEB" = "running" ]; then
        HEALTHY=1
        break
    fi
done

[ "$HEALTHY" -eq 1 ] && ok "BAI ok (api=healthy, web=running)" || warn "Healthcheck nao confirmou em ${TIMEOUT}s"

# ─── 8. Logs ─────────────────────────────────────────────────────────────────
step "Ultimas linhas do log api"
ssh "$VPS_HOST" "docker logs pinn-bai-api-1 --tail 5 2>&1"

echo
echo -e "\033[32m==> Deploy BAI concluido\033[0m"
echo "    URL: https://bai.pinnpb.com"
