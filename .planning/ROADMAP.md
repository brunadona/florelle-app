# Roadmap: Florelle SaaS — Fase 1: Auth + Isolamento de Dados

## Overview

O caminho vai de "zero multi-tenant" a "Florelle rodando 100% sobre Supabase com isolamento comprovado", sem nunca quebrar a operação real da Bruna. Primeiro a base técnica de baixo risco (schema + RLS, depois auth) é construída sem nada depender dela ainda. Em seguida, o isolamento entre tenants é comprovado com um teste real — não presumido. Só então a migração de dados começa, um domínio por vez (Kanban → Financeiro → Inventário → Contratos), cada fatia com fallback para o caminho antigo até ser validada. O último passo fecha o ciclo: confirma zero perda de dados e aposenta o endpoint antigo do Worker.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Schema, Modelo Multi-Tenant & RLS** - Toda estrutura de dados existente ganha tabela Postgres equivalente, com `client_id` e RLS ativos desde a criação
- [ ] **Phase 2: Autenticação Core (Cadastro, Login, Sessão)** - Cadastro, login e sessão persistente via Supabase Auth, com indicador de tenant na UI
- [ ] **Phase 3: Verificação de Email & Redefinição de Senha** - Email transacional confiável via SMTP customizado para verificação de cadastro e "esqueci minha senha"
- [ ] **Phase 4: Verificação de Isolamento Multi-Tenant (Gate)** - Isolamento entre tenants comprovado com contas reais e fetch direto cross-tenant, não presumido por telas vazias
- [ ] **Phase 5: Migração do Kanban** - Kanban de pedidos migrado para Supabase, estabelecendo o padrão de migração incremental com fallback
- [ ] **Phase 6: Migração do Financeiro** - Controle financeiro migrado para Supabase seguindo o padrão do Kanban
- [ ] **Phase 7: Migração do Inventário** - Inventário migrado para Supabase seguindo o padrão comprovado
- [ ] **Phase 8: Migração de Contratos** - Metadados/status de contratos migrados para Supabase, mantendo o blob assinado e o fluxo `/sign` no Worker
- [ ] **Phase 9: Cutover Completo & Confirmação Zero-Perda** - Florelle operando 100% sobre o schema novo em todos os domínios, com zero perda confirmada e `/data` do Worker aposentado

## Phase Details

### Phase 1: Schema, Modelo Multi-Tenant & RLS
**Goal**: Toda estrutura hoje em `localStorage` tem uma tabela Postgres equivalente no Supabase, com `client_id` e Row Level Security ativos desde a criação — antes de qualquer código do app depender disso.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SCHM-01, SCHM-02, SCHM-03, ISOL-01
**Success Criteria** (what must be TRUE):
  1. Existe uma tabela `clients` no Supabase e uma tabela por domínio (kanban/pedidos, contratos, financeiro, inventário, lembretes), cada uma com coluna `client_id not null` referenciando `clients`.
  2. Rodar `SELECT tablename FROM pg_tables WHERE rowsecurity=false` contra o schema novo retorna zero linhas — RLS está ativo em 100% das tabelas de dados.
  3. Toda tabela tem política `USING` e `WITH CHECK` por `client_id`, resolvidas por uma função `SECURITY DEFINER` compartilhada (não lógica duplicada por tabela).
  4. A decisão "1 usuário = 1 cliente" vs "cliente com N usuários" está documentada nas Key Decisions do PROJECT.md e já refletida na estrutura de tabelas (`clients` + `user_clients`).
**Plans**: TBD

### Phase 2: Autenticação Core (Cadastro, Login, Sessão)
**Goal**: Uma pessoa consegue criar conta, logar e continuar logada entre aberturas do PWA — sem que "sem internet" seja confundido com "deslogado" — e sempre vê qual empresa está logada. O refactor da camada de acesso a dados (DAL) é feito aqui como preparação invisível para as migrações de domínio das próximas fases.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-05, UI-01
**Success Criteria** (what must be TRUE):
  1. Uma nova usuária consegue se cadastrar com email e senha e cai numa sessão funcional.
  2. Fechar e reabrir o PWA no mesmo aparelho mantém a sessão logada, sem pedir login de novo.
  3. Reabrir o PWA sem internet não força logout — a sessão fica "stale, tenta de novo depois", não inválida.
  4. A interface mostra em todo momento qual empresa (tenant) está logada.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Verificação de Email & Redefinição de Senha
**Goal**: Emails transacionais (verificação de cadastro e redefinição de senha) chegam de forma confiável via SMTP customizado, sem esbarrar no limite de ~2 emails/hora do provedor padrão do Supabase.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Depois do cadastro, a usuária recebe um email de verificação (via SMTP customizado, não o padrão limitado do Supabase) e consegue confirmar a conta pelo link.
  2. Uma usuária que esqueceu a senha consegue pedir o email de redefinição e chega numa tela dedicada de nova senha que atualiza a credencial com sucesso.
  3. O provedor de SMTP customizado está configurado nas settings de Auth do Supabase (substituindo o padrão), verificável no dashboard.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Verificação de Isolamento Multi-Tenant (Gate)
