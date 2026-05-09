#!/usr/bin/env python3
"""
Deploy PINN-BAI na VPS (stack atual: server/ + Nginx + Traefik).

1. Lê backend/.env legado na VPS (antes do wipe).
2. Mescla com o .env local na raiz do repo (anon key, VITE_*, etc.).
3. Envia tarball do código + .env mesclado e executa docker compose.

PowerShell:
  cd ...\\PINN-BAI
  $env:MARI_VPS_PASSWORD = 'senha_root'
  $env:PYTHONIOENCODING = 'utf-8'
  python scripts/deploy_vps_paramiko.py

Requer rede Docker na VPS: docker network create root_default (já existe no Hostinger).

Dev local: criar a mesma rede uma vez: docker network create root_default
"""

from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Instale: pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
HOST = os.environ.get("PINN_DEPLOY_HOST", os.environ.get("MARI_DEPLOY_HOST", "31.97.174.112"))
REMOTE_DIR = os.environ.get("PINN_DEPLOY_DIR", "/root/pinn-bai")
PASSWORD = os.environ.get("PINN_VPS_PASSWORD") or os.environ.get("MARI_VPS_PASSWORD", "")
REMOTE_USER = os.environ.get("PINN_VPS_USER", "root")

# Pastas excluídas em qualquer nível do caminho
SKIP_ANYWHERE = frozenset(
    {
        "node_modules",
        "dist",
        ".git",
        "coverage",
        ".cursor",
        ".vscode",
        "agent-transcripts",
        "__pycache__",
    }
)
# Apenas na raiz do repo (não confundir com src/integrations/supabase)
SKIP_ROOT_ONLY = frozenset({"supabase", "docs"})


def parse_env(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        k, v = s.split("=", 1)
        key = k.strip()
        val = v.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def format_env(d: dict[str, str]) -> str:
    """Ordem estável: chaves 'importantes' primeiro."""
    priority = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "VITE_API_URL",
        "CORS_ORIGIN",
        "CORS_ORIGINS",
        "PUBLIC_APP_URL",
        "COMPOSIO_API_KEY",
        "COMPOSIO_KOMMO_AUTH_CONFIG_ID",
        "COMPOSIO_EXECUTE_BASE_URL",
        "WEB_HOST_PORT",
    ]
    seen: set[str] = set()
    lines: list[str] = []
    for k in priority:
        if k in d:
            lines.append(_line(k, d[k]))
            seen.add(k)
    for k in sorted(d.keys()):
        if k not in seen:
            lines.append(_line(k, d[k]))
    return "\n".join(lines) + "\n"


def _line(k: str, v: str) -> str:
    if any(c in v for c in ' "\n#'):
        esc = v.replace("\\", "\\\\").replace('"', '\\"')
        return f'{k}="{esc}"'
    return f"{k}={v}"


def fetch_remote_text(client: paramiko.SSHClient, path: str) -> str | None:
    try:
        sftp = client.open_sftp()
        try:
            with sftp.file(path, "r") as f:
                return f.read().decode("utf-8", errors="replace")
        finally:
            sftp.close()
    except OSError:
        return None


def should_pack(path: Path, rel: Path) -> bool:
    parts = rel.parts
    if any(p in SKIP_ANYWHERE for p in parts):
        return False
    if parts and parts[0] in SKIP_ROOT_ONLY:
        return False
    if path.is_dir():
        return False
    name = path.name
    if name.startswith(".env"):
        return False
    if len(rel.parts) == 1 and name.endswith(".md"):
        return False
    return True


def make_tarball(dest: Path) -> None:
    with tarfile.open(dest, "w:gz") as tar:
        for path in ROOT.rglob("*"):
            try:
                rel = path.relative_to(ROOT)
            except ValueError:
                continue
            if not should_pack(path, rel):
                continue
            tar.add(path, arcname=str(rel).replace("\\", "/"))


