/**
 * Espelho TS do `email_outreach/templating.py::render_email_body` do backend.
 * Recebe um `body_template` cru (texto puro ou HTML) + dados de assinatura da
 * inbox e devolve o HTML final que o destinatário enxerga (sem pixel/unsub
 * footer, que são injetados depois pelo `tracking.inject_tracking` em tempo
 * de envio).
 *
 * Usado pela UI do wizard de cadência pra mostrar prévia ao vivo.
 *
 * IMPORTANTE: se a lógica do backend mudar, atualize este arquivo também
 * (não há reuso direto porque o backend é Python). O cuidado já valeu a
 * pena — ter prévia 1:1 evita "ficou diferente do que apareceu na caixa".
 */

import type { Inbox } from "../types";

const PARAGRAPH_STYLE =
  "margin:0 0 14px 0;line-height:1.55;color:#1f2937;" +
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI'," +
  "Roboto,Helvetica,Arial,sans-serif;font-size:15px";

const CONTAINER_OPEN =
  '<div style="max-width:560px;color:#1f2937;' +
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI'," +
  'Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55">';
const CONTAINER_CLOSE = "</div>";

// Tags consideradas "estruturais" — se o body cru já contém alguma delas,
// assumimos HTML deliberado e não inferimos parágrafos.
const STRUCTURAL_RE = /<\s*(p|div|br|ul|ol|li|h[1-6]|blockquote|table)\b/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function normalizeParagraphs(raw: string): string {
  if (!raw) return "";

  if (STRUCTURAL_RE.test(raw)) {
    // Re-aplica style em <p> que não tenham style explícito (defensivo).
    return raw.replace(/<\s*p\b[^>]*>/gi, (tag) => {
      if (/style=/i.test(tag)) return tag;
      return tag.slice(0, -1) + ` style="${PARAGRAPH_STYLE}">`;
    });
  }

  // Texto puro → splita por blank lines (parágrafos), \n vira <br>.
  const blocks = raw
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks
    .map((block) => {
      const safe = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p style="${PARAGRAPH_STYLE}">${safe}</p>`;
    })
    .join("");
}

export function renderSignature(inbox: Pick<
  Inbox,
  | "signature_name"
  | "signature_role"
  | "signature_company"
  | "signature_phone"
  | "signature_link"
  | "signature_html"
> | null | undefined): string {
  if (!inbox) return "";

  const rawHtml = (inbox.signature_html ?? "").trim();
  if (rawHtml) {
    return (
      '<div style="margin-top:24px;padding-top:14px;' +
      'border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;' +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI'," +
      'Roboto,Helvetica,Arial,sans-serif;line-height:1.5">' +
      rawHtml +
      "</div>"
    );
  }

  const name = (inbox.signature_name ?? "").trim();
  const role = (inbox.signature_role ?? "").trim();
  const company = (inbox.signature_company ?? "").trim();
  const phone = (inbox.signature_phone ?? "").trim();
  const link = (inbox.signature_link ?? "").trim();

  if (!name && !role && !company && !phone && !link) return "";

  const lines: string[] = [];
  if (name) {
    lines.push(
      `<div style="font-weight:600;color:#1f2937">${escapeHtml(name)}</div>`,
    );
  }
  const roleCompany = [role, company].filter(Boolean).join(" · ");
  if (roleCompany) {
    lines.push(
      `<div style="color:#4b5563">${escapeHtml(roleCompany)}</div>`,
    );
  }
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, "");
    const phoneHtml = digits
      ? `<a href="tel:${digits}" style="color:#4b5563;text-decoration:none">${escapeHtml(phone)}</a>`
      : escapeHtml(phone);
    lines.push(`<div style="color:#4b5563">${phoneHtml}</div>`);
  }
  if (link) {
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    lines.push(
      `<div style="color:#4b5563"><a href="${escapeAttr(href)}" style="color:#4b5563;text-decoration:underline">${escapeHtml(link)}</a></div>`,
    );
  }

  return (
    '<div style="margin-top:24px;padding-top:14px;' +
    'border-top:1px solid #e5e7eb;font-size:14px;' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI'," +
    'Roboto,Helvetica,Arial,sans-serif;line-height:1.5">' +
    lines.join("") +
    "</div>"
  );
}

export interface PreviewLeadVars {
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  email?: string;
  [key: string]: string | undefined;
}

const DEFAULT_LEAD_VARS: PreviewLeadVars = {
  first_name: "Maria",
  last_name: "Silva",
  company: "Empresa Exemplo",
  title: "Diretora Comercial",
  email: "maria@empresaexemplo.com",
};

/** Substitui {{var}} e {{custom.x}} (custom.x não tem default — vira ""). */
export function renderTemplate(
  template: string,
  vars: PreviewLeadVars = DEFAULT_LEAD_VARS,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, name: string) => {
    const key = name.trim();
    if (key.startsWith("custom.")) {
      const cf = key.slice("custom.".length);
      return vars[cf] ?? "";
    }
    return vars[key] ?? "";
  });
}

/**
 * Renderiza o HTML final do email (sem pixel/unsub footer).
 * Usar pra prévia no UI.
 */
export function previewEmailHtml(
  bodyTemplate: string,
  opts: {
    inbox?: Inbox | null;
    leadVars?: PreviewLeadVars;
  } = {},
): string {
  const rendered = renderTemplate(bodyTemplate, opts.leadVars ?? DEFAULT_LEAD_VARS);
  const body = normalizeParagraphs(rendered);
  const signature = renderSignature(opts.inbox ?? null);
  return `${CONTAINER_OPEN}${body}${signature}${CONTAINER_CLOSE}`;
}

export function previewSubject(
  template: string,
  vars: PreviewLeadVars = DEFAULT_LEAD_VARS,
): string {
  return renderTemplate(template, vars);
}

export { DEFAULT_LEAD_VARS };
