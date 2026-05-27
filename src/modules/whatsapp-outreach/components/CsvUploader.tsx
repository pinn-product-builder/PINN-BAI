/**
 * CsvUploader — upload de CSV/Excel com drag & drop, parse client-side,
 * mapping de colunas e preview antes de enrollar leads.
 *
 * Formatos suportados:
 *   - CSV/TSV/TXT (parse interno, sem deps — vírgula/ponto-e-vírgula/tab)
 *   - XLSX/XLS    (SheetJS — lê primeira aba do workbook)
 *
 * Em todos os casos, primeira linha = cabeçalho. Mapping auto-detecta
 * colunas conhecidas (phone/nome/empresa/cargo/email) com aliases comuns
 * e pode ser ajustado manualmente se a detecção errar.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, IconButton, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, alpha, useTheme,
} from "@mui/material";
import {
  CloudUpload as UploadIcon, Delete as DeleteIcon,
  Download as DownloadIcon, CheckCircle as CheckIcon,
} from "@mui/icons-material";
import * as XLSX from "xlsx";

import type { LeadEnrollIn } from "../types";

// Campos que a Mari aceita no enroll
const FIELDS = [
  // Aliases pro phone cobrem CSVs BR comuns:
  //   - "whatsapp recomendado" (Assertiva / enriquecimento)
  //   - "telefone celular", "fone", "número", "tel"
  // ATENÇÃO: "todos whatsapps" (plural) tem múltiplos números separados por
  // " | " — autoMap prefere "whatsapp recomendado" (singular) que aparece antes.
  { key: "phone",   label: "Phone *",  required: true,  aliases: ["whatsapp recomendado", "whatsapp", "phone", "telefone", "celular", "numero", "número", "fone", "tel"] },
  { key: "nome",    label: "Nome",     required: false, aliases: ["nome decisor", "nome", "name", "first_name", "primeiro_nome", "decisor"] },
  { key: "empresa", label: "Empresa",  required: false, aliases: ["razão social", "razao social", "empresa", "company", "organização", "organizacao", "org"] },
  { key: "cargo",   label: "Cargo",    required: false, aliases: ["cargo", "role", "title", "função", "funcao", "position"] },
  { key: "email",   label: "Email",    required: false, aliases: ["e-mails pessoais", "email", "e-mail", "mail"] },
] as const;

const SKIP_VALUE = "__SKIP__";

interface CsvUploaderProps {
  onEnroll: (leads: LeadEnrollIn[]) => Promise<void> | void;
  submitting: boolean;
}

interface ParsedRow {
  raw: Record<string, string>;
  lead: LeadEnrollIn;
  valid: boolean;
  errors: string[];
}

// ────────────────────────────────────────────────────────────────
// CSV parser básico (sem deps)
// ────────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  const max = Math.max(counts[","], counts[";"], counts["\t"]);
  if (max === 0) return ",";
  if (counts["\t"] === max) return "\t";
  if (counts[";"] === max) return ";";
  return ",";
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'; i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === delim && !inQuote) {
      out.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ────────────────────────────────────────────────────────────────
// Excel parser (.xlsx/.xls) — via SheetJS
// ────────────────────────────────────────────────────────────────

/**
 * Lê a primeira aba do workbook e retorna headers + rows no mesmo formato
 * que parseCsv. Coerção de tipos:
 *   - Números (ex: telefones formatados como número no Excel) viram string
 *   - Datas viram ISO strings (raw=false, então usa o display do Excel)
 *   - Linhas totalmente em branco são descartadas
 *
 * Lança Error se o arquivo estiver corrompido ou sem abas.
 */
