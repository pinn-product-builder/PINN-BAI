"""Diagnóstico pos-deploy: confere prod + Supabase pra Arguto."""
import os, paramiko, json, urllib.request

# 1) VPS — confere build e Login.tsx
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['SSH_HOST'], username=os.environ['SSH_USER'],
          password=os.environ['SSH_PASS'], timeout=30,
          allow_agent=False, look_for_keys=False)

def run(cmd, label=None, timeout=60):
    if label: print(f"\n=== {label} ===")
    print(f"$ {cmd[:200]}")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    if out.strip(): print(out.strip()[:3000])
    if err.strip(): print(f"[stderr] {err.strip()[:500]}")

run("curl -s https://bai.pinnpb.com/ | grep -oE 'index-[a-zA-Z0-9_-]+\\.(js|css)' | head -3",
    "Bundle servido AGORA")
run("grep -A1 'else if.*profile.org_id' /root/pinn-bai/src/pages/Login.tsx | head -5",
    "Login.tsx redirect (deve mencionar arguto)")
run("grep -A2 'index element=' /root/pinn-bai/src/App.tsx | head -10",
    "App.tsx index redirect")
run("grep 'arguto' /root/pinn-bai/src/components/layouts/ClientLayout.tsx | head -3",
    "ClientLayout nav tem arguto?")
run("test -f /root/pinn-bai/src/data/arguto-demo.ts && wc -l /root/pinn-bai/src/data/arguto-demo.ts",
    "arguto-demo.ts presente?")
run("docker logs pinn-bai-web-1 --tail=5 2>&1 | tail -7", "Logs nginx recentes")
c.close()

# 2) Supabase via REST API — confere dados Arguto
print("\n\n========== SUPABASE ==========")
ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ3d6eHJ1dHptbXhteHpmaG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjc2ODUsImV4cCI6MjA4NTcwMzY4NX0.QlOjmLhKmpiOYr_qm-IDLoSjhE7Z18YKlmin5SFht90"
SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ3d6eHJ1dHptbXhteHpmaG13Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEyNzY4NSwiZXhwIjoyMDg1NzAzNjg1fQ.JNzWEvC_JzbDQvRCTjIp7ZdjDp87u9TGqMkxQelBHuc"
URL = "https://bkgwzxrutzmmxmxzfhmw.supabase.co/rest/v1"
ORG = "b72718e7-6a54-4ff8-9bbf-24d1573ddb43"

def q(table, params, role="service"):
    key = SERVICE if role == "service" else ANON
    url = f"{URL}/{table}?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode('utf-8')
    except Exception as e:
        return None, str(e)

print("\n--- organizations ---")
s, b = q("organizations", f"id=eq.{ORG}&select=id,name,slug,status")
print(f"status={s}, body={b[:500]}")

print("\n--- profiles ---")
s, b = q("profiles", f"org_id=eq.{ORG}&select=user_id,full_name,email,org_id")
print(f"status={s}, body={b[:500]}")

print("\n--- user_roles (do user arguto) ---")
s, b = q("user_roles", "user_id=eq.f5365bc0-8d77-465f-89e9-ca8aa55bed97&select=*")
print(f"status={s}, body={b[:500]}")

print("\n--- customer_rfm_scores (count) ---")
s, b = q("customer_rfm_scores", f"org_id=eq.{ORG}&select=count")
print(f"status={s}, body={b[:200]}")

print("\n--- customer_churn_scores (count) ---")
s, b = q("customer_churn_scores", f"org_id=eq.{ORG}&select=count")
print(f"status={s}, body={b[:200]}")

print("\n--- leads (count) ---")
s, b = q("leads", f"org_id=eq.{ORG}&select=count")
print(f"status={s}, body={b[:200]}")

print("\n--- dashboards (count) ---")
s, b = q("dashboards", f"org_id=eq.{ORG}&select=id,name,is_default")
print(f"status={s}, body={b[:500]}")
