# Phase 1: Schema, Modelo Multi-Tenant & RLS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 1-Schema, Modelo Multi-Tenant & RLS
**Areas discussed:** Multi-usuário por cliente, Nomenclatura do schema, Workflow por tenant

---

## Multi-usuário por cliente

| Option | Description | Selected |
|--------|-------------|----------|
| 1 usuário por cliente | Cada empresa loga com 1 conta só (só a Bruna hoje) | |
| N usuários por cliente | Empresa já espera ter mais de uma pessoa logando (ex: funcionária) | ✓ |

**User's choice:** "mais usuarios por clientes" — confirmado via resposta livre à pergunta original sobre áreas a discutir.
**Notes:** Não muda o schema em si (a tabela `user_clients` já cobria os dois casos por decisão de pesquisa anterior), mas fecha a decisão explicitamente marcada como pendente em PROJECT.md/SCHM-03.

---

## Nomenclatura do schema

| Option | Description | Selected |
|--------|-------------|----------|
| Português | Nomes de tabelas/colunas espelhando os campos atuais do app (nome, dataCasamento, etapa) | ✓ |
| Inglês | Convenção comum de SaaS/dev | |

**User's choice:** "nomenclatura sempre em português"
**Notes:** Reduz tradução mental entre o app existente e o banco novo; considerado `costly` de reverter depois (afeta Data Access Layer e possivelmente RLS policies).

---

## Workflow por tenant

| Option | Description | Selected |
|--------|-------------|----------|
| Estágios fixos e compartilhados | Todas as empresas usam os mesmos estágios da Florelle hoje | |
| Só renomear/recolorir | Número e ordem fixos, cliente só muda nome/cor | |
| Total — adicionar/remover/reordenar | Cliente controla estágios inteiros, precisa de tabela própria por client_id | ✓ |

**User's choice:** "estagios ja vem preenchidos mas cliente pode alterar" (resposta inicial) → "Total — adicionar/remover/reordenar" (follow-up de escopo)
**Notes:** Estágios nascem pré-preenchidos com os labels/cores atuais da Florelle (`COLS`) como default de cada empresa nova, mas totalmente editáveis depois. Implica tabela `estagios` própria por `client_id`, não uma coluna de config estática.

---

## Claude's Discretion

- Formato exato das tabelas de domínio (normalizado vs. JSONB para `pagamentos`/`lembretes`) — depende do levantamento completo do localStorage (SCHM-01), ainda não feito.
- Ferramenta de escrita/versionamento do schema (SQL Editor + arquivo `.sql` versionado, por recomendação da pesquisa).
- Nomenclatura interna exata da função `SECURITY DEFINER` e da tabela de estágios.

## Deferred Ideas

None — discussion stayed within phase scope.
