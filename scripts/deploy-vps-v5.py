"""
v5 — pull do fix Dockerfile e rebuild final.
"""
import os, paramiko

REPO = '/root/pinn-bai'

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
    if out.strip(): print(out.strip()[:5000])
    if err.strip(): print(f"[stderr] {err.strip()[:1500]}")
    print(f"exit={code}")
    return code

try:
    run(f"cd {REPO} && git fetch origin main 2>&1 | tail -5", "Fetch novo commit")
    run(f"cd {REPO} && git reset --hard origin/main && git log --oneline -3", "Reset to origin/main")
    run(f"grep 'npm install\\|npm ci' {REPO}/Dockerfile", "Conferir Dockerfile")

    run(f"cd {REPO} && docker compose --env-file .env build --no-cache --progress=plain web 2>&1 | tail -30",
        "BUILD WEB (esperado funcionar agora)", timeout=1800)
    run(f"cd {REPO} && docker compose --env-file .env up -d 2>&1 | tail -15", "Up")

    run("sleep 5; docker ps --filter name=pinn-bai --format 'table {{.Names}}\\t{{.Status}}'", "Containers")
    run("curl -sI https://bai.pinnpb.com/login | head -3", "/login")
    run("curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.(js|css)' | head -3",
        "Bundle hash (DEVE TER MUDADO)")
finally:
    c.close()
