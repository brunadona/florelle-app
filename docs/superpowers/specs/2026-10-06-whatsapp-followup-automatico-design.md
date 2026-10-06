# Florelle — Follow-up automático no WhatsApp
**Data:** 2026-10-06
**Status:** Design aprovado pela usuária (aguardando revisão do documento)

---

## Objetivo

Noivas que chamam a Florelle no WhatsApp **pelo anúncio** e somem recebem até 2 follow-ups automáticos, sem a Bruna cadastrar nada. Nunca atropelar conversa em andamento, nunca insistir com quem fechou, desistiu ou achou caro.

Fora do escopo: Kommo (abandonado), remarketing de anúncios, qualquer coisa da Fase 1 SaaS (Supabase). Quando o SaaS existir, a lista migra para lá.

---

## Pré-requisito bloqueante (passo 0)

Antes de qualquer código: a Bruna confirma que o número atual do WhatsApp Business pode ser ligado à **WhatsApp Cloud API em coexistência** (app do celular + API no mesmo número, com eco das mensagens enviadas pelo celular via webhook). Se não for possível, o projeto para aqui — número novo não serve (as noivas falam com o número atual).

Também no passo 0: confirmar o nome exato do campo de webhook de eco (`smb_message_echoes` ou equivalente) e que mensagens de anúncio chegam com `referral.source_type = "ad"`.

---

## Regras de negócio

| Regra | Comportamento |
|---|---|
| Quem entra | Só conversa cuja primeira mensagem da noiva chega com `referral` de anúncio (clique para WhatsApp). Demais contatos são ignorados. |
| Relógio | Base = última mensagem **humana da Bruna**. Follow-up só sai se a última mensagem da conversa é da Bruna (bola com a noiva). Mensagens automáticas não reiniciam o relógio. |
| Cadência | 1º follow-up 2 dias após a base; 2º follow-up 7 dias após a base; depois encerra (`concluido`). |
| Noiva responde | Relógio zera (contador de follow-ups volta a 0) e a mensagem é classificada (ver abaixo). |
| Última msg é da noiva | Nenhum follow-up; status "aguardando você responder". |
| Horário | Envio só entre 9h e 19h (America/Sao_Paulo, UTC−3). Vencido fora da janela → sai na próxima checagem dentro dela. |
| Fechou | Telefone presente em `florelle_app_data` (dados do app já sincronizados no KV) → `fechou`, para de vez. |
| Parar manual | Botão "Parar" no app (invisível para a noiva) → `parado_manual`. "Reativar" volta para ativo e zera contador. |
| Objeção | Classificador marca `caro`, `sem_condicoes_agora` ou `sem_interesse` → para e guarda o motivo. Na dúvida, para. |
| Botão do template | Toque em "Não tenho interesse" → `sem_interesse` direto, sem classificador. |

### Classificação das respostas

- Só para noivas com registro de follow-up, a cada mensagem recebida.
- Claude `claude-haiku-4-5-20251001` (mesmo modelo/chave `ANTHROPIC_KEY` já usados em `/analyze-wa`), resposta JSON: `{"motivo": "interessada" | "caro" | "sem_condicoes_agora" | "sem_interesse" | "duvida"}`.
- "interessada" e "duvida" mantêm o follow-up ativo; os demais param.
- Exemplo que **não** para: "é mais caro do que pensei, mas vou ver com meu noivo" → `interessada`.
- Falha do Claude (erro/timeout) → lista de palavras reserva: `caro`, `orçamento`, `não consigo`, `agora não`, `não dá`, `depois`, `sem interesse`, `já fechei`. Bateu → para com motivo `palavra_chave`.
- Texto da mensagem **não é armazenado**: classificado e descartado.

---

## Arquitetura

Tudo em `worker.js` (Cloudflare Worker existente, KV `SIGN_KV`). Sem serviço novo.

### Armazenamento

- Chave KV: `fu:<telefone só dígitos, com 55>`.
- O registro inteiro vai no **metadata** da chave (≤1024 bytes) para a checagem horária usar só `list()`, sem `get` por chave.
- TTL: 60 dias, renovado a cada mensagem.

```js
{ n: 'Ana Paula',   // nome do perfil do WhatsApp
  in: 1759600000,   // última msg da noiva (unix s)
  out: 1759610000,  // última msg humana da Bruna (unix s)
  k: 0,             // follow-ups enviados desde a base (0, 1, 2)
  st: 'ativo',      // ativo | concluido | fechou | parado_manual | caro | sem_condicoes_agora | sem_interesse | palavra_chave | erro
  err: '' }         // motivo do erro de envio, se houver
```

