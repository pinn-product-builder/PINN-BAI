/**
 * widgetFormula — avaliador de fórmulas custom de widgets (metric_card).
 *
 * Cada identificador na expressão corresponde a uma coluna da view/tabela do
 * widget. Suporta + - * / parênteses, unário negativo e separador `_` em
 * números (1_000). Divisão por zero e variável ausente retornam NaN (não
 * lançam); sintaxe inválida lança Error.
 *
 * Reconstruído fielmente a partir do bundle de produção (dist/assets/index-*.js,
 * build de 05/jul/2026); comportamento coberto por src/lib/widgetFormula.test.ts.
 */

type Op = "+" | "-" | "*" | "/" | "u-";

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "op"; op: Op }
  | { kind: "lparen" }
  | { kind: "rparen" };

const PRECEDENCE: Record<Op, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3 };
const RIGHT_ASSOC: Partial<Record<Op, boolean>> = { "u-": true };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expr.replace(/\s+/g, "");
  while (i < src.length) {
    const ch = src[i];
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    if (ch === "-") {
      // Unário quando é o primeiro token ou vem depois de operador/abre-parêntese.
      const prev = tokens[tokens.length - 1];
      const isUnary = !prev || prev.kind === "op" || prev.kind === "lparen";
      tokens.push({ kind: "op", op: isUnary ? "u-" : "-" });
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === "." || src[j] === "_")) j++;
      const value = parseFloat(src.slice(i, j).replace(/_/g, ""));
      if (isNaN(value)) throw new Error(`Número inválido em "${src.slice(i, j)}"`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let j = i;
      while (
        j < src.length &&
        ((src[j] >= "a" && src[j] <= "z") ||
          (src[j] >= "A" && src[j] <= "Z") ||
          (src[j] >= "0" && src[j] <= "9") ||
          src[j] === "_")
      )
        j++;
      tokens.push({ kind: "ident", name: src.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Caractere inesperado "${ch}" na fórmula`);
  }
  return tokens;
}

/** Shunting-yard: infixa → RPN. Lança em parênteses desbalanceados. */
function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];
  for (const token of tokens) {
    if (token.kind === "num" || token.kind === "ident") {
      output.push(token);
      continue;
    }
    if (token.kind === "op") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.kind !== "op") break;
        if (
          PRECEDENCE[top.op] > PRECEDENCE[token.op] ||
          (PRECEDENCE[top.op] === PRECEDENCE[token.op] && !RIGHT_ASSOC[token.op])
        )
          output.push(stack.pop()!);
        else break;
      }
      stack.push(token);
      continue;
    }
    if (token.kind === "lparen") {
      stack.push(token);
      continue;
    }
    if (token.kind === "rparen") {
      while (stack.length && stack[stack.length - 1].kind !== "lparen") output.push(stack.pop()!);
      if (!stack.length) throw new Error("Parênteses desbalanceados");
      stack.pop();
      continue;
    }
  }
  while (stack.length) {
    const token = stack.pop()!;
    if (token.kind === "lparen" || token.kind === "rparen") throw new Error("Parênteses desbalanceados");
    output.push(token);
  }
  return output;
}

function evalRpn(rpn: Token[], vars: Record<string, number>): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token.kind === "num") {
      stack.push(token.value);
      continue;
    }
    if (token.kind === "ident") {
      const v = vars[token.name];
      // Variável ausente ou não-numérica → NaN (propaga sem lançar).
      stack.push(typeof v === "number" ? v : NaN);
      continue;
    }
    if (token.kind === "op") {
      if (token.op === "u-") {
        const operand = stack.pop();
        if (operand === undefined) throw new Error("Expressão inválida");
        stack.push(-operand);
        continue;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) throw new Error("Expressão inválida");
      switch (token.op) {
        case "+":
          stack.push(left + right);
          break;
        case "-":
          stack.push(left - right);
          break;
        case "*":
          stack.push(left * right);
          break;
        case "/":
          stack.push(right === 0 ? NaN : left / right);
          break;
      }
    }
  }
  if (stack.length !== 1) throw new Error("Expressão inválida");
  return stack[0];
}

/**
 * Avalia uma fórmula com as variáveis dadas.
 * Expressão vazia → NaN. Divisão por zero → NaN. Sintaxe inválida → throw.
 */
export function evaluateFormula(expr: string, vars: Record<string, number>): number {
  if (!expr || !expr.trim()) return NaN;
  const tokens = tokenize(expr);
  const rpn = toRpn(tokens);
  return evalRpn(rpn, vars);
}

/**
 * Extrai os nomes únicos de variáveis (colunas) referenciadas na fórmula.
 * Em erro de parsing retorna lista vazia.
 */
export function extractFormulaVariables(expr: string): string[] {
  try {
    const tokens = tokenize(expr);
    const names = new Set<string>();
    for (const token of tokens) {
      if (token.kind === "ident") names.add(token.name);
    }
    return [...names];
  } catch {
    return [];
  }
}

/**
 * Constrói o mapa de variáveis a partir das linhas da view:
 * 1 linha (KPI view) → valor direto; N linhas → soma por coluna.
 * Ignora null/undefined e valores não-numéricos; lê números em string.
 */
export function buildFormulaVarsFromRows(rows: Record<string, unknown>[]): Record<string, number> {
  if (rows.length === 0) return {};
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key);
  const vars: Record<string, number> = {};
  for (const key of keys) {
    const values: number[] = [];
    for (const row of rows) {
      const raw = row[key];
      if (raw == null) continue;
      const num = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (!isNaN(num)) values.push(num);
    }
    if (values.length !== 0) {
      vars[key] = rows.length === 1 ? values[0] : values.reduce((acc, v) => acc + v, 0);
    }
  }
  return vars;
}
