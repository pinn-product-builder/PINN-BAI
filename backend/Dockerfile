# Backend Python (FastAPI) — CRM Auditor, Health, KPI, Email Outreach
# Multi-stage: builder pra resolver deps com cache, runtime slim.
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# cryptography (Fernet) requer compiladores; instalamos só no builder.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PYTHONPATH=/app

WORKDIR /app

# libffi: dependência de runtime da cryptography (mais leve que build-essential).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libffi8 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY adapters          ./adapters
COPY core              ./core
COPY crm_auditor       ./crm_auditor
COPY main.py           ./main.py
COPY mcp_server.py     ./mcp_server.py

# Usuário não-root.
RUN useradd --create-home --uid 1001 bai \
    && chown -R bai:bai /app
USER bai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
    CMD curl -fsS "http://127.0.0.1:8000/email/health" >/dev/null || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
