"""
v3 — Conserta deploy: git safe.directory + reset hard de verdade +
--no-cache no docker build pra forçar rebuild com os arquivos novos.
"""
import os, paramiko

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
    if out.strip(): print(out.strip()[:3500])
    if err.strip(): print(f"[stderr] {err.strip()[:800]}")
    print(f"exit={code}")
    return code

try:
    # 1) Adiciona safe.directory
    run(f"git config --global --add safe.directory {REPO}", "Fix safe.directory ownership")
    run(f"git config --global --add safe.directory '*'", "Safe.directory wildcard (caso outros dirs também)")

    # 2) Confere o estado do git (já tem .git criado, mas vazio?)
    run(f"cd {REPO} && git status 2>&1 | head -10", "git status")
    run(f"cd {REPO} && git remote -v", "remotes")

    # 3) Fetch + reset hard
    run(f"cd {REPO} && git fetch --depth=1 origin main", "git fetch", timeout=180)
    run(f"cd {REPO} && git reset --hard FETCH_HEAD", "git reset --hard FETCH_HEAD")
    run(f"cd {REPO} && git log --oneline -3", "HEAD agora")

    # 4) Re-restaurar .env (o reset pode ter trazido um .env.example etc, mas .env é gitignored — checamos)
    run(f"test -f {REPO}/.env && wc -l {REPO}/.env || echo 'SEM .ENV'", ".env existe?")
    # Já fizemos backup na v2, vamos garantir que continua ok
    run(f"grep -c '^VITE_SUPABASE_URL\\|^SUPABASE_URL\\|^VITE_GOOGLE_MAPS_API_KEY' {REPO}/.env", "Vars críticas no .env")

    # 5) Confirma arquivos atualizados
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO}/Dockerfile", "Dockerfile com Maps key?")
    run(f"grep VITE_GOOGLE_MAPS_API_KEY {REPO}/docker-compose.yml", "compose com Maps key?")
    run(f"ls {REPO}/src/components/arguto/ 2>/dev/null", "Componentes Arguto presentes?")
    run(f"ls {REPO}/src/data/ 2>/dev/null", "src/data/ com arguto-demo?")
    run(f"head -5 {REPO}/src/pages/Login.tsx | grep -c arguto || echo 'sem arguto in login'", "Login redireciona pra arguto?")
    run(f"grep -c arguto {REPO}/src/pages/Login.tsx", "Login menciona arguto (count)")

    # 6) BUILD COM --no-cache pra forçar rebuild com os arquivos novos
    run(f"cd {REPO} && docker compose --env-file .env build --no-cache web 2>&1 | tail -50",
        "Build WEB sem cache (forçar rebuild com Arguto)", timeout=1500)

    # 7) Up
    run(f"cd {REPO} && docker compose --env-file .env up -d 2>&1 | tail -20",
        "Up (recria container web com imagem nova)", timeout=300)

    # 8) Confere bundle servido
    run("docker ps --filter name=pinn-bai --format 'table {{.Names}}\\t{{.Status}}\\t{{.CreatedAt}}'",
        "Containers (Status + Created)")
    run("curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.(js|css)' | head -3",
        "Hash do bundle servido em prod (deve mudar)")
    run("curl -sI https://bai.pinnpb.com/login | head -5", "HEAD /login")

finally:
    c.close()
