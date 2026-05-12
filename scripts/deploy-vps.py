"""
Deploy do PINN-BAI na VPS via SSH (paramiko).
Pull do main, garante VITE_GOOGLE_MAPS_API_KEY no .env, rebuild via docker compose.

Uso:
  SSH_HOST=31.97.174.112 SSH_USER=root SSH_PASS='...' \
  MAPS_KEY=AIzaSy... python scripts/deploy-vps.py
"""

import os
import sys
import time
import paramiko

HOST = os.environ.get('SSH_HOST', '31.97.174.112')
USER = os.environ.get('SSH_USER', 'root')
PASS = os.environ.get('SSH_PASS')
PORT = int(os.environ.get('SSH_PORT', '22'))
MAPS_KEY = os.environ.get('MAPS_KEY', '')

# Caminhos prováveis do repo na VPS — testa em sequência
REPO_CANDIDATES = [
    '/root/PINN-BAI',
    '/root/pinn-bai',
    '/opt/PINN-BAI',
    '/opt/pinn-bai',
    '/home/pinn-bai',
    '/var/www/PINN-BAI',
]


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600, label: str | None = None) -> tuple[int, str, str]:
    """Roda comando e retorna (exit_code, stdout, stderr)."""
    if label:
        print(f"\n▸ {label}")
    print(f"  $ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip()[:2000])
    if err.strip():
        print(f"  [stderr] {err.strip()[:1000]}")
    print(f"  exit_code={code}")
    return code, out, err


def find_repo(client: paramiko.SSHClient) -> str | None:
    """Localiza onde o repo PINN-BAI está."""
    print("\n▸ Procurando repo na VPS...")
    for path in REPO_CANDIDATES:
        code, out, _ = run(client, f"test -d {path}/.git && echo FOUND || echo MISS")
        if 'FOUND' in out:
            print(f"  ✓ encontrado em {path}")
            return path
    # Fallback: find globalmente
    print("  · não achei nas localizações padrão, vou rodar `find` em /root e /opt...")
    code, out, _ = run(client, "find /root /opt /home /var/www -maxdepth 4 -type d -name '.git' 2>/dev/null | head -5")
    for line in out.strip().splitlines():
        if line.endswith('/.git'):
            repo = line[:-5]
            # confere se é mesmo PINN-BAI
            c2, o2, _ = run(client, f"cd {repo} && git remote -v 2>/dev/null | head -1")
            if 'PINN-BAI' in o2 or 'pinn-bai' in o2.lower():
                print(f"  ✓ encontrado em {repo}")
                return repo
    return None


def main() -> int:
    if not PASS:
        print("❌ SSH_PASS não definido.", file=sys.stderr)
        return 1

    print(f"▸ Conectando em {USER}@{HOST}:{PORT}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=HOST,
            port=PORT,
            username=USER,
            password=PASS,
            timeout=30,
            allow_agent=False,
            look_for_keys=False,
        )
    except Exception as e:
        print(f"❌ Falha SSH: {e}", file=sys.stderr)
        return 1
    print("  ✓ conectado")

    try:
        # 1) Localizar repo
        repo = find_repo(client)
        if not repo:
            print("❌ Não encontrei o repo PINN-BAI. Cancelando.", file=sys.stderr)
            return 1

        # 2) Estado atual
        run(client, f"cd {repo} && git rev-parse --abbrev-ref HEAD && git log --oneline -1", label="Estado atual da branch")

        # 3) Stash mudanças locais se houver, então pull
        run(client, f"cd {repo} && git status --short", label="Mudanças locais (antes do pull)")
        run(client, f"cd {repo} && git fetch origin main 2>&1 | tail -5", label="Fetch")
        code, _, _ = run(
            client,
            f"cd {repo} && git stash push -u -m 'auto-stash before deploy {int(time.time())}' 2>&1 | tail -3",
            label="Stash mudanças locais (se houver)",
        )
        code, out, err = run(client, f"cd {repo} && git pull origin main 2>&1 | tail -20", label="Pull")
        if code != 0 and 'Already up to date' not in out:
            print("⚠ pull não-zero, mas pode ter dado certo. Conferindo HEAD...")

        run(client, f"cd {repo} && git log --oneline -3", label="HEAD após pull")

        # 4) Garantir VITE_GOOGLE_MAPS_API_KEY no .env
        run(
            client,
            f"cd {repo} && (grep -q '^VITE_GOOGLE_MAPS_API_KEY=' .env 2>/dev/null && echo 'já existe') || echo 'precisa adicionar'",
            label="Checar VITE_GOOGLE_MAPS_API_KEY",
        )
        if MAPS_KEY:
            run(
                client,
                f"""cd {repo} && grep -q '^VITE_GOOGLE_MAPS_API_KEY=' .env 2>/dev/null || echo 'VITE_GOOGLE_MAPS_API_KEY={MAPS_KEY}' >> .env && grep '^VITE_GOOGLE_MAPS_API_KEY' .env""",
                label="Adicionar/confirmar Maps key no .env",
            )

        # 5) Rebuild Docker
        run(
            client,
            f"cd {repo} && docker compose --env-file .env up -d --build 2>&1 | tail -30",
            timeout=900,
            label="Docker compose up --build (~3-5min)",
        )

        # 6) Status dos containers
        run(client, f"cd {repo} && docker compose ps", label="Status dos containers")

        # 7) Tail dos logs web
        run(client, f"cd {repo} && docker compose logs --tail=20 web 2>&1 | tail -25", label="Logs web (últimas 20 linhas)")

        # 8) Confere o hash do bundle servido
        run(
            client,
            "curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.js' | head -1",
            label="Hash do bundle servido em bai.pinnpb.com",
        )

        print("\n✅ Deploy concluído.")
        return 0
    finally:
        client.close()


if __name__ == '__main__':
    sys.exit(main())
