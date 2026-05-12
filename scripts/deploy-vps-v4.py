"""
v4 — site está 404, refazer com tudo certo agora que safe.directory tá ok.
"""
import os, time, paramiko

REPO = '/root/pinn-bai'
REMOTE = 'https://github.com/pinn-product-builder/PINN-BAI.git'
MAPS_KEY = os.environ.get('MAPS_KEY', '')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['SSH_HOST'], username=os.environ['SSH_USER'],
          password=os.environ['SSH_PASS'], timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None, timeout=600):
    if label: print(f"\n=== {label} ===")
    print(f"$ {cmd[:240]}")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out.strip()[:4000])
    if err.strip(): print(f"[stderr] {err.strip()[:1200]}")
    print(f"exit={code}")
    return code

try:
    # 1) Status agora — site está 404, web container subiu há pouco. Diagnóstico rápido.
    run("docker ps --filter name=pinn-bai --format 'table {{.Names}}\\t{{.Status}}\\t{{.CreatedAt}}'", "Containers AGORA")
    run("curl -sI https://bai.pinnpb.com/ | head -3", "/ status")
    run("docker logs pinn-bai-web-1 --tail=20 2>&1 | tail -25", "Logs do web (último deploy)")

    # 2) Adicionar remote e fetch (safe.directory já configurado na v3)
    run(f"cd {REPO} && git remote -v", "remotes ANTES")
    run(f"cd {REPO} && git remote remove origin 2>/dev/null; git remote add origin {REMOTE} && git remote -v", "Adicionar origin")
    run(f"cd {REPO} && git fetch --depth=1 origin main 2>&1 | tail -8", "git fetch", timeout=180)
    run(f"cd {REPO} && git log --oneline FETCH_HEAD -5 2>&1", "Commits fetched (deve mostrar nossos)")

    # 3) Backup .env de novo antes do reset
    ts = int(time.time())
    backup_env = f"/tmp/pinn-bai-env-pre-reset.{ts}"
    run(f"cp {REPO}/.env {backup_env} && wc -l {backup_env}", "Backup .env atual")

    # 4) Reset hard
    run(f"cd {REPO} && git reset --hard FETCH_HEAD 2>&1", "Reset hard FETCH_HEAD")
    run(f"cd {REPO} && git log --oneline -3", "HEAD após reset")
    run(f"cd {REPO} && git status --short | head -10", "Working tree after reset")

    # 5) Restaurar .env
    run(f"cp {backup_env} {REPO}/.env && head -5 {REPO}/.env | sed 's/=.*$/=***/'", "Restaurar .env (mascarado)")
    run(f"grep -c '^VITE_GOOGLE_MAPS_API_KEY' {REPO}/.env", "Maps key presente?")

    # 6) Confirma arquivos novos em disco
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO}/Dockerfile && echo 'OK DOCKERFILE'", "Dockerfile com Maps?")
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO}/docker-compose.yml && echo 'OK COMPOSE'", "compose com Maps?")
    run(f"ls {REPO}/src/components/arguto/", "Componentes Arguto no disco")
    run(f"ls {REPO}/src/data/", "src/data")
    run(f"grep -c arguto {REPO}/src/pages/Login.tsx", "Login → arguto?")

    # 7) BUILD --no-cache web
    run(f"cd {REPO} && docker compose --env-file .env build --no-cache web 2>&1 | tail -30",
        "BUILD WEB sem cache (este vai pegar Arguto)", timeout=1500)

    # 8) Up
    run(f"cd {REPO} && docker compose --env-file .env up -d 2>&1 | tail -15", "Up")

    # 9) Espera 5s e verifica
    run("sleep 5; docker ps --filter name=pinn-bai --format 'table {{.Names}}\\t{{.Status}}'", "Containers")
    run("curl -sI https://bai.pinnpb.com/ | head -3", "/ status DEPOIS")
    run("curl -sI https://bai.pinnpb.com/login | head -3", "/login status DEPOIS")
    run("curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.(js|css)' | head -3",
        "Bundle hashes (DEVE TER MUDADO)")

finally:
    c.close()
