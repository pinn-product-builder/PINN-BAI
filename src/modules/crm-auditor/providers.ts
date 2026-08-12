/**
 * Catálogo de provedores de CRM — provider-agnóstico. Cada provedor declara só os
 * CAMPOS DE CREDENCIAL (o wizard renderiza o form dinamicamente) e se já tem sync
 * funcional (edge `sync-<id>`). Adicionar um CRM = uma entrada aqui + a edge de
 * sync correspondente. Nada hardcoded no wizard.
 */

export interface CredentialField {
  key: string;
  label: string;
  type?: 'text' | 'password';
  placeholder?: string;
  help?: string;
}

export interface ProviderDef {
  id: string;
  label: string;
  /** Tem edge `sync-<id>` funcional escrevendo no schema canônico (crm_leads…). */
  syncReady: boolean;
  credentialFields: CredentialField[];
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'kommo',
    label: 'Kommo',
    syncReady: true,
    credentialFields: [
      { key: 'subdomain', label: 'Subdomínio', placeholder: 'minhaempresa (de minhaempresa.kommo.com)' },
      { key: 'access_token', label: 'Access Token (Long-Lived)', type: 'password', help: 'Kommo > Configurações > Integrações > crie um token de longa duração' },
    ],
  },
  {
    id: 'ploomes',
    label: 'Ploomes',
    syncReady: true,
    credentialFields: [
      { key: 'api_key', label: 'User Key (API)', type: 'password', help: 'Ploomes > Administração > Integrações > Chave de API' },
    ],
  },
  {
    id: 'pipedrive',
    label: 'Pipedrive',
    syncReady: true,
    credentialFields: [
      { key: 'company_domain', label: 'Domínio da empresa', placeholder: 'minhaempresa (de minhaempresa.pipedrive.com)' },
      { key: 'api_token', label: 'API Token', type: 'password', help: 'Pipedrive > Configurações pessoais > API' },
    ],
  },
  {
    id: 'hubspot',
    label: 'HubSpot',
    syncReady: true,
    credentialFields: [
      { key: 'access_token', label: 'Private App Token', type: 'password', help: 'HubSpot > Configurações > Integrações > Apps privados (escopos crm.objects.deals/contacts read)' },
    ],
  },
  {
    id: 'rd_station',
    label: 'RD Station CRM',
    syncReady: false,
    note: 'Conector em desenvolvimento — credenciais já são salvas.',
    credentialFields: [
      { key: 'token', label: 'Token da instância', type: 'password', help: 'RD Station CRM > Configurações > Integrações > Token' },
    ],
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
