# Florelle SaaS — Fase 1: Auth + Isolamento de Dados

## What This Is

Florelle é um app de gestão de pedidos para negócios de buquês eternizados (preservação de flores em sílica, quadros/cúpulas) — hoje um PWA single-file 100% client-side (vanilla JS + localStorage + Google Drive/Calendar da conta pessoal da Bruna). Esta fase transforma a base de dados de single-tenant (uma empresa, um dono) para multi-tenant: N empresas, cada uma logada com sua própria conta, dados completamente isolados uns dos outros, mantendo a Bruna (Florelle) funcionando 100% durante e depois da migração.

## Core Value

Cada empresa cliente faz login e só enxerga os próprios dados — isolamento real e comprovado (não apenas por convenção de UI), sem quebrar a operação da Florelle durante a transição.

## Business Context

- **Customer**: Outras empresas de buquês eternizados (preservação de flores para noivas) — Florelle é a primeira cliente real do novo schema
- **Revenue model**: Assinatura recorrente (SaaS)
- **Success metric**: Login funcional + isolamento de dados comprovado entre 2+ contas de teste, sem perda de dados da Florelle
- **Strategy notes**: `prompt-master-fase1-multitenant.md` (raiz do repo) — briefing original desta fase; Fase 1 de um plano de 4 fases (Fase 2: Google OAuth por cliente; Fase 4: cobrança/Stripe — não detalhadas ainda)

## Requirements

### Validated

<!-- Inferred from existing Florelle codebase — single-tenant, funcionando hoje -->

- ✓ Kanban de pedidos com colunas de status — existing
- ✓ Contratos com fluxo de assinatura (via Cloudflare Worker) — existing
- ✓ Controle financeiro — existing
- ✓ Inventário — existing
- ✓ Lembretes/tarefas — existing
- ✓ Sincronização entre dispositivos via Cloudflare Worker (`/data`) — existing
- ✓ Integração Google Drive/Calendar/Tasks (OAuth da conta pessoal da Bruna) — existing
- ✓ Integração Kommo CRM (sync de leads) — existing
- ✓ Análise de WhatsApp via Claude API (extração de dados da noiva) — existing

### Active

- [ ] Levantamento completo de todas as estruturas hoje em `localStorage` (kanban/buquês, contratos, financeiro, inventário, lembretes, config) com desenho de tabela Postgres equivalente para cada uma
- [ ] Projeto Supabase criado com tabela `clients` (empresa) + todas as tabelas de dados referenciando `client_id uuid not null`
- [ ] Row Level Security ativa em todas as tabelas: usuário só lê/escreve linhas do próprio `client_id` (ou vínculo usuário↔cliente, se decidido que um cliente pode ter múltiplos usuários — decisão a documentar)
- [ ] Tela de login/cadastro via Supabase Auth (email + senha, sem redes sociais por enquanto)
- [ ] Sessão persistente (refresh token) — não pedir login toda vez que abre o PWA
- [ ] Fluxo de "esqueci minha senha" funcional
- [ ] Migração incremental da camada de dados de `localStorage` → Supabase, uma funcionalidade por vez (Kanban → financeiro → inventário → contratos), mantendo a MESMA interface visual, testando cada etapa antes de avançar
- [ ] Dados reais da Florelle migrados para o novo schema sem perda, tratando a Florelle como o primeiro "cliente" real

### Out of Scope

- Google Calendar/Drive OAuth por cliente — Fase 2, não mexer agora
- Cobrança/Stripe/assinatura — Fase 4
- Redesign de UI/UX do Kanban, cards, formulários — fica pra depois (prompt de QA separado); nesta fase a interface não muda visualmente
- Painel de admin completo — só o mínimo funcional pra Bruna ver quais clientes existem, sem polimento

## Context

- Codebase mapeado em `.planning/codebase/` (ARCHITECTURE.md, STACK.md, INTEGRATIONS.md, etc.) — app monolítico em `index.html` (~6200 linhas), sem build step, deploy direto no GitHub Pages
- Backend hoje é um Cloudflare Worker (`worker.js`) com Cloudflare KV como storage — endpoints de sync (`/data`), assinatura de contrato (`/sign`), integração Kommo e análise de WhatsApp via Claude
- Stack nova (Supabase) roda em paralelo/substituição à camada de storage atual — decisão já travada pela Bruna, não é para reabrir essa escolha nem propor Firebase como alternativa
- Regra de trabalho pedida no briefing original: nunca marcar algo como concluído sem testar; se travar em decisão que muda comportamento pro usuário final, parar e perguntar — decisões técnicas de implementação, decidir e documentar

## Constraints

- **Tech stack**: Supabase (Postgres + Auth + RLS) obrigatório — não usar Firebase, não propor alternativa
- **Auth**: Email + senha via Supabase Auth apenas — sem OAuth social nesta fase
- **Isolamento**: Por `client_id` + RLS no Postgres — não isolamento por schema separado por empresa
- **Continuidade**: A conta da Bruna (Florelle) precisa continuar funcionando 100% durante e depois da migração — sem downtime perceptível pra ela
- **Segurança/contas**: Claude não deve criar contas em serviços de pagamento nem inserir credenciais — avisar a Bruna quando precisar de conta/API key criada manualmente
- **Escopo de fase**: Só Fase 1 (auth + isolamento) — não adiantar Fase 2 (OAuth por cliente) nem Fase 4 (Stripe)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase em vez de Firebase | Decisão já tomada pela Bruna antes desta sessão; Postgres + RLS nativo se encaixa no modelo de isolamento por linha | — Pending |
| Isolamento por `client_id` + RLS (não schema separado) | Mais simples de operar e migrar incrementalmente com N clientes pequenos | — Pending |
| Login email+senha, sem social login | Reduz escopo da Fase 1; pode ser adicionado depois | — Pending |
| Migração incremental por funcionalidade (Kanban → financeiro → inventário → contratos) | Evita quebrar a operação real da Bruna durante a transição | — Pending |
| Usar `.planning/` do GSD no lugar do `PROGRESS.md` manual pedido no briefing original | Mesma função (não perder contexto entre sessões) já coberta nativamente pelo framework, evita duplicação | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-09 after initialization*