def merge_env_for_deploy(remote_backend: str | None, local_root: Path) -> dict[str, str]:
    merged: dict[str, str] = {}
    if remote_backend:
        merged.update(parse_env(remote_backend))
    sk = merged.pop("SUPABASE_SERVICE_KEY", None)
    if sk and "SUPABASE_SERVICE_ROLE_KEY" not in merged:
        merged["SUPABASE_SERVICE_ROLE_KEY"] = sk

    local_path = local_root / ".env"
    if local_path.is_file():
        merged.update(parse_env(local_path.read_text(encoding="utf-8", errors="replace")))

    supabase_url = merged.get("SUPABASE_URL", "").strip()
    if supabase_url:
        merged.setdefault("VITE_SUPABASE_URL", supabase_url)

    anon = merged.get("SUPABASE_ANON_KEY", "").strip()
    if anon:
        merged.setdefault("VITE_SUPABASE_PUBLISHABLE_KEY", anon)

    merged.setdefault(
        "PUBLIC_APP_URL",
        merged.get("PUBLIC_APP_URL", "") or "https://bai.pinnpb.com",
    )

    merged["CORS_ORIGIN"] = (
        "https://bai.pinnpb.com,https://bai.srv879715.hstgr.cloud"
    )

    merged.setdefault("WEB_HOST_PORT", "127.0.0.1:18080")

    return merged


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if not PASSWORD:
        print(
            "Defina PINN_VPS_PASSWORD ou MARI_VPS_PASSWORD.",
            file=sys.stderr,
        )
        sys.exit(1)

    os.chdir(ROOT)

    remote_tgz = "/tmp/pinn-bai-deploy.tgz"
    remote_env = "/tmp/pinn-bai-deploy.env"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=REMOTE_USER,
        password=PASSWORD,
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        legacy = fetch_remote_text(client, f"{REMOTE_DIR}/backend/.env")
        merged = merge_env_for_deploy(legacy, ROOT)

        if not merged.get("SUPABASE_ANON_KEY", "").strip():
            print(
                "ERRO: falta SUPABASE_ANON_KEY. "
                "Coloque no arquivo .env na raiz do PINN-BAI (local) e rode de novo.",
                file=sys.stderr,
            )
            sys.exit(1)

        print("==> Empacotando codigo (sem node_modules / .env)")
        with tempfile.TemporaryDirectory(prefix="pinn_bai_deploy_") as td:
            src_tgz = Path(td) / "pinn-bai.tgz"
            env_path = Path(td) / "merged.env"
            env_path.write_text(format_env(merged), encoding="utf-8")

            make_tarball(src_tgz)
            print("    tarball_kb:", src_tgz.stat().st_size // 1024)

            sftp = client.open_sftp()
            sftp.put(str(src_tgz), remote_tgz)
            sftp.put(str(env_path), remote_env)
            sftp.close()

        remote_script = """set -eu
REMOTE_DIR="{remote_dir}"
REMOTE_TGZ="{remote_tgz}"
REMOTE_ENV="{remote_env}"
mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"
docker compose down --remove-orphans 2>/dev/null || true
find . -mindepth 1 -maxdepth 1 -exec rm -rf {{}} +
tar xzf "$REMOTE_TGZ"
rm -f "$REMOTE_TGZ"
mv "$REMOTE_ENV" .env
docker compose --env-file .env up -d --build
docker compose ps
""".format(
            remote_dir=REMOTE_DIR,
            remote_tgz=remote_tgz,
            remote_env=remote_env,
        )

        print("==> Remoto: wipe + extract + docker compose (build pode demorar)")
        stdin, stdout, stderr = client.exec_command(remote_script, timeout=1800)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out:
            print(out)
        if err:
            print(err, file=sys.stderr)
        if code != 0:
            sys.exit(code)
    finally:
        client.close()

    print("==> OK:", HOST, "- PINN-BAI em", REMOTE_DIR)


if __name__ == "__main__":
    main()
