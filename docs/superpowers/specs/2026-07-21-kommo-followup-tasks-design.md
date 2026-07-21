# Florelle — Kommo + Follow-up + Tasks UX
**Data:** 2026-07-21  
**Status:** Aprovado pela usuária

---

## Escopo

5 melhorias independentes no `index.html` (app single-file HTML/JS, localStorage, GitHub Pages):

1. Integração com Kommo CRM (sync de leads)
2. Follow-up automático de leads (24h e 72h)
3. UX da aba Tarefas — filtro padrão e tarefas por etapa
4. Destaque visual de tarefas em atraso
5. Campo `dataCasamento` — já existe, sem alteração estrutural

---

## 1. Kommo Integration

### Armazenamento
- `localStorage` key: `florelle_kommo` → `{ apiKey: string, subdomain: string, lastSync: number|null }`

### UI
- Novo item no hmenu: **"⚙️ Configurações"** → abre modal `#cfg-modal`
- Modal contém:
  - Input "Subdomínio Kommo" (ex: `florelle` para `florelle.kommo.com`)
  - Input "API Token" (token de longa duração da integração privada)
  - Botão "Salvar" → persiste em localStorage
  - Separador
  - Botão "Sincronizar do Kommo" (habilitado só se subdomain + apiKey estiverem preenchidos)
  - Status da última sync: "Última sincronização: 21/07/2026 às 14:32" ou "Nunca sincronizado"

### `syncKommo()` — lógica
```
GET https://{subdomain}.kommo.com/api/v4/leads
  ?with=contacts
  &filter[created_at][from]={unixTimestamp 7 dias atrás}
  &limit=250
Headers: { Authorization: 'Bearer {apiKey}' }
```

Para cada lead em `_embedded.leads[]`:
- `nome` = `_embedded.contacts[0].name` (ou `lead.name` como fallback)
- `telefone` = primeiro valor em `_embedded.contacts[0].custom_fields_values` onde `field_code === 'PHONE'`, normalizado (só dígitos, sem +55)
- `crd` = `lead.created_at * 1000` (ms)

Deduplicação: se já existe noiva em `DATA` com mesmo telefone (normalizado) → pular.

Noiva criada: `{ id: uid(), crd, nome, telefone, etapa: 'lead', _kommoId: lead.id }`

Ao final: `save()` + `renderAll()` + toast `"X noivas adicionadas, Y já existiam"`.

### Erro CORS
Se o fetch retornar erro de rede/CORS: exibir mensagem `"Erro ao conectar ao Kommo. Verifique o subdomínio e o token."` no modal.

---

## 2. Follow-up Automático

### Novos tipos em `TASK_TYPES`
```js
followupPortfolio: { ico: '📸', label: 'Follow-up portfólio', bg: '#EEF0F8' }
followupFinal:     { ico: '💬', label: 'Follow-up final',     bg: '#FEF4EA' }
```

### Geração em `buildTasks()`
Condição: noiva na etapa `lead` **ou** `retomar`.

```js
const d24 = isoDate(b.crd + 24 * 3600000);  // 24h após criação
const d72 = isoDate(b.crd + 72 * 3600000);  // 72h após criação
tasks.push({ id: 'fu24-' + bid, bid, nome, type: 'followupPortfolio', date: d24, done: false, auto: true });
tasks.push({ id: 'fu72-' + bid, bid, nome, type: 'followupFinal',     date: d72, done: false, auto: true });
```

`isoDate(ms)` = converte timestamp em `'YYYY-MM-DD'`.

`done` é controlado pelo `florelle_tv_done` (mesmo mecanismo dos outros auto-tasks).

---

## 3. UX da Aba Tarefas — Filtro e Visibilidade por Etapa

### 3a. Filtro padrão
Alterar `let _tvFilter = 'all'` → `let _tvFilter = 'pend'`

Resultado: ao abrir a aba, só aparecem tarefas **não concluídas**.

### 3b. Tarefas por etapa
Tarefas de processo só aparecem se a noiva ainda está na etapa relevante:

| Tarefa | Condição atual | Nova condição |
|--------|---------------|---------------|
| sílicaIn / sílicaOut | casamento passou + tem dataSilica/dataBuque | **+** etapa em `['secagem']` |
| montagem | casamento passou + tem data | **+** etapa em `['secagem', 'montagem']` |
| entrega | tem dataCasamento | **+** etapa em `['secagem','montagem','embalado','contratoAssinado','reserva']` |
| confirmação | tem dataCasamento | **+** etapa em `['secagem','montagem','embalado','contratoAssinado','reserva']` |
| contrato | etapa contratoEnviado | sem mudança |
| cobrança | tem pagamentos/reserva | sem mudança (já é condicionada ao status pago) |

---

## 4. Destaque Visual de Tarefas em Atraso

### Badge (já existe)
`updTvBadge()` já conta e exibe `tv-bdg`. Os follow-ups entram automaticamente na contagem.

### Destaque de item
Em `renderTasks()`, adicionar classe `late-item` quando `d < 0 && !t.done`:

```js
`<div class="tv-item${t.done?' done-item':isLateItem?' late-item':''}" ...>`
```

CSS:
```css
.tv-item.late-item { border-color: #D4A8A0; background: #FEF4F3; }
```

---

## 5. Campo Data do Casamento

Já existe no modelo (`dataCasamento`), no formulário (`m-cas`) e no card (texto + pill colorido de countdown). **Sem mudanças.**

---

## Deploy
- Bump `sw.js` timestamp após todas as alterações
- `git add index.html sw.js && git commit && git push origin main`
