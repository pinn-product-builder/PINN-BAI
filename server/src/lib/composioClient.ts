import Composio from "@composio/client";

export function createComposioClient(apiKey: string) {
  return new Composio({ apiKey });
}

/**
 * User ID estável na Composio por organização (multi-tenant).
 * Para ficar **idêntico** ao outro sistema, use o mesmo padrão via env:
 * `COMPOSIO_USER_ID_TEMPLATE` — padrão `pinn-org-{orgId}`; use ex. `{orgId}` só,
 * ou `bf-org-{orgId}`, conforme o app que já está em produção na Composio.
 */
export function composioUserIdForOrganization(orgId: string) {
  const template = process.env.COMPOSIO_USER_ID_TEMPLATE?.trim() || "pinn-org-{orgId}";
  return template.replace(/\{orgId\}/g, orgId);
}

/** Igual ao CRM Auditor standalone: `COMPOSIO_USER_ID` fixo no .env força o mesmo user da conta conectada. */
export function resolveComposioUserId(orgId: string) {
  const fixed = process.env.COMPOSIO_USER_ID?.trim();
  if (fixed) return fixed;
  return composioUserIdForOrganization(orgId);
}

export function mapComposioConnectionStatus(
  s: "INITIALIZING" | "INITIATED" | "ACTIVE" | "FAILED" | "EXPIRED" | "INACTIVE",
): "pending" | "connected" | "error" | "disconnected" {
  switch (s) {
    case "ACTIVE":
      return "connected";
    case "INITIALIZING":
    case "INITIATED":
      return "pending";
    case "FAILED":
    case "EXPIRED":
      return "error";
    case "INACTIVE":
      return "disconnected";
    default:
      return "error";
  }
}
