"""Inspeciona /root/pinn-bai na VPS pra entender o modelo de deploy."""
import os, paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['SSH_HOST'], username=os.environ['SSH_USER'],
          password=os.environ['SSH_PASS'], timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None):
    if label: print(f"\n=== {label} ===")
    print(f"$ {cmd[:200]}")
    _, o, e = c.exec_command(cmd, timeout=120)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    if out.strip(): print(out.strip()[:3500])
    if err.strip(): print(f"[stderr] {err.strip()[:500]}")

run("ls -la /root/pinn-bai/", "Conteudo /root/pinn-bai")
run("ls -la /root/pinn-bai/.git 2>/dev/null || echo 'no .git'", ".git existe?")
run("cat /root/pinn-bai/docker-compose.yml | head -60", "docker-compose.yml lá")
run("cat /root/pinn-bai/.env 2>/dev/null | grep -v ANON_KEY | head -20 || echo 'no .env'", ".env (sem keys)")
run("ls /root/pinn-bai/src 2>/dev/null | head -5 || echo 'no src/'", "src existe?")
run("ls /root/pinn-bai/server 2>/dev/null | head -5 || echo 'no server/'", "server existe?")
run("test -d /root/pinn-bai/.git && cd /root/pinn-bai && git log --oneline -3 && git remote -v", "Se for git, mostra HEAD e remote")
run("docker inspect pinn-bai-web-1 --format '{{.Config.Image}} | {{json .HostConfig.Binds}} | {{.Created}}' 2>&1", "pinn-bai-web-1 inspect")

c.close()
