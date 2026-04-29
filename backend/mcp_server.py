"""
Pinn BAI — MCP Server

Expõe ferramentas do Pinn BAI como MCP tools para integração com
Claude Desktop, Claude API (tool use) e outros clientes MCP.

Inicie com:
    python mcp_server.py

Ou adicione ao claude_desktop_config.json:
    {
      "mcpServers": {
        "pinn-bai": {
          "command": "python",
          "args": ["/path/to/backend/mcp_server.py"],
          "env": { "SUPABASE_URL": "...", "SUPABASE_KEY": "..." }
        }
      }
    }
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv

load_dotenv()

# Importar supabase client
from core.db import get_db

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

# ── MCP Protocol implementation (stdio transport) ─────────────────────────────

TOOLS = [
    {
        "name": "get_customer_health",
        "description": (
            "Retorna o health score e alertas de um cliente específico ou lista os clientes "
            "em pior estado de saúde. Use para responder perguntas como 'quais clientes estão em risco?' "
            "ou 'como está a saúde do cliente X?'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string", "description": "ID da organização (tenant)"},
                "customer_key": {"type": "string", "description": "Chave do cliente (opcional). Se omitido, retorna top 10 em risco."},
                "band": {"type": "string", "enum": ["critico", "risco", "atencao", "saudavel"], "description": "Filtrar por banda de saúde (opcional)."},
            },
            "required": ["org_id"],
        },
    },
    {
        "name": "list_active_alerts",
        "description": (
            "Lista alertas proativos ativos para uma organização. "
            "Inclui clientes em risco de churn, sem atividade, com deals parados, etc."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string"},
                "severity": {"type": "string", "enum": ["critical", "warning", "info"], "description": "Filtrar por severidade (opcional)."},
                "limit": {"type": "integer", "default": 20},
            },
            "required": ["org_id"],
        },
    },
    {
        "name": "query_sales_pipeline",
        "description": (
            "Consulta o pipeline de vendas: leads por status, taxas de conversão, "
            "receita total, ticket médio. Responde 'como está o funil de vendas?' "
            "e 'qual a taxa de conversão do mês?'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string"},
                "date_start": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
                "date_end": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
            },
            "required": ["org_id"],
        },
    },
    {
        "name": "get_paid_traffic_summary",
        "description": (
            "Retorna resumo de performance de tráfego pago (Meta Ads, Google Ads): "
            "investimento total, ROAS, CPL, número de leads gerados por plataforma. "
            "Use para 'qual o ROAS das campanhas?' ou 'quanto custou cada lead no Meta?'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string"},
                "date_start": {"type": "string", "format": "date"},
                "date_end": {"type": "string", "format": "date"},
                "platform_slug": {"type": "string", "description": "Filtrar por plataforma (meta_ads | google_ads). Opcional."},
            },
            "required": ["org_id"],
        },
    },
    {
        "name": "get_rfm_summary",
        "description": (
            "Retorna segmentação RFM da base de clientes: quantos são Campeões, Leais, "
            "Em Risco, Hibernando, etc. Use para 'como está minha base segmentada?' "
            "ou 'quem são meus clientes campeões?'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string"},
                "segment": {"type": "string", "description": "Filtrar por segmento específico (opcional)."},
            },
            "required": ["org_id"],
        },
    },
    {
        "name": "search_customers",
        "description": (
            "Busca clientes por nome, email ou segmento RFM. "
            "Retorna health score, segmento RFM e status do pipeline."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "org_id": {"type": "string"},
                "query": {"type": "string", "description": "Nome ou email do cliente"},
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["org_id", "query"],
        },
    },
]


async def handle_tool(name: str, args: dict) -> Any:
    db = await get_db()

    if name == "get_customer_health":
        org_id = args["org_id"]
        customer_key = args.get("customer_key")
        band = args.get("band")

        q = db.table("customer_health_scores").select("*").eq("org_id", org_id)
        if customer_key:
            q = q.eq("customer_key", customer_key)
        if band:
            q = q.eq("health_band", band)
        q = q.order("health_score", desc=False).limit(10)
        res = await q.execute()

        rows = res.data or []
        if not rows:
            return {"message": "Nenhum dado de saúde encontrado.", "customers": []}

        return {
            "customers": [
                {
                    "name": r["customer_name"],
                    "health_score": r["health_score"],
                    "health_band": r["health_band"],
                    "trend": r["trend"],
                    "signals": r["signals"],
                    "engagement": r["engagement_score"],
                    "revenue": r["revenue_score"],
                    "momentum": r["momentum_score"],
                }
                for r in rows
            ]
        }

    elif name == "list_active_alerts":
        org_id = args["org_id"]
        severity = args.get("severity")
        limit = args.get("limit", 20)

        q = (
            db.table("customer_alerts")
            .select("*")
            .eq("org_id", org_id)
            .eq("resolved", False)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if severity:
            q = q.eq("severity", severity)
        res = await q.execute()

        alerts = res.data or []
        return {
            "total": len(alerts),
            "alerts": [
                {
                    "customer": a["customer_name"],
                    "type": a["alert_type"],
                    "severity": a["severity"],
                    "title": a["title"],
                    "description": a["description"],
                    "created_at": a["created_at"],
                }
                for a in alerts
            ],
        }

    elif name == "query_sales_pipeline":
        org_id = args["org_id"]
        now = datetime.now(tz=timezone.utc)
        date_start = args.get("date_start", (now - timedelta(days=30)).date().isoformat())
        date_end = args.get("date_end", now.date().isoformat())

        res = await (
            db.table("leads")
            .select("status, value")
            .eq("org_id", org_id)
            .gte("created_at", date_start)
            .lte("created_at", date_end + "T23:59:59Z")
            .execute()
        )

        leads = res.data or []
        total = len(leads)
        by_status: dict[str, int] = {}
        total_value = 0.0
        converted_value = 0.0
        converted_count = 0

        for lead in leads:
            s = lead.get("status", "new")
            by_status[s] = by_status.get(s, 0) + 1
            v = float(lead.get("value") or 0)
            total_value += v
            if s == "converted":
                converted_count += 1
                converted_value += v

        return {
            "period": {"start": date_start, "end": date_end},
            "total_leads": total,
            "by_status": by_status,
            "conversion_rate": round(converted_count / total * 100, 1) if total else 0,
            "total_value": round(total_value, 2),
            "converted_value": round(converted_value, 2),
            "average_ticket": round(converted_value / converted_count, 2) if converted_count else 0,
        }

    elif name == "get_paid_traffic_summary":
        org_id = args["org_id"]
        now = datetime.now(tz=timezone.utc)
        date_start = args.get("date_start", (now - timedelta(days=30)).date().isoformat())
        date_end = args.get("date_end", now.date().isoformat())
        platform_slug = args.get("platform_slug")

        q = (
            db.table("paid_traffic_daily_metrics")
            .select("platform_slug, spend, impressions, clicks, leads, purchases, purchase_value")
            .eq("org_id", org_id)
            .gte("date", date_start)
            .lte("date", date_end)
        )
        if platform_slug:
            q = q.eq("platform_slug", platform_slug)
        res = await q.execute()

        rows = res.data or []
        by_platform: dict[str, dict] = {}
        for r in rows:
            p = r["platform_slug"]
            if p not in by_platform:
                by_platform[p] = {"spend": 0, "impressions": 0, "clicks": 0, "leads": 0, "purchases": 0, "purchase_value": 0}
            by_platform[p]["spend"] += float(r.get("spend") or 0)
            by_platform[p]["impressions"] += int(r.get("impressions") or 0)
            by_platform[p]["clicks"] += int(r.get("clicks") or 0)
            by_platform[p]["leads"] += int(r.get("leads") or 0)
            by_platform[p]["purchases"] += int(r.get("purchases") or 0)
            by_platform[p]["purchase_value"] += float(r.get("purchase_value") or 0)

        summary = {}
        for p, m in by_platform.items():
            summary[p] = {
                **m,
                "ctr": round(m["clicks"] / m["impressions"] * 100, 2) if m["impressions"] else 0,
                "cpl": round(m["spend"] / m["leads"], 2) if m["leads"] else None,
                "roas": round(m["purchase_value"] / m["spend"], 2) if m["spend"] else None,
            }

        return {"period": {"start": date_start, "end": date_end}, "by_platform": summary}

    elif name == "get_rfm_summary":
        org_id = args["org_id"]
        segment_filter = args.get("segment")

        q = db.table("customer_rfm_scores").select("rfm_segment, customer_name, r_score, f_score, m_score, monetary").eq("org_id", org_id)
        if segment_filter:
            q = q.eq("rfm_segment", segment_filter)
        res = await q.execute()

        rows = res.data or []
        segments: dict[str, int] = {}
        for r in rows:
            seg = r.get("rfm_segment", "Desconhecido")
            segments[seg] = segments.get(seg, 0) + 1

        top_customers = sorted(rows, key=lambda x: float(x.get("monetary", 0)), reverse=True)[:5]
        return {
            "total_customers": len(rows),
            "by_segment": segments,
            "top_by_revenue": [
                {"name": r["customer_name"], "segment": r["rfm_segment"], "monetary": r["monetary"]}
                for r in top_customers
            ],
        }

    elif name == "search_customers":
        org_id = args["org_id"]
        query = args["query"]
        limit = args.get("limit", 10)

        res = await (
            db.table("leads")
            .select("id, name, email, status, value")
            .eq("org_id", org_id)
            .or_(f"name.ilike.%{query}%,email.ilike.%{query}%")
            .limit(limit)
            .execute()
        )
        customers = res.data or []

        # Enrich with health scores
        if customers:
            keys = [c["id"] for c in customers]
            health_res = await (
                db.table("customer_health_scores")
                .select("customer_key, health_score, health_band, rfm_segment")
                .eq("org_id", org_id)
                .in_("customer_key", keys)
                .execute()
            )
            health_by_key = {r["customer_key"]: r for r in (health_res.data or [])}

            for c in customers:
                h = health_by_key.get(c["id"], {})
                c["health_score"] = h.get("health_score")
                c["health_band"] = h.get("health_band")

        return {"customers": customers}

    return {"error": f"Tool '{name}' não encontrada"}


# ── stdio MCP transport ────────────────────────────────────────────────────────

async def main() -> None:
    logger.info("Pinn BAI MCP Server iniciado (stdio transport)")

    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        if not line:
            break

        try:
            request = json.loads(line.strip())
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        req_id = request.get("id")

        if method == "initialize":
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "pinn-bai", "version": "1.0.0"},
                },
            }
        elif method == "tools/list":
            response = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
        elif method == "tools/call":
            params = request.get("params", {})
            tool_name = params.get("name")
            tool_args = params.get("arguments", {})
            try:
                result = await handle_tool(tool_name, tool_args)
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}]
                    },
                }
            except Exception as exc:
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32000, "message": str(exc)},
                }
        elif method == "notifications/initialized":
            continue
        else:
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method '{method}' not found"},
            }

        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