async function parseExcel(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo Excel sem abas");
  const sheet = workbook.Sheets[sheetName];

  // header:1 = retorna array de arrays (linhas crus). defval='' = células
  // vazias viram string vazia em vez de undefined. raw=false força o display
  // formatado (resolve datas e telefones que viraram número).
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headerRow = aoa[0] as unknown[];
  const headers = headerRow.map((h) => String(h ?? "").trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i] as unknown[];
    // Descarta linha totalmente vazia
    if (cells.every((c) => String(c ?? "").trim() === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = String(cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Detecta o tipo do arquivo pela extensão e roteia pro parser certo.
 * Aceita: .csv, .tsv, .txt, .xlsx, .xls.
 */
async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcel(file);
  }
  // CSV/TSV/TXT — qualquer outro vai pelo parser de texto
  const text = await file.text();
  return parseCsv(text);
}

// Auto-mapping: pra cada FIELD, acha header CSV que casa por alias
function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of FIELDS) {
    const match = headers.find((h) =>
      field.aliases.some((a) => h.includes(a) || a.includes(h))
    );
    map[field.key] = match || SKIP_VALUE;
  }
  return map;
}

/**
 * Normaliza um valor de phone vindo do CSV/Excel pro formato E.164 BR sem '+'
 * que o Evolution/WhatsApp espera (ex: 5531999999999).
 *
 * Lida com 3 cenários comuns que apareceram em produção:
 *
 *  1. **Phone BR formatado**: "(38) 99946-9027" → strip não-dígitos →
 *     "38999469027" (11 dígitos, sem DDI). Adicionamos prefix "55".
 *
 *  2. **Múltiplos phones na mesma célula** (separados por " | ", vírgula
 *     ou ponto-e-vírgula), tipo "Todos WhatsApps": pegamos o **primeiro**
 *     da lista (que é o principal/recomendado na convenção Assertiva).
 *
 *  3. **Scientific notation do Excel→CSV** ("5.5e+12") — converte de volta
 *     pra inteiro antes do strip pra não perder dígitos.
 *
 * Retorna `null` se o resultado não chegar a 12 dígitos (DDI + DDD + 8/9 digit).
 * `null` significa phone inválido — o caller decide se vira erro de validação.
 */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  // Caso 2: célula com múltiplos números — pegar o primeiro.
  // Splits comuns: " | " (Assertiva), "," ou ";".
  const first = raw.split(/[|,;]/)[0].trim();

  // Caso 3: notação científica.
  let normalized = first;
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(first)) {
    const n = Number(first);
    if (Number.isFinite(n)) normalized = Math.trunc(n).toString();
  }

  // Strip não-dígitos.
  let digits = normalized.replace(/\D/g, "");

  if (!digits) return null;

  // Caso 1: phone BR sem DDI.
  // - 10 dígitos = DDD (2) + fixo (8) → adiciona "55" → 12 dígitos. Aceitável
  //   mas WhatsApp não funciona em fixo. Mesmo assim normalizamos pra Evolution
  //   decidir se rejeita.
  // - 11 dígitos = DDD (2) + celular (9) → adiciona "55" → 13 dígitos. Ideal.
  // - 12 ou 13 dígitos começando com "55" → presumir que DDI já está → mantém.
  // - <10 dígitos → input quebrado, retornar null pra rejeitar.
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  } else if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith("55")) {
      // Outros DDIs (ex: argentina 54). Aceita como está.
    }
  } else if (digits.length < 10) {
    return null;
  }
  // Qualquer coisa > 13 dígitos passa cru — pode ser DDI maluco mas deixa
  // o Evolution rejeitar com erro real em vez de truncar arbitrariamente.

  return digits;
}

function buildLeads(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): ParsedRow[] {
  return rows.map((row) => {
    const lead: LeadEnrollIn = { phone: "" };
    const errors: string[] = [];

    for (const field of FIELDS) {
      const col = mapping[field.key];
      if (!col || col === SKIP_VALUE) continue;
      const raw = (row[col] ?? "").trim();
      if (!raw) continue;
      if (field.key === "phone") {
        const normalized = normalizePhone(raw);
        if (normalized) {
          lead.phone = normalized;
        } else {
          // Mantém o raw stripado pra preview/debug, mesmo inválido
          lead.phone = raw.replace(/\D/g, "");
        }
      } else {
        (lead as Record<string, string>)[field.key] = raw;
      }
    }

    // Após normalização, phones válidos têm 12-13 dígitos (DDI + DDD + número).
    // Aceita-se 11 dígitos como fallback caso o normalize devolva sem DDI.
    if (!lead.phone || lead.phone.length < 11) {
      errors.push(
        `phone inválido ("${lead.phone || "vazio"}") — esperado formato (DDD) 9XXXX-XXXX ou 5531999999999`,
      );
    }
    return { raw: row, lead, valid: errors.length === 0, errors };
  });
}


