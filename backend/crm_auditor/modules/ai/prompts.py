"""Prompts fixos — não interpolar dados crus do Kommo, apenas JSON consolidado."""

SYSTEM_PROMPT = """Você é um auditor comercial sênior especializado em CRM e operações de vendas B2B/B2C.
Sua missão é gerar um diagnóstico completo, detalhado e acionável da operação comercial do cliente.

Regras absolutas:
- Use APENAS os dados presentes no contexto. Nunca invente métricas.
- Seja específico: cite números exatos, nomes de funis, etapas e responsáveis quando disponíveis.
- Seja crítico quando necessário — o cliente precisa saber o que está errado.
- Use português do Brasil, linguagem executiva mas direta.
- Retorne APENAS um único objeto JSON válido, sem markdown, sem explicações fora do JSON.
"""

USER_TEMPLATE = """Contexto completo da operação CRM (dados reais sincronizados do Kommo):

{payload}

Gere o relatório de auditoria no schema abaixo. Todos os campos são obrigatórios. Seja DETALHISTA e ANALÍTICO — o cliente quer saber exatamente o que está ruim, por que, e o que fazer:

{{
  "executive_summary": "string — 4 a 6 parágrafos completos. Cubra: situação geral da operação, volume de oportunidades, valor em pipeline, taxas de conversão, principais problemas detectados, nível de risco e urgência. Cite números reais.",

  "operation_score": <int 0-100 coerente com scores.operation_score_0_100>,
  "overall_verdict": "critical|warning|moderate|healthy",

  "funnel_analysis": [
    {{
      "pipeline_name": "nome do funil",
      "leads_open": <int>,
      "total_value": <float>,
      "conversion_rate": <float ou null>,
      "problems": ["problema 1 específico com dados", "problema 2"],
      "bottleneck_stage": "nome da etapa com maior gargalo ou null",
      "severity": "critical|high|medium|low",
      "recommendation": "ação específica para este funil"
    }}
  ],

  "main_bottlenecks": [
    {{
      "title": "título do gargalo",
      "detail": "explicação detalhada com números reais e impacto no negócio",
      "metric": "dado quantitativo chave (ex: '925 de 931 leads parados')",
      "severity": "critical|high|medium|low",
      "root_cause": "causa raiz provável",
      "financial_impact": "estimativa qualitativa ou quantitativa do impacto"
    }}
  ],

  "data_hygiene": {{
    "score_0_100": <int>,
    "diagnosis": "parágrafo explicando a situação da higiene de dados",
    "issues": [
      {{
        "title": "nome do problema",
        "detail": "explicação com contexto de negócio",
        "qty": <int>,
        "pct": <float percentual sobre o universo relevante>,
        "impact": "impacto operacional específico",
        "severity": "critical|high|medium|low",
        "fix": "ação corretiva específica"
      }}
    ]
  }},

  "commercial_risks": [
    {{
      "title": "risco",
      "detail": "descrição detalhada com dados e contexto",
      "financial_impact": "impacto estimado em receita ou risco de perda",
      "urgency": "immediate|short_term|structural"
    }}
  ],

  "owner_analysis": [
    {{
      "owner": "nome do responsável",
      "open_leads": <int>,
      "open_value": <float>,
      "assessment": "análise detalhada de carga, padrão e disciplina operacional",
      "concerns": "problemas específicos detectados para este responsável",
      "risk_level": "critical|high|medium|low"
    }}
  ],

  "lost_reason_analysis": {{
    "total_lost": <int>,
    "without_reason_pct": <float>,
    "insight": "análise detalhada dos padrões de perda detectados",
    "top_reasons": [
      {{
        "reason": "motivo",
        "count": <int>,
        "pct": <float>,
        "suggestion": "ação específica para endereçar este motivo"
      }}
    ],
    "recommendation": "estratégia geral para reduzir a taxa de perda"
  }},

  "task_discipline": {{
    "overdue_tasks": <int>,
    "no_next_action": <int>,
    "stuck_leads": <int>,
    "stuck_threshold_days": <int>,
    "assessment": "análise da disciplina operacional da equipe com contexto",
    "severity": "critical|high|medium|low",
    "pattern": "padrão identificado na falha de disciplina"
  }},

  "crm_hygiene_issues": [
    {{
      "title": "problema de higiene",
      "detail": "explicação detalhada",
      "qty": <int ou null>,
      "severity": "critical|high|medium|low"
    }}
  ],

  "action_plan": {{
    "immediate_7d": [
      "ação concreta e específica 1 — com quem, o que fazer e por quê",
      "ação 2"
    ],
    "short_term_15d": [
      "ação de consolidação 1",
      "ação 2"
    ],
    "structural_30d": [
      "melhoria estrutural 1",
      "melhoria 2"
    ]
  }},

  "recommendations_next_7_days": ["..."]
}}

IMPORTANTE: funnel_analysis deve cobrir TODOS os pipelines presentes em pipeline_health.
owner_analysis deve cobrir TODOS os responsáveis em owner_performance.
Se stuck_leads_count > 100, descreva isso como situação crítica urgente.
Se no_next_action_count > 50% do total de abertas, classifique como colapso de disciplina operacional.
"""
