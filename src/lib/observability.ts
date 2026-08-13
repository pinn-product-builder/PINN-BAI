/**
 * Observabilidade frontend — cliente Sentry mínimo, sem SDK.
 *
 * Envia eventos no formato de envelope Sentry v7 via fetch direto (sem
 * dependência de @sentry/*). Ativado apenas quando VITE_SENTRY_DSN está
 * definido; sem DSN, os erros ainda são logados no console.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */

const SENTRY_DSN: string = import.meta.env?.VITE_SENTRY_DSN ?? "";
const SENTRY_ENV: string = import.meta.env?.VITE_SENTRY_ENV ?? "development";
const ENABLED = !!SENTRY_DSN;

const breadcrumbs: unknown[] = [];
const MAX_BREADCRUMBS = 30;

interface DsnParts {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): DsnParts | null {
  try {
    const match = dsn.match(/^(https?):\/\/([^@]+)@([^/]+)\/(\d+)$/);
    return match
      ? { protocol: match[1], publicKey: match[2], host: match[3], projectId: match[4] }
      : null;
  } catch {
    return null;
  }
}

const DSN = ENABLED ? parseDsn(SENTRY_DSN) : null;

interface SentryStackFrame {
  function?: string;
  filename: string;
  lineno: number;
  colno: number;
}

interface SentryEvent {
  platform: string;
  environment: string;
  level: string;
  message: string;
  exception: {
    values: {
      type: string;
      value: string;
      stacktrace?: { frames: SentryStackFrame[] };
    }[];
  };
  user: undefined;
  extra?: Record<string, unknown>;
  breadcrumbs: { values: unknown[] };
  tags: Record<string, string>;
}

function buildEnvelope(event: SentryEvent): string {
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const sentAt = new Date().toISOString();
  const header = JSON.stringify({ event_id: eventId, sent_at: sentAt });
  const itemHeader = JSON.stringify({ type: "event" });
  const item = JSON.stringify({ ...event, event_id: eventId, timestamp: sentAt });
  return `${header}\n${itemHeader}\n${item}`;
}

async function sendToSentry(event: SentryEvent): Promise<void> {
  if (!DSN) return;
  const url = `${DSN.protocol}://${DSN.host}/api/${DSN.projectId}/envelope/`;
  const headers = {
    "Content-Type": "application/x-sentry-envelope",
    "X-Sentry-Auth": `Sentry sentry_version=7,sentry_key=${DSN.publicKey},sentry_client=pinn-bai/1.0`,
  };
  try {
    await fetch(url, { method: "POST", headers, body: buildEnvelope(event), keepalive: true });
  } catch (err) {
    console.warn("[observability] Sentry send falhou (ignorando):", err);
  }
}

function parseStackFrames(stack: string): SentryStackFrame[] {
  return stack
    .split("\n")
    .slice(1, 30)
    .map((line): SentryStackFrame | null => {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
      return match
        ? {
            function: match[1] || undefined,
            filename: match[2],
            lineno: Number(match[3]),
            colno: Number(match[4]),
          }
        : null;
    })
    .filter((frame): frame is SentryStackFrame => frame !== null);
}

/** Captura uma exceção: sempre loga no console; envia ao Sentry se houver DSN. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[observability] captureException", { message, stack, context });
  if (!ENABLED) return;
  sendToSentry({
    platform: "javascript",
    environment: SENTRY_ENV,
    level: "error",
    message,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : "Error",
          value: message,
          stacktrace: stack ? { frames: parseStackFrames(stack) } : undefined,
        },
      ],
    },
    user: undefined,
    extra: context,
    breadcrumbs: { values: breadcrumbs.slice(-MAX_BREADCRUMBS) },
    tags: { source: "frontend" },
  });
}

/**
 * Registra captura global de erros (window.error + unhandledrejection).
 * Chamado uma vez no bootstrap (src/main.tsx).
 */
export function initObservability(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    captureException(event.error ?? event.message, {
      source: "window.error",
      filename: event.filename,
      lineno: event.lineno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason, { source: "unhandledrejection" });
  });
  if (ENABLED) console.log("[observability] Sentry ativo —", SENTRY_ENV);
}
