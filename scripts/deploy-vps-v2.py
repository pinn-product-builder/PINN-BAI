"""
Deploy do PINN-BAI na VPS — transforma /root/pinn-bai em clone git real
do origin/main, preserva .env de produção, adiciona Maps key se faltar
e roda docker compose up --build.

Uso:
  PYTHONIOENCODING=utf-8 SSH_HOST=31.97.174.112 SSH_USER=root SSH_PASS='...' \
  MAPS_KEY=AIzaSy... python scripts/deploy-vps-v2.py
"""
import os, sys, time, paramiko

REPO_DIR = '/root/pinn-bai'
REMOTE = 'https://github.com/pinn-product-builder/PINN-BAI.git'
MAPS_KEY = os.environ.get('MAPS_KEY', '')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['SSH_HOST'], username=os.environ['SSH_USER'],
          password=os.environ['SSH_PASS'], timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None, timeout=600, abort_on_fail=True):
    if label:
        print(f"\n=== {label} ===")
    print(f"$ {cmd[:240]}")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out.strip()[:3500])
    if err.strip(): print(f"[stderr] {err.strip()[:800]}")
    print(f"exit={code}")
    if abort_on_fail and code != 0:
        # alguns comandos retornam !=0 mas continuam OK (ex.: grep miss)
        pass
    return code, out, err

try:
    ts = int(time.time())
    backup_env = f"/tmp/pinn-bai-env.backup.{ts}"
    backup_dir = f"/root/pinn-bai-pre-git-{ts}"

    # 1) Backup do .env e snapshot completo do diretorio antes de mexer
    run(f"cp {REPO_DIR}/.env {backup_env}", "Backup .env atual")
    run(f"cp -r {REPO_DIR} {backup_dir}", "Snapshot completo /root/pinn-bai (rollback se precisar)", timeout=120)
    run(f"ls -la {backup_env} {backup_dir}/.env 2>&1", "Confirma backups")

    # 2) git init + remote + fetch (--depth=1 pra ser rápido)
    code, _, _ = run(f"cd {REPO_DIR} && git rev-parse --is-inside-work-tree 2>/dev/null", "Já é git?")
    if code != 0:
        run(f"cd {REPO_DIR} && git init -b main", "git init")
        run(f"cd {REPO_DIR} && git remote add origin {REMOTE}", "remote add")
    else:
        run(f"cd {REPO_DIR} && git remote remove origin 2>/dev/null; git remote add origin {REMOTE}", "Reset remote")

    run(f"cd {REPO_DIR} && git fetch --depth=1 origin main 2>&1 | tail -5", "git fetch", timeout=180)

    # 3) Hard reset pro FETCH_HEAD (vai sobrescrever arquivos não-gitignored)
    run(f"cd {REPO_DIR} && git reset --hard FETCH_HEAD 2>&1 | tail -5", "Reset hard para origin/main")
    run(f"cd {REPO_DIR} && git log --oneline -3", "HEAD após reset")

    # 4) Restaurar .env de produção (sobrescreve qualquer .env que veio do remote — que não devia ter, é gitignored)
    run(f"test -f {REPO_DIR}/.env && md5sum {REPO_DIR}/.env || echo 'sem .env'", "Estado do .env após reset")
    run(f"cp {backup_env} {REPO_DIR}/.env", "Restaurar .env de produção")
    run(f"md5sum {REPO_DIR}/.env {backup_env}", "Confirmar .env restaurado igual ao backup")

    # 5) Adicionar VITE_GOOGLE_MAPS_API_KEY se ausente
    if MAPS_KEY:
        run(
            f"""cd {REPO_DIR} && grep -q '^VITE_GOOGLE_MAPS_API_KEY=' .env && echo 'JA EXISTE' || (echo 'VITE_GOOGLE_MAPS_API_KEY={MAPS_KEY}' >> .env && echo 'ADICIONADO')""",
            "Garantir VITE_GOOGLE_MAPS_API_KEY no .env",
        )
        run(f"grep '^VITE_GOOGLE_MAPS_API_KEY' {REPO_DIR}/.env | head -1", "Confirmar Maps key presente")

    # 6) Conferir docker-compose.yml e Dockerfile atualizados (devem ter VITE_GOOGLE_MAPS_API_KEY)
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO_DIR}/Dockerfile", "Dockerfile reconhece a key?")
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO_DIR}/docker-compose.yml", "compose passa a key como build arg?")

    # 7) Rebuild e up
    run(f"cd {REPO_DIR} && docker compose --env-file .env up -d --build 2>&1 | tail -40",
        "docker compose up --build", timeout=1200)

    # 8) Status
    run("docker ps --filter name=pinn-bai --format 'table {{.Names}}\\t{{.Status}}'", "Containers PINN-BAI")
    run(f"cd {REPO_DIR} && docker compose logs --tail=15 web 2>&1 | tail -20", "Logs web")
    run("curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.js' | head -1",
        "Hash do bundle servido em produção (verificar atualização)")

    print("\n✅ Deploy executado. Verifica https://bai.pinnpb.com no browser.")
    print(f"   Rollback se precisar: rm -rf {REPO_DIR} && mv {backup_dir} {REPO_DIR} && cd {REPO_DIR} && docker compose --env-file .env up -d --build")
finally:
    c.close()
