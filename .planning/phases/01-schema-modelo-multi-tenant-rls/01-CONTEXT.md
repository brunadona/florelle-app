# Phase 1: Schema, Modelo Multi-Tenant & RLS - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Toda estrutura hoje em `localStorage` ganha uma tabela Postgres equivalente no Supabase, com `client_id` e Row Level Security ativos desde a criação — antes de qualquer código do app depender disso. É uma fase 100% backend/schema: nada de UI, nada de auth ainda, nada de migração de dados reais. Schema + RLS construídos e revisáveis com zero risco pro app em produção, porque nada aponta pra eles ainda.

</domain>

<decisions>
## Implementation Decisions

### Multi-tenant e isolamento (já travado antes da discussão, carregado de PROJECT.md/pesquisa)
- **D-01:** Isolamento por `client_id` + RLS no Postgres, não schema separado por empresa — **Reversibility:** one-way — mudar pra schema-per-tenant depois exigiria remigrar todos os dados e reescrever todas as policies.
- **D-02:** Tabela `clients` + tabela de junção `user_clients` (`user_id`, `client_id`) desde o início, mesmo com só 1 tenant real hoje (Florelle) — **Reversibility:** one-way — retrofitting multiusuário depois de policies já assumirem 1:1 exigiria migrar toda policy e FK.
- **D-03:** Toda policy de RLS resolve `client_id` via função `SECURITY DEFINER` compartilhada (não subquery inline por tabela) — evita recursão de RLS e problema de performance (auth.uid() não wrapado). Toda tabela ganha `USING` e `WITH CHECK`, nunca só `USING`.
- **D-04:** Tabela `clients` inclui `nome`, `nome_exibido`, `cores`, `criado_em` desde a criação — já especificado no briefing original da Bruna (`prompt-master-fase1-multitenant.md`).

### Multi-usuário por cliente (decisão pendente do PROJECT.md — fechada nesta discussão)
- **D-05:** Confirmado: uma empresa cliente pode ter mais de um usuário logando (ex: dona + funcionária), não é 1 usuário = 1 cliente. A tabela `user_clients` (D-02) já cobre isso — nenhuma mudança de schema necessária, mas fecha a decisão documentada como pendente em PROJECT.md/SCHM-03.

### Nomenclatura do schema
- **D-06:** Nomes de tabelas e colunas sempre em português, espelhando os campos que já existem no app hoje (`nome`, `dataCasamento`, `etapa`, `pagamentos`, `lembretes`, etc.) — não traduzir pra inglês. — **Reversibility:** costly — renomear depois exige migrar toda a Data Access Layer e possivelmente RLS policies que referenciam nomes de coluna.

### Workflow (estágios do Kanban) por tenant
- **D-07:** Estágios do Kanban NÃO são fixos/compartilhados entre empresas — cada cliente pode adicionar, remover e reordenar seus próprios estágios (não só renomear/recolorir). Precisa de uma tabela própria de estágios por `client_id` (ex: `estagios` com `id`, `client_id`, `chave`, `rotulo`, `cor`, `ordem`), não uma coluna de config estática. — **Reversibility:** one-way — se nascer como coluna JSON fixa e depois precisar virar tabela relacional, é uma migração de dados real.
- **D-08:** Quando uma empresa nova é criada, seus estágios vêm pré-preenchidos com os labels/cores atuais da Florelle como default (`lead`, ..., `entregue`, `cancelado`) — ponto de partida editável, não um conjunto fixo do sistema.

### Claude's Discretion
- Formato exato das tabelas de domínio (pedidos/kanban, financeiro, inventário, lembretes, contratos) — inclusive se `pagamentos`/`lembretes` viram tabelas filhas normalizadas ou colunas JSONB — fica a critério de quem planeja/executa esta fase, com base no levantamento completo do `localStorage` (SCHM-01) que ainda precisa ser feito. A pesquisa (`research/ARCHITECTURE.md`) recomenda decidir isso só depois desse levantamento.
- Ferramenta usada pra escrever/versionar o schema (SQL Editor do Supabase Dashboard + arquivo `.sql` versionado no repo, por recomendação da pesquisa) — decisão técnica, não teve objeção da Bruna.
- Nome exato da função `SECURITY DEFINER` e da tabela de estágios — nomenclatura interna, segue D-06 (português).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e decisões do projeto
- `.planning/PROJECT.md` — constraints, decisões travadas, contexto de negócio (SaaS multi-tenant, Fase 1 de 4)
- `.planning/REQUIREMENTS.md` — SCHM-01, SCHM-02, SCHM-03, ISOL-01 (requisitos desta fase) e notas de cobertura
- `.planning/ROADMAP.md` — Fase 1: goal, success criteria, dependências
- `prompt-master-fase1-multitenant.md` (raiz do repo) — briefing original da Bruna; especifica `clients (empresa, nome exibido, cores, criado_em)` e regra de nunca marcar concluído sem testar

### Pesquisa desta fase (Supabase/RLS/multi-tenant)
- `.planning/research/STACK.md` — versão do `@supabase/supabase-js`, instalação via CDN UMD (não `+esm`), formato de chaves publishable/secret
- `.planning/research/ARCHITECTURE.md` §"Suggested Build Order" e §"Pattern 1/2" — padrão `clients`+`user_clients`, função `SECURITY DEFINER`, ordem de construção (schema primeiro, zero risco)
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 4, 5, 8 são todos relevantes pra esta fase (RLS desabilitada/parcial, policy incorreta, exposição de service_role, filtro client-side confundido com isolamento, recursão de RLS, performance sem índice/wrap)

### Codebase existente (o que precisa virar tabela)
- `.planning/codebase/STACK.md` — stack atual (vanilla JS, sem build step, CDN)
- `.planning/codebase/ARCHITECTURE.md` — camada de storage atual (`load()`/`save()` em `index.html` linhas 1527-1574)
- `.planning/codebase/INTEGRATIONS.md` — Cloudflare KV, endpoints do Worker que não mudam nesta fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum componente de schema/backend reaproveitável ainda — esta fase cria a base do zero no Supabase, sem tocar em `index.html`.

### Established Patterns
- App atual usa objetos JS "achatados" em português como forma de registro (`bride` com `nome`, `dataCasamento`, `produto`, `etapa`, `pagamentos[]`, `lembretes[]`) — a nomenclatura em português decidida (D-06) mantém esse vocabulário ao migrar pra Postgres, reduzindo tradução mental entre app e banco.
- `COLS` hoje é um array read-only fixo definindo os estágios do Kanban (`index.html`, config de colunas) — vira, por D-07/D-08, uma tabela `estagios` por `client_id`, seedada com os valores atuais de `COLS` como default de cada empresa nova.

### Integration Points
- Nenhuma ainda — Fase 1 não conecta a tabela nova a nenhum código do app (isso começa na Fase 2, com o refactor da Data Access Layer). Esta fase só cria e testa o schema isoladamente via SQL Editor/queries diretas.

</code_context>

<specifics>
## Specific Ideas

- Estágios do Kanban devem nascer pré-preenchidos com os labels/cores que a Florelle já usa hoje, mas totalmente editáveis (adicionar, remover, reordenar) por cada empresa cliente — não é um conjunto fixo do sistema.
- Todo o schema (tabelas, colunas) em português, sem exceção.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Schema, Modelo Multi-Tenant & RLS*
*Context gathered: 2026-08-10*