### Rotas novas

| Rota | Quem chama | O que faz |
|---|---|---|
| `GET /wa-webhook` | Meta | Verificação (`hub.verify_token` = `WA_VERIFY`). |
| `POST /wa-webhook` | Meta | Valida `X-Hub-Signature-256` com `WA_APP_SECRET` (rejeita sem assinatura válida). Mensagem recebida → cria/atualiza registro + classifica. Eco da Bruna → atualiza `out`. Status de falha de envio → `st: 'erro'`, `err`. Responde 200 rápido. |
| `GET /fu` | App | Lista registros (protegido por `checkSecret`, igual às rotas atuais). |
| `POST /fu/<tel>/stop` | App | `st: 'parado_manual'`. |
| `POST /fu/<tel>/resume` | App | `st: 'ativo'`, `k: 0`. |

### Checagem horária

Handler `scheduled()` (Cron Trigger `0 * * * *` configurado no painel da Cloudflare):

1. `list({prefix: 'fu:'})` paginado.
2. Lê telefones das noivas do app em `florelle_app_data` uma vez por execução.
3. Para cada registro aplica a função pura `decidir(reg, agora, telefonesDoApp)` → `nada | marcar_fechou | enviar_1 | enviar_2 | concluir`.
4. Envia template pela Cloud API (`WA_TOKEN`, `WA_PHONE_ID`) e atualiza `k`.
5. Erro de envio → `st: 'erro'` com motivo; **não** tenta de novo automaticamente.

### Modo teste

Variável `FU_TEST_PHONE`: se definida, o worker só envia para esse número (o da Bruna). Liga para as noivas apagando a variável, depois do teste aprovado.

### Segredos (a Bruna cola no painel da Cloudflare — Claude não insere)

`WA_TOKEN`, `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY`, `FU_TEST_PHONE`.

---

## Mensagens (templates, categoria Marketing — rascunho para aprovação da Bruna)

**`florelle_fu1`** (2 dias) — cabeçalho: foto de um quadro pronto
> Oi, {{1}}! Aqui é a Bruna, da Florelle 🌿 Passando pra saber se ficou alguma dúvida sobre a eternização do seu buquê. Posso te mandar mais fotos de trabalhos que já entregamos?

Botões de resposta rápida: `Quero ver mais fotos` · `Não tenho interesse`

**`florelle_fu2`** (7 dias)
> Oi, {{1}}! Um detalhe importante: o buquê dura poucos dias depois do casamento, e atendemos um número limitado de noivas por data. Se quiser garantir a sua, é só me responder por aqui 💐

Botões de resposta rápida: `Quero garantir minha data` · `Não tenho interesse`

`{{1}}` = primeiro nome do perfil do WhatsApp; se vazio, "noiva" ("Oi, noiva!"). Variável nunca no início/fim do texto (regra da Meta).

---

## Tela "Follow-ups" no app (`index.html`)

- Novo item no menu, mesmo padrão visual das abas existentes; nada muda nas outras abas.
- Busca `GET /fu` ao abrir.
- Lista: nome (toque abre `wa.me/<tel>`), situação em português, data da próxima mensagem, botão **Parar** (ativos) ou **Reativar** (parados/objeção).
- Contadores no topo: em follow-up · responderam após follow-up · pararam por preço.
- `esc()` em todo texto vindo do worker (nome do perfil é entrada externa).
- Bump do `sw.js` no deploy.

---

## Teste

- Uma checagem executável (`fu_test.js`, `node fu_test.js`) para `decidir()`: relógio pela msg da Bruna, 2/7 dias, janela 9h–19h, fechou pelo app, parado, última msg da noiva, sem reinício por mensagem automática.
- Teste ponta a ponta em modo teste com o número da Bruna: chamar pelo anúncio, sumir, receber 1º e 2º; responder "achei caro" e confirmar parada; Parar/Reativar pelo app; noiva cadastrada no app não recebe.

---

## Riscos

- **Coexistência indisponível** → projeto não segue (passo 0).
- **Limite de escrita do KV grátis** (1.000/dia): cada mensagem = 1 escrita; folgado para ~30 leads/semana. Se apertar, plano pago US$ 5/mês.
- **Nota de qualidade do número** cai se noivas denunciarem: máximo 2 follow-ups, botão "Não tenho interesse" em todos.
- **Custo**: ~R$ 0,30–0,40 por template de marketing (conferir tabela da Meta); estimativa R$ 25–30/mês.