// ────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────

export function CsvUploader({ onEnroll, submitting }: CsvUploaderProps) {
  const theme = useTheme();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setFileName(null); setHeaders([]); setRows([]); setMapping({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().match(/\.(csv|tsv|txt|xlsx|xls)$/)) {
      alert("Arquivo precisa ser .csv, .tsv, .txt, .xlsx ou .xls");
      return;
    }
    try {
      const parsed = await parseFile(file);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao ler arquivo: ${msg}`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const parsed = useMemo(() => buildLeads(rows, mapping), [rows, mapping]);
  const validLeads = useMemo(() => parsed.filter((p) => p.valid).map((p) => p.lead), [parsed]);
  const invalidCount = parsed.length - validLeads.length;

  const handleEnroll = async () => {
    if (validLeads.length === 0) return;
    await onEnroll(validLeads);
    reset();
  };

  const downloadTemplate = () => {
    const csv = "phone,nome,empresa,cargo,email\n5531999999999,Pedro Silva,Acme,Diretor,pedro@acme.com\n5511988887777,Carlos Souza,Vox,Gerente,carlos@vox.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const aoa = [
      ["phone", "nome", "empresa", "cargo", "email"],
      ["5531999999999", "Pedro Silva", "Acme", "Diretor", "pedro@acme.com"],
      ["5511988887777", "Carlos Souza", "Vox", "Gerente", "carlos@vox.com"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Mantém phone como texto pra preservar zero à esquerda / DDD
    ws["A2"] = { v: "5531999999999", t: "s" };
    ws["A3"] = { v: "5511988887777", t: "s" };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "leads");
    XLSX.writeFile(wb, "leads-template.xlsx");
  };

  // ── Render ────────────────────────────────────────────────────
  if (!fileName) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Importar leads</Typography>
              <Typography variant="caption" color="text.secondary">
                Arraste um arquivo CSV ou Excel, ou clique pra escolher. Detectamos colunas automaticamente.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<DownloadIcon />} onClick={downloadTemplate} size="small">
                Modelo CSV
              </Button>
              <Button startIcon={<DownloadIcon />} onClick={downloadExcelTemplate} size="small">
                Modelo Excel
              </Button>
            </Stack>
          </Stack>

          <Box
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            sx={{
              border: 2,
              borderStyle: "dashed",
              borderColor: drag ? "#25D366" : "divider",
              borderRadius: 2,
              p: 6,
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.15s, background-color 0.15s",
              bgcolor: drag ? alpha("#25D366", 0.05) : "transparent",
              "&:hover": { borderColor: theme.palette.text.primary },
            }}
          >
            <UploadIcon sx={{ fontSize: 48, color: drag ? "#25D366" : "text.secondary", mb: 1 }} />
            <Typography variant="body1" fontWeight={600}>
              {drag ? "Solte aqui" : "Arraste o arquivo ou clique pra selecionar"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Aceita .csv, .tsv, .txt (vírgula/ponto-e-vírgula/tab) ou Excel (.xlsx, .xls)
            </Typography>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: "none" }}
              onChange={onSelect}
            />
          </Box>

          <Box mt={3}>
            <Typography variant="caption" color="text.secondary">
              <strong>Colunas reconhecidas:</strong> phone (obrigatório),
              nome, empresa, cargo, email. Aliases comuns são detectados
              (telefone/celular/whatsapp pra phone, name/first_name pra nome, etc).
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ── Preview / mapping ─────────────────────────────────────────
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckIcon sx={{ color: "#25D366" }} />
              <Typography variant="h6" fontWeight={700}>{fileName}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {rows.length} linha{rows.length !== 1 ? "s" : ""} · {headers.length} coluna{headers.length !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <IconButton onClick={reset} size="small" title="Trocar arquivo">
            <DeleteIcon />
          </IconButton>
        </Stack>

        <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>
          Mapeamento de colunas
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Confira se cada campo da Mari aponta pra coluna certa do seu CSV.
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ rowGap: 2 }}>
          {FIELDS.map((field) => (
            <TextField
              key={field.key}
              select
              label={field.label}
              value={mapping[field.key] || SKIP_VALUE}
              onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
              size="small"
              sx={{ minWidth: 200, flex: 1 }}
              error={field.required && mapping[field.key] === SKIP_VALUE}
              helperText={field.required && mapping[field.key] === SKIP_VALUE
                ? "Obrigatório"
                : " "}
            >
              <MenuItem value={SKIP_VALUE}>— Não mapear —</MenuItem>
              {headers.map((h) => (
                <MenuItem key={h} value={h}>{h}</MenuItem>
              ))}
            </TextField>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} mt={3} alignItems="center">
          <Chip
            label={`${validLeads.length} válidos`}
            color={validLeads.length === 0 ? "error" : "success"}
            size="small"
          />
          {invalidCount > 0 && (
            <Chip
              label={`${invalidCount} com erro`}
              color="warning"
              size="small"
            />
          )}
        </Stack>

        {/* Alerta forte quando ZERO leads são válidos. Mostra exemplo concreto
            do primeiro phone inválido pro user diagnosticar (foi mapping
            errado? Excel quebrou os números? coluna fora do esperado?). */}
        {parsed.length > 0 && validLeads.length === 0 && (
          <Card sx={{ mt: 2, bgcolor: "#FEF2F2", border: "1px solid #FCA5A5" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="body2" fontWeight={600} color="error.main" gutterBottom>
                ⚠️ Nenhum lead válido detectado
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Phones precisam ter 10+ dígitos (ex: <code>(31) 99999-9999</code> ou <code>5531999999999</code>).
                Adicionamos automaticamente o DDI 55 quando faltar.
                {(() => {
                  const example = parsed.find((p) => p.lead.phone && p.lead.phone.length < 11);
                  const short = example?.lead.phone;
                  const rawCell = example && mapping["phone"] && mapping["phone"] !== SKIP_VALUE
                    ? example.raw[mapping["phone"]]
                    : null;
                  if (short && rawCell) {
                    return (
                      <>
                        <br />
                        <strong>Exemplo do seu arquivo:</strong> a coluna mapeada como phone tinha
                        valor <code>"{rawCell}"</code>, que virou apenas <code>"{short}"</code> após limpeza.
                        <br />
                        <strong>Possíveis causas:</strong> (1) você mapeou a coluna errada — confira o select acima
                        e troque pra "WhatsApp Recomendado" ou similar; (2) o Excel truncou os phones — reenvie o
                        arquivo .xlsx direto, sem converter pra CSV.
                      </>
                    );
                  }
                  return null;
                })()}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Preview dos primeiros 12 */}
        {parsed.length > 0 && (
          <Box sx={{ mt: 2, maxHeight: 320, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 24 }} />
                  <TableCell>Phone</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>Empresa</TableCell>
                  <TableCell>Cargo</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsed.slice(0, 12).map((p, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: "50%",
                        bgcolor: p.valid ? "#10b981" : "#f59e0b",
                      }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {p.lead.phone || "—"}
                    </TableCell>
                    <TableCell>{p.lead.nome || "—"}</TableCell>
                    <TableCell>{p.lead.empresa || "—"}</TableCell>
                    <TableCell>{p.lead.cargo || "—"}</TableCell>
                    <TableCell>{p.lead.email || "—"}</TableCell>
                  </TableRow>
                ))}
                {parsed.length > 12 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                      … +{parsed.length - 12} linhas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}

        <Stack direction="row" justifyContent="flex-end" mt={3} spacing={1}>
          <Button onClick={reset}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleEnroll}
            disabled={validLeads.length === 0 || submitting}
            sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebd5a" } }}
          >
            {submitting ? "Enviando…" : `Enroll ${validLeads.length} lead${validLeads.length !== 1 ? "s" : ""}`}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
