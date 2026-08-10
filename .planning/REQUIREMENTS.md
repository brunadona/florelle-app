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

- [ ] **MIGR-01**: Migração incremental por domínio — Kanban primeiro, depois financeiro, inventário, contratos — com o caminho antigo (localStorage/Worker) mantido como fallback até cada fatia ser verificada
- [ ] **MIGR-02**: Dados reais da Florelle migrados para o novo schema sem perda, tratando a Florelle como o primeiro cliente (`client_id`) real do sistema

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
| SCHM-01 | TBD | Pending |
| SCHM-02 | TBD | Pending |
| SCHM-03 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| AUTH-05 | TBD | Pending |
| ISOL-01 | TBD | Pending |
| ISOL-02 | TBD | Pending |
| MIGR-01 | TBD | Pending |
| MIGR-02 | TBD | Pending |
| UI-01 | TBD | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 after initial definition*
