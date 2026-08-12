/**
 * Schema declarativo de providers CRM/ERP.
 *
 * Cada entrada gera form + persistência em `crm_auditor_connections.credentials`
 * + dispatch da edge function `sync-<provider>`. Kommo conecta por token direto:
 * subdomain + access_token (API v4 da Kommo).
 */

export type FieldType = 'text' | 'password';
export type ProviderCategory = 'crm' | 'erp' | 'marketing';

export interface ProviderField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
}

export interface ProviderSchema {
  key: string;
  displayName: string;
  category: ProviderCategory;
  blurb: string;
  syncFunction: string;
  helpUrl?: string;
  fields: ProviderField[];
}

export const PROVIDER_SCHEMAS: Record<string, ProviderSchema> = {
  kommo: {
    key: 'kommo',
    displayName: 'Kommo (amoCRM)',
    category: 'crm',
    blurb: 'Subdomínio + Long-Lived Access Token. Sem OAuth — copie do painel da Kommo.',
    syncFunction: 'sync-kommo',
    helpUrl: 'https://www.kommo.com/developers/content/oauth/oauth-long-lived-token/',
    fields: [
      {
        key: 'subdomain',
        label: 'Subdomínio',
        type: 'text',
        placeholder: 'minha-empresa (sem .kommo.com)',
        required: true,
      },
      {
        key: 'access_token',
        label: 'Access Token (Long-Lived)',
        type: 'password',
        placeholder: 'Kommo → Settings → Integrations → Create your own integration',
        required: true,
      },
    ],
  },
  ploomes: {
    key: 'ploomes',
    displayName: 'Ploomes',
    category: 'crm',
    blurb: 'CRM por API key (OData). Cole sua User-Key.',
    syncFunction: 'sync-ploomes',
    helpUrl: 'https://help.ploomes.com/hc/pt-br/articles/360000538568',
    fields: [
      {
        key: 'api_key',
        label: 'Ploomes API key (User-Key)',
        type: 'password',
        placeholder: 'Ploomes → Configurações → API → User-Key',
        required: true,
      },
    ],
  },
  omie: {
    key: 'omie',
    displayName: 'Omie ERP',
    category: 'erp',
    blurb: 'app_key + app_secret per-tenant. Sincroniza Clientes → contatos unificados.',
    syncFunction: 'sync-omie',
    helpUrl: 'https://developer.omie.com.br/service-list/',
    fields: [
      {
        key: 'app_key',
        label: 'App Key',
        type: 'text',
        placeholder: 'Omie → Aplicativos → Integração',
        required: true,
      },
      {
        key: 'app_secret',
        label: 'App Secret',
        type: 'password',
        required: true,
      },
    ],
  },
};

export const SECRET_PLACEHOLDER = '••••••••••••••••';

export const isSchemaProvider = (provider: string | null | undefined): boolean => {
  const p = (provider ?? '').toLowerCase();
  return p in PROVIDER_SCHEMAS;
};
