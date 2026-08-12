#!/usr/bin/env python3
"""Aplica migrations e roda queries no Postgres do Supabase SEM vazar credencial.

Lê SUPABASE_DB_URL de .env.local (gitignored). Nunca imprime a connection string.

Uso:
  python3 scripts/dbx.py apply supabase/migrations/<arquivo>.sql
  python3 scripts/dbx.py query "select count(*) from public.crm_stages"
  python3 scripts/dbx.py query -            # lê SQL do stdin
"""
import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
ENV_LOCAL = ROOT / ".env.local"


def load_db_url() -> str:
    if not ENV_LOCAL.exists():
        sys.exit(f"ERRO: {ENV_LOCAL.name} não existe. Coloque SUPABASE_DB_URL=postgresql://... nele.")
    url = None
    for raw in ENV_LOCAL.read_text().splitlines():
        line = raw.strip()
        if line.startswith("SUPABASE_DB_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
    if not url:
        sys.exit("ERRO: SUPABASE_DB_URL não encontrada em .env.local")
    return url


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, arg = sys.argv[1], sys.argv[2]
    url = load_db_url()

    if cmd == "apply":
        sql = Path(arg).read_text()
        with psycopg.connect(url, autocommit=False) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print(f"OK: migration aplicada — {Path(arg).name}")

    elif cmd == "query":
        sql = sys.stdin.read() if arg == "-" else arg
        with psycopg.connect(url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                if cur.description:
                    cols = [d.name for d in cur.description]
                    print(" | ".join(cols))
                    print("-" * 60)
                    for row in cur.fetchall():
                        print(" | ".join("" if v is None else str(v) for v in row))
                else:
                    print(f"OK: {cur.rowcount} linha(s) afetada(s)")
    else:
        sys.exit(f"comando desconhecido: {cmd}")


if __name__ == "__main__":
    main()
