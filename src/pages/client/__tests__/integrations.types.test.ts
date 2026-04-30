import { describe, it, expect } from 'vitest';
import type { IntegrationType, Integration } from '@/lib/types';

// Compile-time exhaustive check: every IntegrationType must be handled.
function assertExhaustive(value: never): never {
  throw new Error(`Unhandled IntegrationType: ${String(value)}`);
}

function handleConnect(slug: IntegrationType): string {
  switch (slug) {
    case 'supabase':
    case 'google_sheets':
    case 'csv':
    case 'api':
    case 'ploomes':
    case 'coldmail':
    case 'smartlead':
      return `/import?provider=${slug}`;
    default:
      return assertExhaustive(slug);
  }
}

function handleSync(integration: Pick<Integration, 'id' | 'type'>): IntegrationType {
  // No manual cast — TS must accept all enum values.
  return integration.type;
}

describe('Integrations type-safety', () => {
  const ALL: IntegrationType[] = [
    'supabase', 'google_sheets', 'csv', 'api', 'ploomes', 'coldmail', 'smartlead',
  ];

  it('handleConnect aceita todos os IntegrationType sem cast', () => {
    for (const slug of ALL) {
      expect(handleConnect(slug)).toBe(`/import?provider=${slug}`);
    }
  });

  it('handleSync devolve o type da integração para todos os providers', () => {
    for (const slug of ALL) {
      const fake: Pick<Integration, 'id' | 'type'> = { id: 'x', type: slug };
      expect(handleSync(fake)).toBe(slug);
    }
  });
});