**Goal**: O isolamento entre tenants é comprovado, não presumido — com contas reais, dados reais, e uma tentativa direta de acessar dado de outro `client_id` que precisa falhar.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: ISOL-02
**Success Criteria** (what must be TRUE):
  1. Existem 2+ contas de teste reais, cada uma populada com dados próprios em todos os domínios.
  2. Um fetch autenticado direto (contornando os filtros de UI/JS do app) tentando ler linhas de outro `client_id` retorna zero linhas em toda tabela testada.
  3. O teste de isolamento é roteirizado/repetível (não um clique manual único) e documentado para ser rodado de novo após cada migração de domínio.
**Plans**: TBD

### Phase 5: Migração do Kanban
**Goal**: O Kanban de pedidos passa a ler/escrever do Supabase como fonte de verdade, com o caminho antigo mantido como fallback até validação — estabelecendo o padrão que as próximas migrações de domínio vão repetir.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: MIGR-01
**Success Criteria** (what must be TRUE):
  1. O board do Kanban lê e escreve via Supabase; o `localStorage` vira espelho offline, não mais fonte de verdade.
  2. Os dados reais e históricos do Kanban/pedidos da Florelle aparecem intactos no schema novo (nenhum card, status ou dado de cliente perdido).
  3. O caminho antigo de escrita do Worker (`/data`) para Kanban é aposentado (somente leitura ou removido), não apenas "sem uso".
  4. O teste de isolamento (Fase 4) é rodado de novo depois dessa migração e continua passando.
**Plans**: TBD

### Phase 6: Migração do Financeiro
**Goal**: O controle financeiro passa a rodar sobre Supabase, seguindo o mesmo padrão comprovado no Kanban.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: MIGR-03
**Success Criteria** (what must be TRUE):
  1. Lançamentos financeiros leem e escrevem via Supabase; `localStorage` vira espelho offline.
  2. Os registros financeiros reais da Florelle (lançamentos, categorias, saldos) aparecem intactos, sem perda.
  3. O caminho antigo (Worker/localStorage) para Financeiro é aposentado, não apenas sem uso.
  4. O teste de isolamento é rodado de novo e continua passando.
**Plans**: TBD

### Phase 7: Migração do Inventário
**Goal**: O inventário passa a rodar sobre Supabase, seguindo o mesmo padrão comprovado nas fases anteriores.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: MIGR-04
**Success Criteria** (what must be TRUE):
  1. Itens de inventário leem e escrevem via Supabase; `localStorage` vira espelho offline.
  2. Os itens reais de inventário da Florelle aparecem intactos, sem perda.
  3. O caminho antigo para Inventário é aposentado, não apenas sem uso.
  4. O teste de isolamento é rodado de novo e continua passando.
**Plans**: TBD

### Phase 8: Migração de Contratos
**Goal**: Contratos migram para Supabase (metadados e status), mantendo o HTML assinado no KV do Worker e o fluxo `/sign` existente intacto — o domínio mais entrelaçado com a infra atual, tratado com mais cuidado.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: MIGR-05
**Success Criteria** (what must be TRUE):
  1. Metadados e status de contratos (vínculo com cliente, estado de assinatura) leem e escrevem via Supabase; `localStorage` vira espelho offline.
  2. O HTML de contrato assinado e o fluxo `/sign` do Worker continuam funcionando sem mudança (decisão travada: o blob fica no KV).
  3. Os contratos reais da Florelle aparecem intactos no schema novo, sem perda.
  4. O teste de isolamento é rodado de novo e continua passando.
**Plans**: TBD

### Phase 9: Cutover Completo & Confirmação Zero-Perda
**Goal**: A Florelle (tenant #1) opera inteiramente sobre o schema novo em todos os domínios, com zero perda de dados confirmada e o endpoint antigo do Worker (`/data`) aposentado.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: MIGR-02
**Success Criteria** (what must be TRUE):
  1. Os 4 domínios (Kanban, Financeiro, Inventário, Contratos) confirmadamente leem/escrevem só via Supabase para a conta da Florelle, sem dependência restante do endpoint `/data` do Worker.
  2. Uma checagem final de integridade confirma que os volumes de dados pré-migração (contagem de pedidos, lançamentos, itens de inventário, contratos) batem com os volumes pós-migração no Supabase — zero registros perdidos.
  3. A Florelle opera normalmente (sem downtime relatado ou dado faltando) por um ciclo completo de operação depois do cutover.
  4. O endpoint `/data` do Worker é removido/desativado, com `localStorage` rebaixado a cache offline em todo o app.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema, Modelo Multi-Tenant & RLS | 0/TBD | Not started | - |
| 2. Autenticação Core (Cadastro, Login, Sessão) | 0/TBD | Not started | - |
| 3. Verificação de Email & Redefinição de Senha | 0/TBD | Not started | - |
| 4. Verificação de Isolamento Multi-Tenant (Gate) | 0/TBD | Not started | - |
| 5. Migração do Kanban | 0/TBD | Not started | - |
| 6. Migração do Financeiro | 0/TBD | Not started | - |
| 7. Migração do Inventário | 0/TBD | Not started | - |
| 8. Migração de Contratos | 0/TBD | Not started | - |
| 9. Cutover Completo & Confirmação Zero-Perda | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-09*
*Granularity: fine (9 phases)*
