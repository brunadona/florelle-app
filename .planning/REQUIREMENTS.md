# Requirements: Florelle SaaS — Fase 1: Auth + Isolamento de Dados

**Defined:** 2026-08-09
**Core Value:** Cada empresa cliente faz login e só enxerga os próprios dados — isolamento real e comprovado, sem quebrar a operação da Florelle durante a transição.

## v1 Requirements

Requirements for this phase. Each maps to roadmap phases.

### Schema & Modelo de Dados

- [ ] **SCHM-01**: Levantamento completo de todas as estruturas hoje em `localStorage` (kanban/buquês, contratos, financeiro, inventário, lembretes, config), com tabela Postgres equivalente desenhada para cada uma
- [ ] **SCHM-02**: Tabela `clients` criada + coluna `client_id` em todas as tabelas de dados, referenciando `clients`
- [ ] **SCHM-03**: Decisão "1 usuário = 1 cliente" vs "cliente pode ter N usuários" tomada e documentada antes de escrever as políticas de RLS

### Autenticação

- [ ] **AUTH-01**: Usuário pode criar conta com email e senha
- [ ] **AUTH-02**: Usuário pode logar e permanecer logado entre aberturas do PWA (sessão persistente via refresh token)
- [ ] **AUTH-03**: Usuário recebe email de verificação após o cadastro, usando SMTP customizado configurado (não o provedor padrão do Supabase, limitado a ~2 emails/hora)
- [ ] **AUTH-04**: Usuário pode redefinir a senha via link enviado por email ("esqueci minha senha"), com tela dedicada de nova senha
- [ ] **AUTH-05**: Sessão não força logout quando o refresh de token falha por estar offline — trata como "stale, tenta de novo depois", não como deslogado

### Isolamento de Dados

- [ ] **ISOL-01**: Row Level Security ativa em todas as tabelas de dados — usuário só lê/escreve linhas do próprio `client_id` (`USING` e `WITH CHECK` em cada policy)
- [ ] **ISOL-02**: Isolamento comprovado com teste real usando 2+ contas populadas com dados — fetch direto tentando acessar dado de outro `client_id`, não apenas comparação de telas vazias

### Migração de Dados

- [ ] **MIGR-01**: Kanban migrado incrementalmente para Supabase, primeiro domínio a passar pela migração, com o caminho antigo (localStorage/Worker) mantido como fallback até ser verificado — estabelece o padrão que os demais domínios repetem
- [ ] **MIGR-02**: Dados reais da Florelle migrados para o novo schema sem perda em todos os domínios, tratando a Florelle como o primeiro cliente (`client_id`) real do sistema — confirmação final após Kanban, Financeiro, Inventário e Contratos estarem migrados
- [ ] **MIGR-03**: Financeiro migrado incrementalmente para Supabase, seguindo o mesmo padrão de fallback comprovado no Kanban, verificado antes de avançar
- [ ] **MIGR-04**: Inventário migrado incrementalmente para Supabase, seguindo o mesmo padrão de fallback comprovado no Kanban, verificado antes de avançar
- [ ] **MIGR-05**: Contratos migrado incrementalmente para Supabase (metadados/status; HTML assinado permanece no KV do Worker via fluxo `/sign` existente), seguindo o mesmo padrão de fallback, verificado antes de avançar

### Interface

- [ ] **UI-01**: Indicador visível na interface mostrando qual empresa (tenant) está logada no momento

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admin

- **ADMIN-01**: Lista mínima de tenants (nome da empresa, data de criação) visível só pra Bruna, somente leitura
- **ADMIN-02**: Painel de admin completo (ações de gestão, analytics)

### Autenticação Avançada

- **AUTHX-01**: Login social (Google/Apple OAuth)
- **AUTHX-02**: Multi-usuário por cliente / fluxo de convite de equipe
- **AUTHX-03**: Magic link / login sem senha
- **AUTHX-04**: MFA/2FA

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Google Calendar/Drive OAuth por cliente | Fase 2 do plano de 4 fases — não mexer agora |
| Cobrança/Stripe/assinatura | Fase 4 do plano de 4 fases |
| Redesign de UI/UX do Kanban, cards, formulários | Fica pra um prompt de QA separado; nesta fase a interface não muda visualmente |
| SSO/SAML, SCIM, RBAC | Convenções de comprador enterprise — não se aplica a pequenas empresas de florista solo, zero demanda real |
| Wizard genérico de importação de dados | Só existe 1 migração real (Florelle) — script único é mais barato que UI de importação reutilizável |
| Big-bang cutover (migrar tudo de uma vez) | Viola a exigência de zero-downtime — migração precisa ser incremental com fallback |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHM-01 | Phase 1 | Pending |
| SCHM-02 | Phase 1 | Pending |
| SCHM-03 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| UI-01 | Phase 2 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| ISOL-01 | Phase 1 | Pending |
| ISOL-02 | Phase 4 | Pending |
| MIGR-01 | Phase 5 | Pending |
| MIGR-03 | Phase 6 | Pending |
| MIGR-04 | Phase 7 | Pending |
| MIGR-05 | Phase 8 | Pending |
| MIGR-02 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 16 total (13 original + MIGR-03, MIGR-04, MIGR-05 added during roadmap creation)
- Mapped to phases: 16/16 ✓
- Unmapped: 0

### Coverage Notes

- Original **MIGR-01** described the whole "Kanban → Financeiro → Inventário → Contratos" incremental sequence as one line item. Since the roadmap (per research and the requested fine-grained shape) gives each domain its own dedicated phase — Contratos in particular needs isolated care due to its entanglement with the Worker's `/sign` KV flow — a single requirement could not honestly map to four different phases without violating one-requirement-one-phase traceability. Resolved by gap-resolution (per roadmapper Step 4): MIGR-01's text was narrowed to the Kanban slice (where the fallback pattern is established and proven, Phase 5), and three new requirements — **MIGR-03** (Financeiro, Phase 6), **MIGR-04** (Inventário, Phase 7), **MIGR-05** (Contratos, Phase 8) — were added so each domain migration phase has its own concrete, independently verifiable requirement.
- **MIGR-02** (zero-loss migration of Florelle's real data) is only fully true once all four domains are migrated, so it is mapped to Phase 9 — the final cutover/confirmation gate — rather than to any single domain phase. Each domain phase (5-8) still carries its own zero-loss success criterion in ROADMAP.md, backed by its own MIGR-0x requirement.
- **ISOL-01** (RLS policies exist) is mapped to Phase 1 (written alongside schema creation, per research recommendation to enable RLS in the same migration that creates each table). **ISOL-02** (isolation proven via real test) is a separate, later gate (Phase 4) — deliberately not folded into Phase 1, since proving isolation requires real auth sessions from Phase 2 first, and research flags shallow "RLS is written" ≠ "isolation is proven" as the most commonly faked verification step in this kind of migration.

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 after roadmap creation — added MIGR-03/04/05, full traceability mapped*
