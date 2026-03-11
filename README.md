## PINN BAI

O **PINN BAI** é a plataforma de inteligência e insights da PINN, criada para consolidar dados de múltiplas fontes, gerar análises e disponibilizar indicadores, relatórios e dashboards que apoiam a tomada de decisão em diferentes áreas de negócio.

Este repositório foi originalmente criado como `pinn-insights-hub` e posteriormente renomeado para refletir de forma mais precisa o posicionamento atual do produto como hub de dados e analytics da PINN.  
Para mais contexto institucional, consulte também o repositório público em [`pinn-product-builder/PINN-BAI`](https://github.com/pinn-product-builder/PINN-BAI).

---

## Visão geral do produto

O PINN BAI atua como um **hub central de dados e inteligência**, permitindo:

- Integração com fontes de dados internas e externas.
- Tratamento, padronização e transformação de dados para uso analítico.
- Geração de métricas, KPIs, relatórios e insights operacionais.
- Disponibilização de dashboards e visualizações para diferentes áreas de negócio.
- Automação de rotinas de monitoramento, acompanhamento e alertas, quando aplicável.

O objetivo da plataforma é oferecer uma **visão única, confiável e acionável** dos dados relevantes para o negócio, reduzindo esforço manual, retrabalho e riscos de inconsistência na informação utilizada para tomada de decisão.

---

## Principais capacidades

- **Catálogo central de indicadores**: métricas de negócio padronizadas, com definições claras e regras de cálculo unificadas.
- **Dashboards e relatórios**: visão consolidada de performance, operação e qualidade, com filtros por cliente, período, unidade de negócio, entre outros eixos.
- **Análises ad hoc**: base única de dados tratada para exploração analítica e construção de novas visões.
- **Monitoramento contínuo**: possibilidade de criação de painéis de monitoramento, alertas e acompanhamento periódico.
- **Integração com outros sistemas**: exposição de dados e insights para aplicações internas, portais, sistemas transacionais ou produtos digitais.

---

## Arquitetura em alto nível

Em alto nível, o PINN BAI é composto por quatro camadas principais:

1. **Ingestão de dados**  
   Responsável por conectar e receber dados de diferentes sistemas de origem (bancos transacionais, APIs externas, sistemas internos, arquivos e outras fontes estruturadas ou semiestruturadas).

2. **Processamento e transformação**  
   Camada onde os dados passam por pipelines (ETL/ELT) para limpeza, padronização, enriquecimento e modelagem, tornando-se adequados para análise e consumo.

3. **Armazenamento**  
   Responsável pela persistência dos dados processados em ambientes apropriados para consulta, análise e histórico (bases relacionais, data warehouses, data lakes ou arquiteturas híbridas).

4. **Exposição de dados e insights**  
   Camada que disponibiliza os dados processados por meio de APIs, serviços, dashboards e visualizações voltadas tanto para usuários de negócio quanto para outros sistemas.

---

## Tecnologias principais

Este repositório concentra principalmente o **frontend web** do PINN BAI, construído com um stack moderno em TypeScript:

- **Linguagem**: TypeScript.
- **Framework de UI**: React 18.
- **Bundler / Dev server**: Vite.
- **Design system e componentes**:  
  - Shadcn UI (baseado em Radix UI)  
  - Tailwind CSS e `tailwindcss-animate`  
  - Ícones `lucide-react`
- **Estado remoto e dados**:  
  - `@tanstack/react-query` para data fetching e cache  
  - `@supabase/supabase-js` para integração com backend e persistência (Supabase).
- **Formulários e validação**: `react-hook-form`, `zod`, `@hookform/resolvers`.
- **Gráficos e visualizações**: `recharts`.
- **Testes**: Vitest, Testing Library (`@testing-library/react`, `@testing-library/jest-dom`).
- **Qualidade de código**: ESLint, TypeScript, configuração baseada em `@eslint/js` e `typescript-eslint`.

Outras tecnologias de dados, infraestrutura e orquestração (por exemplo, pipelines em Airflow/dbt, bancos de dados analíticos ou ferramentas de observabilidade) são definidas em outros serviços e repositórios da PINN e se integram ao PINN BAI conforme o contexto de cada cliente/produto.

---

## Estrutura do repositório

Visão geral das principais pastas e arquivos deste projeto:

- `src/` – Código-fonte principal da aplicação React (páginas, contextos, hooks, componentes de UI, integrações com APIs/Supabase, regras de apresentação e orquestração de telas).
- `public/` – Assets estáticos servidos pela aplicação (ícones, manifestos, imagens, etc.).
- `scripts/` – Scripts auxiliares relacionados à automação do projeto (por exemplo, migração/teste de templates).
- `supabase/` – Artefatos de infraestrutura e configuração relacionados ao Supabase (schemas, políticas, funções, etc.).
- `index.html` – HTML base utilizado pelo Vite.
- `vite.config.ts` / `vitest.config.ts` – Configurações de build, dev server e testes.
- `tailwind.config.ts` / `postcss.config.js` – Configurações de estilo, design system e processamento de CSS.
- `eslint.config.js` – Regras de linting utilizadas no projeto.
- Arquivos auxiliares de documentação, como:
  - `ANALISE_PROJETO.md`
  - `DIAGNOSTICO_DASHBOARD.md`
  - `COMO_VER_LOGS.md`
  - `APLICAR_MIGRACAO_TEMPLATES.md`
  - `TESTE_TEMPLATES.md`

Consulte esses documentos para detalhes específicos sobre diagnósticos, logs, templates e fluxos internos do produto.

---

## Como executar o projeto localmente

### Pré-requisitos

- **Git** instalado.
- **Node.js** (versão compatível com Vite 5 e React 18).  
- Gerenciador de pacotes (**npm** ou **bun** – existe `bun.lock` neste repositório, caso o time utilize Bun em ambientes específicos).
- Acesso às variáveis de ambiente necessárias (arquivo `.env`).

### Passos básicos

1. **Clonar o repositório**

```bash
git clone https://github.com/pinn-product-builder/PINN-BAI.git
cd PINN-BAI
```

2. **Configurar variáveis de ambiente**

- Utilize o arquivo `.env` como referência.  
- Ajuste chaves e endpoints de acordo com o ambiente (desenvolvimento, homologação, produção), incluindo:
  - URL e chave anônima do Supabase.
  - Configurações de autenticação e serviços externos, quando aplicável.

3. **Instalar dependências**

Com `npm`:

```bash
npm install
```

Se o time estiver utilizando Bun:

```bash
bun install
```

4. **Executar o ambiente de desenvolvimento**

Com `npm`:

```bash
npm run dev
```

Com Bun:

```bash
bun run dev
```

O Vite iniciará o servidor de desenvolvimento (por padrão em `http://localhost:5173` ou porta configurada).

5. **Build para produção**

```bash
npm run build
```

ou

```bash
bun run build
```

6. **Preview do build**

```bash
npm run preview
```

---

## Fluxos principais de dados e insights

De forma resumida, os fluxos centrais do PINN BAI envolvem:

- **Ingestão de dados**
  - Coleta de dados de fontes internas e externas.
  - Armazenamento inicial em camada bruta ou área de _raw data_.

- **Processamento e modelagem**
  - Aplicação de regras de limpeza, validação e padronização.
  - Enriquecimento de dados com dimensões e atributos adicionais.
  - Cálculo de métricas e KPIs utilizados em dashboards e relatórios.

- **Camadas analíticas**
  - Organização em camadas como _staging_, _core_ e _marts_ (quando aplicável).

- **Exposição de insights**
  - Disponibilização de dashboards e visualizações para usuários de negócio.
  - Exposição de endpoints de API para integração com outros sistemas.
  - Geração de relatórios, consultas e exportações sob demanda.

Os detalhes de implementação de cada fluxo podem variar conforme o cliente, a fonte de dados e o contexto de uso, sendo documentados nos arquivos específicos deste repositório e em documentos internos do time.

---

## Roadmap e evolução

O PINN BAI é um produto em **evolução contínua**. Alguns temas que podem compor o roadmap incluem:

- Novos conectores e integrações com fontes de dados.
- Expansão do catálogo de métricas e indicadores.
- Criação de dashboards para novas áreas de negócio.
- Implementação de alertas, detecção de anomalias e monitoramento avançado.
- Otimizações de performance, escalabilidade e custo de processamento.

Para acompanhar a evolução mais atual do produto, consulte os boards internos de produto e tecnologia da PINN.

---

## Padrões de contribuição

Para contribuir com o projeto:

1. Crie uma branch a partir da branch principal, seguindo o padrão adotado pelo time, por exemplo:
   - `feature/nome-da-feature`
   - `fix/descricao-curta`
2. Implemente a alteração respeitando os padrões de código, testes e documentação.
3. Atualize os arquivos relevantes, como `README.md`, `CHANGELOG.md` ou documentações complementares.
4. Abra um Pull Request contendo:
   - Contexto do problema.
   - O que foi implementado.
   - Como testar a mudança.
5. Aguarde a revisão e aprovação de pelo menos um responsável pelo repositório.

---

## Contato e suporte

Para dúvidas relacionadas ao PINN BAI, entre em contato com o time responsável pelo produto ou pela área de dados da PINN.

- **Time de referência**: Pinn Product Builder  
- **E-mail**: projetos@pinnpb.com

---

## Licença e uso

Este projeto é de uso **interno** da PINN.  
A distribuição, cópia ou utilização fora dos termos acordados com a empresa **não é permitida**.
