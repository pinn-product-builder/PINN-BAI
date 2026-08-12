import { describe, it, expect } from 'vitest';
import { evaluateFormula, extractFormulaVariables, buildFormulaVarsFromRows } from './widgetFormula';

describe('evaluateFormula', () => {
  it('aritmética básica', () => {
    expect(evaluateFormula('1 + 2', {})).toBe(3);
    expect(evaluateFormula('10 - 4', {})).toBe(6);
    expect(evaluateFormula('3 * 5', {})).toBe(15);
    expect(evaluateFormula('20 / 4', {})).toBe(5);
  });

  it('precedência e parênteses', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('100 / (2 + 3)', {})).toBe(20);
  });

  it('unário negativo', () => {
    expect(evaluateFormula('-5 + 3', {})).toBe(-2);
    expect(evaluateFormula('-(2 + 3)', {})).toBe(-5);
    expect(evaluateFormula('10 - -5', {})).toBe(15);
  });

  it('variáveis (nomes de colunas)', () => {
    expect(evaluateFormula('conv_30d / leads_30d * 100', { conv_30d: 50, leads_30d: 200 })).toBe(25);
    expect(evaluateFormula('a + b - c', { a: 10, b: 5, c: 3 })).toBe(12);
  });

  it('divisão por zero → NaN (não throw)', () => {
    expect(Number.isNaN(evaluateFormula('10 / 0', {}))).toBe(true);
    expect(Number.isNaN(evaluateFormula('a / b', { a: 5, b: 0 }))).toBe(true);
  });

  it('variável ausente → NaN', () => {
    expect(Number.isNaN(evaluateFormula('a + b', { a: 1 }))).toBe(true);
  });

  it('expressão vazia → NaN', () => {
    expect(Number.isNaN(evaluateFormula('', {}))).toBe(true);
    expect(Number.isNaN(evaluateFormula('   ', {}))).toBe(true);
  });

  it('separador _ em números (1_000 = 1000)', () => {
    expect(evaluateFormula('1_000 + 500', {})).toBe(1500);
  });

  it('lança em sintaxe inválida', () => {
    expect(() => evaluateFormula('1 +', {})).toThrow();
    expect(() => evaluateFormula('(1 + 2', {})).toThrow();
    expect(() => evaluateFormula('1 @ 2', {})).toThrow();
  });
});

describe('extractFormulaVariables', () => {
  it('extrai nomes únicos', () => {
    expect(extractFormulaVariables('a + b * a - c').sort()).toEqual(['a', 'b', 'c']);
  });

  it('retorna lista vazia em erro de parsing', () => {
    expect(extractFormulaVariables('@@@')).toEqual([]);
  });
});

describe('buildFormulaVarsFromRows', () => {
  it('1 linha (KPI view) → valor direto', () => {
    const vars = buildFormulaVarsFromRows([{ leads_30d: 200, conv_30d: 50 }]);
    expect(vars).toEqual({ leads_30d: 200, conv_30d: 50 });
  });

  it('N linhas → soma por coluna', () => {
    const vars = buildFormulaVarsFromRows([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ]);
    expect(vars).toEqual({ x: 6, y: 60 });
  });

  it('ignora null/undefined', () => {
    const vars = buildFormulaVarsFromRows([
      { x: 1 },
      { x: null },
      { x: 3 },
    ]);
    expect(vars).toEqual({ x: 4 });
  });

  it('lê números como string', () => {
    const vars = buildFormulaVarsFromRows([{ a: '5' }, { a: '7' }]);
    expect(vars).toEqual({ a: 12 });
  });
});
