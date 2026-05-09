/**
 * Kommo via Composio — execução HTTP igual ao standalone Python (`kommo_composio.py`):
 * POST {base}/tools/execute/{KOMMO_TOOL_SLUG}
 * body: { connected_account_id, user_id, arguments }
 * header: x-api-key
 */

export class KommoComposioExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KommoComposioExecutionError";
  }
}

const LIST_PIPELINES = "KOMMO_LIST_LEADS_PIPELINES";
const LIST_LEADS = "KOMMO_LIST_LEADS";
const LIST_CONTACTS = "KOMMO_LIST_CONTACTS";
const LIST_TASKS = "KOMMO_LIST_TASKS";

function parseInnerData(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function extractEmbedded(
  data: unknown,
  ...keys: string[]
): Record<string, unknown>[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x));
  }
  if (typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const emb = d._embedded;
  if (emb && typeof emb === "object" && !Array.isArray(emb)) {
    const e = emb as Record<string, unknown>;
    for (const k of keys) {
      const items = e[k];
      if (Array.isArray(items)) {
        return items.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
      }
    }
  }
  for (const k of keys) {
    const items = d[k];
    if (Array.isArray(items)) {
      return items.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
    }
  }
  return [];
}

export async function composioExecuteTool(
  apiKey: string,
  baseUrl: string,
  connectedAccountId: string,
  userId: string,
  slug: string,
  arguments_: Record<string, unknown>,
): Promise<unknown> {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/tools/execute/${slug}`;
  const body = {
    connected_account_id: connectedAccountId,
    user_id: userId,
    arguments: arguments_,
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = (await resp.json()) as Record<string, unknown>;
  } catch {
    throw new KommoComposioExecutionError(`Resposta Composio inválida (HTTP ${resp.status})`);
  }
  if (!resp.ok) {
    throw new KommoComposioExecutionError(`Composio HTTP ${resp.status}: ${JSON.stringify(payload).slice(0, 2000)}`);
  }
  const errObj = payload.error;
  if (errObj) {
    const msg =
      typeof errObj === "object" && errObj !== null && "message" in errObj
        ? String((errObj as { message?: unknown }).message)
        : String(errObj);
    throw new KommoComposioExecutionError(msg.slice(0, 2000));
  }
  if (payload.successful === false) {
    throw new KommoComposioExecutionError(String(payload.message || JSON.stringify(payload)).slice(0, 2000));
  }
  return parseInnerData(payload.data);
}

function chunkItems(data: unknown, keys: string[]): Record<string, unknown>[] {
  for (const k of keys) {
    const x = extractEmbedded(data, k);
    if (x.length) return x;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if ("id" in d && !d._embedded) return [d];
  }
  return [];
}

async function paginate(
  apiKey: string,
  base: string,
  connectedAccountId: string,
  userId: string,
  slug: string,
  baseArgs: Record<string, unknown>,
  embeddedKeys: string[],
  maxPages = 80,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 250;
  while (page <= maxPages) {
    const data = await composioExecuteTool(apiKey, base, connectedAccountId, userId, slug, {
      ...baseArgs,
      page,
      limit,
    });
    const chunk = chunkItems(data, embeddedKeys.length ? embeddedKeys : ["items"]);
    if (!chunk.length) break;
    out.push(...chunk);
    if (chunk.length < limit) break;
    page += 1;
  }
  return out;
}

/** Mesma lógica que `stage_type_map` / `infer_lead_status` no standalone (kommo_normalize.py). */
function buildStageTypeMap(pipelines: Record<string, unknown>[]): Map<string, "won" | "lost" | "progress"> {
  const map = new Map<string, "won" | "lost" | "progress">();
  for (const p of pipelines) {
    const emb = p._embedded as Record<string, unknown> | undefined;
    const statuses = emb?.statuses;
    if (!Array.isArray(statuses)) continue;
    for (const s of statuses) {
      if (!s || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      const id = row.id;
      if (id == null) continue;
      const t = row.type;
      if (t === 1) map.set(String(id), "won");
      else if (t === 2) map.set(String(id), "lost");
      else map.set(String(id), "progress");
    }
  }
  return map;
}

function inferLeadStatus(raw: Record<string, unknown>, stagesById: Map<string, "won" | "lost" | "progress">): "open" | "won" | "lost" {
  const closedAt = raw.closed_at;
  const isClosed = closedAt != null && closedAt !== 0 && closedAt !== "0" && String(closedAt).trim() !== "";
  const statusId = String(raw.status_id ?? "");
  const stype = stagesById.get(statusId);
  if (isClosed) {
    if (stype === "won") return "won";
    if (stype === "lost") return "lost";
    return "lost";
  }
  return "open";
}

function contactHasPhoneEmail(raw: Record<string, unknown>): { phone: boolean; email: boolean } {
  let phone = false;
  let email = false;
  const cfv = raw.custom_fields_values;
  if (!Array.isArray(cfv)) return { phone, email };
  for (const field of cfv) {
    if (!field || typeof field !== "object") continue;
    const f = field as Record<string, unknown>;
    const code = f.field_code;
    const vals = f.values;
    const val =
      Array.isArray(vals) && vals[0] && typeof vals[0] === "object"
        ? String((vals[0] as Record<string, unknown>).value ?? "").trim()
        : "";
    if (!val) continue;
    if (code === "PHONE") phone = true;
    if (code === "EMAIL") email = true;
  }
  return { phone, email };
}

export type AuditorMetricsSnapshot = Record<string, unknown>;

/** Monta métricas no formato `crm_snapshots.metrics` (compatible com emptyMetrics). */
export async function fetchKommoMetricsViaComposioExecute(params: {
  apiKey: string;
  executeBaseUrl: string;
  connectedAccountId: string;
  userId: string;
}): Promise<AuditorMetricsSnapshot> {
  const { apiKey, executeBaseUrl, connectedAccountId, userId } = params;
  const base = executeBaseUrl.replace(/\/$/, "");

  const maxPagesEnv = Number(process.env.AUDITOR_ENGAGEMENT_MAX_PAGES?.trim());
  const listMaxPages =
    Number.isFinite(maxPagesEnv) && maxPagesEnv > 0 ? Math.min(Math.floor(maxPagesEnv), 200) : 80;
  const taskMaxPages =
    Number.isFinite(maxPagesEnv) && maxPagesEnv > 0 ? Math.min(Math.floor(maxPagesEnv), 200) : 30;

  const pipeData = await composioExecuteTool(apiKey, base, connectedAccountId, userId, LIST_PIPELINES, {});
  const pipelines = chunkItems(pipeData, ["pipelines"]);
  const stagesById = buildStageTypeMap(pipelines);

  const leads = await paginate(
    apiKey,
    base,
    connectedAccountId,
    userId,
    LIST_LEADS,
    { with_params: ["contacts"] },
    ["leads"],
    listMaxPages,
  );
  const contacts = await paginate(apiKey, base, connectedAccountId, userId, LIST_CONTACTS, {}, ["contacts"], listMaxPages);
  const tasks = await paginate(apiKey, base, connectedAccountId, userId, LIST_TASKS, {}, ["tasks"], taskMaxPages);

  let openCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let openValue = 0;
  let wonValue = 0;
  let withoutValue = 0;
  let withoutOwner = 0;
  let withoutSource = 0;
  let lossesWithoutReason = 0;

  for (const raw of leads) {
    const st = inferLeadStatus(raw, stagesById);
    const price = Number(raw.price ?? 0) || 0;
    if (st === "open") {
      openCount += 1;
      openValue += price;
      if (!price) withoutValue += 1;
    } else if (st === "won") {
      wonCount += 1;
      wonValue += price;
    } else {
      lostCount += 1;
      const lr = raw.loss_reason_id;
      if (lr == null || lr === 0 || lr === "0") lossesWithoutReason += 1;
    }
    if (raw.responsible_user_id == null || raw.responsible_user_id === "") withoutOwner += 1;
    const src = raw.source_id;
    if (src == null || src === 0 || src === "0" || src === "") withoutSource += 1;
  }

  let contactsWithoutPhone = 0;
  let contactsWithoutEmail = 0;
  for (const c of contacts) {
    const { phone, email } = contactHasPhoneEmail(c);
    if (!phone) contactsWithoutPhone += 1;
    if (!email) contactsWithoutEmail += 1;
  }

  const now = Date.now() / 1000;
  let overdueTasks = 0;
  let stalledLeads = 0;
  for (const t of tasks) {
    const completeTill = t.complete_till;
    const isCompleted = Boolean(t.is_completed);
    if (!isCompleted && typeof completeTill === "number" && completeTill > 0 && completeTill < now) {
      overdueTasks += 1;
    }
  }
  const stuckDaysRaw = Number(process.env.AUDITOR_STUCK_LEAD_DAYS?.trim());
  const stuckDaysMult = Number.isFinite(stuckDaysRaw) && stuckDaysRaw > 0 ? stuckDaysRaw : 7;
  const stuckDays = stuckDaysMult * 86400;
  for (const raw of leads) {
    const st = inferLeadStatus(raw, stagesById);
    if (st !== "open") continue;
    const ua = raw.updated_at;
    if (typeof ua === "number" && ua > 0 && now - ua > stuckDays) stalledLeads += 1;
  }

  const active = openCount + wonCount + lostCount;
  const winRate = active > 0 ? Math.round((wonCount / active) * 100) : 0;
  const lossRate = active > 0 ? Math.round((lostCount / active) * 100) : 0;

  const hygiene = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.round((contactsWithoutPhone / Math.max(contacts.length, 1)) * 35) -
        Math.round((withoutSource / Math.max(leads.length, 1)) * 25) -
        Math.round((withoutOwner / Math.max(leads.length, 1)) * 15),
    ),
  );
  const discipline = Math.max(0, Math.min(100, 100 - Math.round((overdueTasks / Math.max(tasks.length, 1)) * 60)));
  const risk = Math.min(100, Math.round((lossesWithoutReason / Math.max(lostCount, 1)) * 40 + stalledLeads * 3));
  const forecast = Math.max(0, Math.min(100, winRate));
  const overall = Math.round(hygiene * 0.35 + discipline * 0.25 + forecast * 0.25 + (100 - risk) * 0.15);

  return {
    total_opportunities: leads.length,
    open_count: openCount,
    won_count: wonCount,
    lost_count: lostCount,
    open_value: Math.round(openValue * 100) / 100,
    won_value: Math.round(wonValue * 100) / 100,
    win_rate: winRate,
    loss_rate: lossRate,
    opportunities_without_value: withoutValue,
    opportunities_without_owner: withoutOwner,
    opportunities_without_source: withoutSource,
    opportunities_without_next_action: 0,
    overdue_tasks: overdueTasks,
    stalled_leads: stalledLeads,
    contacts_without_phone: contactsWithoutPhone,
    contacts_without_email: contactsWithoutEmail,
    losses_without_reason: lossesWithoutReason,
    hygiene_score: hygiene,
    discipline_score: discipline,
    risk_score: risk,
    forecast_score: forecast,
    overall_score: overall,
    mock: false,
    integration: "composio_execute_v1",
    composio_tool_namespace: "KOMMO_*",
  };
}
