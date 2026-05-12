"""Vê o erro completo do npm ci no build do docker."""
import os, paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['SSH_HOST'], username=os.environ['SSH_USER'],
          password=os.environ['SSH_PASS'], timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None, timeout=900):
    if label: print(f"\n=== {label} ===")
    print(f"$ {cmd[:200]}")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out.strip()[:6000])
    if err.strip(): print(f"[stderr] {err.strip()[:2000]}")
    print(f"exit={code}")

# Roda só o build, capturando tudo, com BuildKit progress=plain pra ver linhas completas
run("cd /root/pinn-bai && DOCKER_BUILDKIT=1 docker compose --env-file .env build --no-cache --progress=plain web 2>&1 | tail -100",
    "BUILD com progress=plain (linhas completas)", timeout=1500)

c.close()
