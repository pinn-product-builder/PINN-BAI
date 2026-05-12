"""Investiga estrutura da VPS pra achar onde mora o deploy do PINN-BAI."""
import os
import sys
import paramiko

HOST = os.environ['SSH_HOST']
USER = os.environ['SSH_USER']
PASS = os.environ['SSH_PASS']

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None):
    if label: print(f"\n=== {label} ===")
    print(f"$ {cmd[:200]}")
    _, o, e = c.exec_command(cmd, timeout=120)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    if out.strip(): print(out.strip()[:3000])
    if err.strip(): print(f"[stderr] {err.strip()[:500]}")

run("docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}'", "Containers rodando")
run("docker images | grep -i bai 2>/dev/null", "Imagens com 'bai'")
run("docker images | grep -i pinn 2>/dev/null", "Imagens com 'pinn'")
run("find / -maxdepth 5 -type f -name 'docker-compose.yml' 2>/dev/null | head -10", "docker-compose.yml em qualquer lugar")
run("find / -maxdepth 5 -type d -name 'PINN-BAI' -o -name 'pinn-bai' 2>/dev/null | head -10", "Dirs PINN-BAI / pinn-bai")
run("ls -la /opt /root /var/www /home 2>/dev/null", "Layout /opt /root /var/www /home")
run("docker inspect pinn-bai-app 2>/dev/null | head -50 || docker inspect $(docker ps -q --filter name=bai) 2>/dev/null | head -30", "Inspect do container bai")

c.close()
