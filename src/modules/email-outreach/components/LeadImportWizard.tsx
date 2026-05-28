/**
 * LeadImportWizard — wizard de 3 etapas para subir leads em uma campanha.
 *
 *   1. Fonte:    cole emails / upload CSV / leads existentes
 *   2. Mapeamento (só CSV): mapear colunas do CSV para os campos do lead
 *   3. Revisão:  contadores + botão "Importar e inscrever"
 *
 * Reusa as mutations existentes (useBulkImportLeads + useEnrollLeads). Não
 * adiciona deps novas; o parser de CSV roda inline (suficiente pra listas
 * de milhares de leads).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  ContentPaste as ContentPasteIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  PersonSearch as PersonSearchIcon,
} from "@mui/icons-material";

import { useBulkImportLeads, useEnrollLeads, useLeads } from "@/modules/email-outreach/hooks/useLeads";
import type { Lead } from "@/modules/email-outreach/types";

const ORANGE = "#F97316";
const ORANGE_HOVER = "#EA580C";

type LeadField =
  | "ignore"
  | "email"
  | "first_name"
  | "last_name"
  | "company"
  | "title"
  | "phone"
  | "linkedin_url";

const LEAD_FIELDS: Array<{ value: LeadField; label: string; required?: boolean }> = [
  { value: "ignore", label: "(ignorar)" },
  { value: "email", label: "Email", required: true },
  { value: "first_name", label: "Primeiro nome" },
  { value: "last_name", label: "Sobrenome" },
  { value: "company", label: "Empresa" },
  { value: "title", label: "Cargo" },
  { value: "phone", label: "Telefone" },
  { value: "linkedin_url", label: "LinkedIn URL" },
];

// Detecta automaticamente o campo a partir do header da coluna (PT/EN, lowercase).
function autoDetect(header: string): LeadField {
  const h = header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/(^|[\s_-])email([\s_-]|$)|e-mail|mail/.test(h)) return "email";
  if (/first[_\s-]?name|nome|primeiro|firstname/.test(h)) return "first_name";
  if (/last[_\s-]?name|sobrenome|surname/.test(h)) return "last_name";
  if (/company|empresa|organization|organizacao/.test(h)) return "company";
  if (/title|cargo|position|funcao/.test(h)) return "title";
  if (/phone|telefone|celular|whatsapp|fone/.test(h)) return "phone";
  if (/linkedin/.test(h)) return "linkedin_url";
  return "ignore";
}

// CSV inline parser (RFC 4180-ish, lida com vírgula, ponto-e-vírgula, aspas duplas).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r/g, "").split("\n");

  // Detecta separador na primeira linha não vazia
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  const commaCount = (firstNonEmpty.match(/,/g) ?? []).length;
  const semiCount = (firstNonEmpty.match(/;/g) ?? []).length;
  const tabCount = (firstNonEmpty.match(/\t/g) ?? []).length;
  const sep =
    tabCount > Math.max(commaCount, semiCount)
      ? "\t"
      : semiCount > commaCount
      ? ";"
      : ",";

  for (const raw of lines) {
    if (raw.length === 0) continue;
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inQuote) {
        if (ch === '"') {
          if (raw[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === sep) {
          cells.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ParsedLead = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  _rowIndex: number; // pra ancorar erros à linha original
};

type ValidationResult = {
  valid: ParsedLead[];
  invalid: Array<{ rowIndex: number; reason: string; raw?: string }>;
  duplicatesInFile: number; // dedupe interno (mesmo email aparece 2x no mesmo upload)
};

function validateRows(rows: ParsedLead[]): ValidationResult {
  const valid: ParsedLead[] = [];
  const invalid: ValidationResult["invalid"] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  for (const r of rows) {
    const email = (r.email ?? "").toLowerCase().trim();
    if (!email) {
      invalid.push({ rowIndex: r._rowIndex, reason: "email vazio" });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      invalid.push({ rowIndex: r._rowIndex, reason: "email inválido", raw: email });
      continue;
    }
    if (seen.has(email)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(email);
    valid.push({ ...r, email });
  }

  return { valid, invalid, duplicatesInFile };
}

// ─────────────────────────────────────────────────────────────────────────────

type SourceMode = "paste" | "csv" | "existing";

type Props = {
  open: boolean;
  onClose: () => void;
  orgId: string | undefined;
  campaignId: string | undefined;
  /** Template subjects/bodies já configurados, pra detectar merge tags faltando. */
  templateVariables?: string[];
};

const STEPS = ["Fonte", "Mapeamento", "Revisão"];

export function LeadImportWizard({
  open,
  onClose,
  orgId,
  campaignId,
  templateVariables = [],
}: Props) {
  const bulkImport = useBulkImportLeads(orgId);
  const enrollLeads = useEnrollLeads(campaignId);
  const existingLeadsQuery = useLeads(orgId);

  const [activeStep, setActiveStep] = useState(0);
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste");

  // Paste mode
  const [pasteText, setPasteText] = useState("");

  // CSV mode
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]); // sem header
  const [columnMap, setColumnMap] = useState<Record<number, LeadField>>({});
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  // Existing mode
  const [selectedExistingIds, setSelectedExistingIds] = useState<Set<string>>(new Set());
  const [existingFilter, setExistingFilter] = useState("");

  // Reset state quando fechar
  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setSourceMode("paste");
      setPasteText("");
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMap({});
      setCsvFileName(null);
      setSelectedExistingIds(new Set());
      setExistingFilter("");
    }
  }, [open]);

  // ── Parse rows uniformes (independente da fonte) ───────────────────────────
  const parsedFromCsv: ParsedLead[] = useMemo(() => {
    if (sourceMode !== "csv") return [];
    const rows: ParsedLead[] = [];
    csvRows.forEach((row, idx) => {
      const lead: ParsedLead = { email: "", _rowIndex: idx + 2 }; // +2 = header é 1, dados começam em 2
      row.forEach((cell, colIdx) => {
        const field = columnMap[colIdx];
        if (!field || field === "ignore") return;
        (lead as Record<string, unknown>)[field] = cell;
      });
      rows.push(lead);
    });
    return rows;
  }, [sourceMode, csvRows, columnMap]);

  const parsedFromPaste: ParsedLead[] = useMemo(() => {
    if (sourceMode !== "paste") return [];
    return pasteText
      .split(/[\n,;]+/)
      .map((s, i) => ({ email: s.trim().toLowerCase(), _rowIndex: i + 1 }))
      .filter((l) => l.email.length > 0);
  }, [sourceMode, pasteText]);

  const parsedFromExisting: ParsedLead[] = useMemo(() => {
    if (sourceMode !== "existing") return [];
    const list = existingLeadsQuery.data ?? [];
    return list
      .filter((l: Lead) => selectedExistingIds.has(l.id))
      .map((l: Lead, idx) => ({
        email: l.email,
        first_name: l.first_name ?? undefined,
        last_name: l.last_name ?? undefined,
        company: l.company ?? undefined,
        title: l.title ?? undefined,
        phone: l.phone ?? undefined,
        linkedin_url: l.linkedin_url ?? undefined,
        _rowIndex: idx + 1,
      }));
  }, [sourceMode, selectedExistingIds, existingLeadsQuery.data]);

  const currentParsed: ParsedLead[] =
    sourceMode === "csv" ? parsedFromCsv : sourceMode === "paste" ? parsedFromPaste : parsedFromExisting;

  const validation = useMemo(() => validateRows(currentParsed), [currentParsed]);

  // ── Cruzamento com leads existentes pra split novos vs já no pool ──────────
  const existingEmailSet = useMemo(() => {
    const s = new Set<string>();
    (existingLeadsQuery.data ?? []).forEach((l: Lead) => s.add(l.email.toLowerCase()));
    return s;
  }, [existingLeadsQuery.data]);

  const newCount = validation.valid.filter((l) => !existingEmailSet.has(l.email)).length;
  const existingCount = validation.valid.length - newCount;

  // Variáveis usadas nos templates mas não cobertas pelo mapping
  const mappedFields = useMemo(() => {
    if (sourceMode === "csv") {
      return new Set(Object.values(columnMap).filter((v) => v !== "ignore"));
    }
    if (sourceMode === "paste") return new Set<LeadField>(["email"]);
    // existing → cobre todos os campos
    return new Set<LeadField>(["email", "first_name", "last_name", "company", "title", "phone", "linkedin_url"]);
  }, [sourceMode, columnMap]);

  const missingTemplateVars = useMemo(() => {
    return templateVariables.filter((v) => {
      // a var pode ser first_name, company, etc. — checa se está mapeada
      const f = v.toLowerCase();
      const known: LeadField[] = ["first_name", "last_name", "company", "title", "phone", "linkedin_url"];
      const match = known.find((k) => k === f);
      if (!match) return false;
      return !mappedFields.has(match);
    });
  }, [templateVariables, mappedFields]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCsvFile = async (file: File) => {
    setCsvFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setCsvHeaders(rows[0] ?? []);
      setCsvRows([]);
      setColumnMap({});
      return;
    }
    const [header, ...data] = rows;
    setCsvHeaders(header);
    setCsvRows(data);
    const map: Record<number, LeadField> = {};
    header.forEach((h, idx) => {
      map[idx] = autoDetect(h);
    });
    setColumnMap(map);
  };

  const canAdvanceFromSource = useMemo(() => {
    if (sourceMode === "paste") return parsedFromPaste.length > 0;
    if (sourceMode === "csv") return csvRows.length > 0;
    return selectedExistingIds.size > 0;
  }, [sourceMode, parsedFromPaste.length, csvRows.length, selectedExistingIds.size]);

  const canAdvanceFromMapping = useMemo(() => {
    if (sourceMode !== "csv") return true;
    // precisa de pelo menos um campo "email" no mapping
    return Object.values(columnMap).includes("email");
  }, [sourceMode, columnMap]);

  const totalSteps = sourceMode === "csv" ? 3 : 2;
  const stepsToShow = sourceMode === "csv" ? STEPS : [STEPS[0], STEPS[2]];

  const handleNext = () => {
    if (activeStep === 0 && sourceMode !== "csv") {
      setActiveStep(totalSteps - 1); // pula mapeamento
    } else {
      setActiveStep((s) => Math.min(s + 1, totalSteps - 1));
    }
  };

  const handleBack = () => {
    if (activeStep === totalSteps - 1 && sourceMode !== "csv") {
      setActiveStep(0); // pula mapeamento ao voltar
    } else {
      setActiveStep((s) => Math.max(s - 1, 0));
    }
  };

  const handleSubmit = async () => {
    if (validation.valid.length === 0) return;

    // 1) bulk-import (upsert por org_id+email)
    await bulkImport.mutateAsync({
      source: sourceMode === "csv" ? "csv_upload" : sourceMode === "paste" ? "paste" : "existing_pool",
      leads: validation.valid.map(({ _rowIndex, ...rest }) => rest),
    });

    // 2) re-busca pool, descobre os IDs dos emails importados, e inscreve.
    const updated = await existingLeadsQuery.refetch();
    const emailToId = new Map<string, string>();
    (updated.data ?? []).forEach((l: Lead) => emailToId.set(l.email.toLowerCase(), l.id));
    const idsToEnroll: string[] = [];
    for (const v of validation.valid) {
      const id = emailToId.get(v.email);
      if (id) idsToEnroll.push(id);
    }
    if (idsToEnroll.length > 0) {
      await enrollLeads.mutateAsync(idsToEnroll);
    }
    onClose();
  };

  const submitting = bulkImport.isPending || enrollLeads.isPending;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Importar leads para a campanha
        <IconButton onClick={onClose} disabled={submitting} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={sourceMode === "csv" ? activeStep : activeStep === 0 ? 0 : 1} sx={{ mb: 3 }}>
          {stepsToShow.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ── Step 0: Fonte ─────────────────────────────────────────────── */}
        {activeStep === 0 && (
          <Box>
            <Tabs
              value={sourceMode}
              onChange={(_, v) => setSourceMode(v as SourceMode)}
              sx={{ mb: 2 }}
            >
              <Tab icon={<ContentPasteIcon />} iconPosition="start" label="Colar emails" value="paste" />
              <Tab icon={<CloudUploadIcon />} iconPosition="start" label="Upload CSV" value="csv" />
              <Tab icon={<PersonSearchIcon />} iconPosition="start" label="Pool existente" value="existing" />
            </Tabs>

            {sourceMode === "paste" && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Um email por linha (ou separados por vírgula/ponto-e-vírgula). Sem outras informações —
                  os leads ficam só com o email no pool da org.
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={10}
                  maxRows={16}
                  placeholder={"contato1@empresa.com\ncontato2@empresa.com\n..."}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  sx={{ fontFamily: "monospace" }}
                />
                {parsedFromPaste.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {parsedFromPaste.length} email{parsedFromPaste.length === 1 ? "" : "s"} detectado
                    {parsedFromPaste.length === 1 ? "" : "s"}.
                  </Typography>
                )}
              </Box>
            )}

            {sourceMode === "csv" && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Cabeçalho na primeira linha. Suporta vírgula, ponto-e-vírgula e tab como separadores.
                  Você mapeia as colunas no próximo passo.
                </Typography>

                <Box
                  sx={{
                    border: "2px dashed",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 4,
                    textAlign: "center",
                    cursor: "pointer",
                    bgcolor: "background.default",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleCsvFile(file);
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv,text/csv,text/plain,.tsv";
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0];
                      if (file) void handleCsvFile(file);
                    };
                    input.click();
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 42, color: ORANGE, mb: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {csvFileName ?? "Arraste o CSV aqui ou clique para selecionar"}
                  </Typography>
                  {csvFileName ? (
                    <Typography variant="caption" color="text.secondary">
                      {csvRows.length} linha{csvRows.length === 1 ? "" : "s"} (sem o cabeçalho)
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Colunas sugeridas: email, primeiro_nome, sobrenome, empresa, cargo, telefone, linkedin
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {sourceMode === "existing" && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Selecione leads do pool da org que ainda não estão nesta campanha.
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Filtrar por email, nome ou empresa..."
                  value={existingFilter}
                  onChange={(e) => setExistingFilter(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ maxHeight: 320, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  {existingLeadsQuery.isLoading ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" />
                          <TableCell>Email</TableCell>
                          <TableCell>Nome</TableCell>
                          <TableCell>Empresa</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(existingLeadsQuery.data ?? [])
                          .filter((l: Lead) => {
                            if (!existingFilter.trim()) return true;
                            const f = existingFilter.toLowerCase();
                            return (
                              l.email.toLowerCase().includes(f) ||
                              (l.first_name ?? "").toLowerCase().includes(f) ||
                              (l.last_name ?? "").toLowerCase().includes(f) ||
                              (l.company ?? "").toLowerCase().includes(f)
                            );
                          })
                          .slice(0, 500)
                          .map((l: Lead) => {
                            const isSel = selectedExistingIds.has(l.id);
                            return (
                              <TableRow
                                key={l.id}
                                hover
                                selected={isSel}
                                onClick={() => {
                                  setSelectedExistingIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(l.id)) next.delete(l.id);
                                    else next.add(l.id);
                                    return next;
                                  });
                                }}
                                sx={{ cursor: "pointer" }}
                              >
                                <TableCell padding="checkbox">
                                  <input type="checkbox" checked={isSel} readOnly />
                                </TableCell>
                                <TableCell>{l.email}</TableCell>
                                <TableCell>
                                  {[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}
                                </TableCell>
                                <TableCell>{l.company ?? "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </Box>
                {selectedExistingIds.size > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {selectedExistingIds.size} selecionado{selectedExistingIds.size === 1 ? "" : "s"}.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* ── Step 1: Mapeamento (CSV) ──────────────────────────────────── */}
        {activeStep === 1 && sourceMode === "csv" && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Confirme o mapeamento das colunas. O campo <strong>Email</strong> é obrigatório.
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Coluna do CSV</TableCell>
                  <TableCell>Mapear para</TableCell>
                  <TableCell>Primeira linha</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvHeaders.map((h, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{h || `(coluna ${idx + 1})`}</TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={columnMap[idx] ?? "ignore"}
                          onChange={(e) =>
                            setColumnMap((prev) => ({ ...prev, [idx]: e.target.value as LeadField }))
                          }
                        >
                          {LEAD_FIELDS.map((f) => (
                            <MenuItem key={f.value} value={f.value}>
                              {f.label}
                              {f.required && (
                                <Chip size="small" label="obrigatório" sx={{ ml: 1, height: 18 }} />
                              )}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "text.secondary" }}>
                      {csvRows[0]?.[idx] ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!canAdvanceFromMapping && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Mapeie ao menos uma coluna para <strong>Email</strong> para continuar.
              </Alert>
            )}

            {/* Preview top 5 */}
            {canAdvanceFromMapping && csvRows.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                  Preview dos primeiros leads mapeados:
                </Typography>
                <Box sx={{ overflow: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {LEAD_FIELDS.filter((f) => f.value !== "ignore" && Object.values(columnMap).includes(f.value)).map(
                          (f) => (
                            <TableCell key={f.value}>{f.label}</TableCell>
                          ),
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parsedFromCsv.slice(0, 5).map((lead) => (
                        <TableRow key={lead._rowIndex}>
                          {LEAD_FIELDS.filter(
                            (f) => f.value !== "ignore" && Object.values(columnMap).includes(f.value),
                          ).map((f) => (
                            <TableCell key={f.value} sx={{ fontSize: 12 }}>
                              {(lead as Record<string, unknown>)[f.value]?.toString() ?? "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── Step 2: Revisão ───────────────────────────────────────────── */}
        {activeStep === totalSteps - 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Confirme os números antes de importar e inscrever na campanha.
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2, mb: 2 }}>
              <SummaryCard label="Novos" value={newCount} color="success" />
              <SummaryCard label="Já no pool" value={existingCount} color="info" />
              <SummaryCard label="Inválidos" value={validation.invalid.length} color="error" />
              <SummaryCard label="Duplicados no arquivo" value={validation.duplicatesInFile} color="warning" />
            </Box>

            {missingTemplateVars.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Os templates da sequência usam {missingTemplateVars.map((v) => `{{${v}}}`).join(", ")} mas
                essas variáveis não foram mapeadas. As tags ficarão em branco no envio.
              </Alert>
            )}

            {validation.invalid.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                  Primeiros {Math.min(5, validation.invalid.length)} erros:
                </Typography>
                <Stack spacing={0.5}>
                  {validation.invalid.slice(0, 5).map((err, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <ErrorOutlineIcon fontSize="small" color="error" />
                      <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                        linha {err.rowIndex}: {err.reason}
                        {err.raw ? ` (${err.raw})` : ""}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {validation.valid.length > 0 ? (
              <Alert
                severity="success"
                icon={<CheckCircleIcon />}
                sx={{ "& .MuiAlert-message": { display: "flex", alignItems: "center", gap: 1 } }}
              >
                Pronto pra importar <strong>{validation.valid.length}</strong> lead
                {validation.valid.length === 1 ? "" : "s"} e inscrever na campanha.
              </Alert>
            ) : (
              <Alert severity="info">Sem leads válidos pra importar.</Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={submitting}>
            Voltar
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        {activeStep < totalSteps - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              (activeStep === 0 && !canAdvanceFromSource) ||
              (activeStep === 1 && !canAdvanceFromMapping)
            }
            sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: ORANGE_HOVER } }}
          >
            Avançar
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || validation.valid.length === 0}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: ORANGE_HOVER } }}
          >
            {submitting ? "Importando..." : `Importar e inscrever ${validation.valid.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "success" | "info" | "error" | "warning";
}) {
  const palette: Record<string, string> = {
    success: "#16a34a",
    info: "#0284c7",
    error: "#dc2626",
    warning: "#d97706",
  };
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        textAlign: "center",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: palette[color], mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default LeadImportWizard;
