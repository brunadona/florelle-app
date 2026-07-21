# Kommo + Follow-up + Tasks UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar integração Kommo CRM, follow-up automático 24h/72h para leads, limpar UX da aba Tarefas (filtro padrão + filtro por etapa) e destacar tarefas em atraso em vermelho.

**Architecture:** App single-file HTML (`index.html`). Toda lógica em JS inline, estilos em `<style>` inline, HTML na mesma página. Dados em `localStorage`. Deploy via `git push origin main` → GitHub Pages.

**Tech Stack:** HTML/CSS/JS vanilla, localStorage, fetch API (Kommo), GitHub Pages

## Global Constraints

- Arquivo único: `C:\florelle\index.html` — todo HTML, CSS e JS nele
- Não quebrar nenhuma feature existente (Kanban, Contrato, Google Drive, Financeiro, Inventário, Calendário)
- Após todas as mudanças: bump timestamp em `C:\florelle\sw.js` e fazer `git push origin main`
- Sempre usar `save()` + `renderAll()` após modificar `DATA`
- Funções de utilitário existentes: `uid()`, `today()`, `fmt()`, `addDays()`, `g()`, `gv()`, `sv2()`, `_showCalToast()`, `esc()`
- Botão primário: classe `bprim` | Botão secundário: classe `bsec` | Botão salvar: classe `bsav`

---

## Mapa de Arquivos

| Arquivo | O que muda |
|---------|-----------|
| `index.html` — `<style>` | +CSS do modal de configurações e `.tv-item.late-item` |
| `index.html` — `#hmenu` (linha ~786) | +botão "Configurações" |
| `index.html` — após `#hmenu` (linha ~824) | +HTML do modal `#cfg-ov` |
| `index.html` — JS globais (linha ~1473) | +helper `_isoDate()` |
| `index.html` — `const TASK_TYPES` (linha ~4040) | +tipos `followupPortfolio` e `followupFinal` |
| `index.html` — `let _tvFilter` (linha ~4037) | `'all'` → `'pend'` |
| `index.html` — `function buildTasks()` (linha ~4055) | Refatorar sílica/montagem por etapa + add follow-ups |
| `index.html` — `function renderTasks()` (linha ~4184) | +classe `late-item` em itens atrasados |
| `index.html` — JS funções novas (inserir após `tvToggleDone`) | `_kommoCfg()`, `openCfg()`, `closeCfg()`, `saveCfg()`, `syncKommo()` |
| `sw.js` | Bump timestamp |

---

## Task 1: CSS + Modal de Configurações Kommo

**Files:**
- Modify: `C:\florelle\index.html` — bloco `<style>` e HTML após `#hmenu`

**Interfaces:**
- Produz: `#cfg-ov`, `#cfg-kommo-sub`, `#cfg-kommo-key`, `#kommo-sync-btn`, `#kommo-last-sync`, `.cfg-panel`, `.cfg-hd`, `.cfg-title`, `.cfg-bdy`

- [ ] **Step 1: Adicionar CSS do modal de configurações**

No `<style>`, logo após a linha que contém `.bsec:hover{background:var(--ccol);...}` (linha ~229), inserir:

```css
#cfg-ov{position:fixed;inset:0;background:rgba(44,40,37,.52);z-index:1000;display:flex;align-items:center;justify-content:center;padding:14px}
.cfg-panel{background:var(--wh);border-radius:14px;width:100%;max-width:420px;box-shadow:var(--sh3);overflow:hidden;animation:fu .2s ease}
.cfg-hd{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 14px;border-bottom:1px solid var(--bdl)}
.cfg-title{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;color:var(--tx)}
.cfg-bdy{padding:20px}
```

- [ ] **Step 2: Adicionar CSS de tarefa em atraso**

Logo após a linha `.tv-item.done-item{opacity:.5}` (linha ~692), inserir:

```css
.tv-item.late-item{border-color:#D4A8A0;background:#FEF4F3}
```

- [ ] **Step 3: Adicionar botão "Configurações" no hmenu**

Localizar no `#hmenu` a linha:
```html
  <button class="hmi hmi-wa" onclick="openWaImport();closeHMenu()">
```

Inserir **antes** dela (logo após o primeiro `<div class="hmi-sep"></div>`):

```html
  <button class="hmi" onclick="openCfg();closeHMenu()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
    Configurações
  </button>
  <div class="hmi-sep"></div>
```

- [ ] **Step 4: Adicionar HTML do modal de configurações**

Logo após `</div>` que fecha o `#hmenu` (linha ~824, antes do `<!-- BANNER -->`), inserir:

```html
<!-- CFG MODAL -->
<div id="cfg-ov" class="hidden" onclick="if(event.target===this)closeCfg()">
  <div class="cfg-panel" onclick="event.stopPropagation()">
    <div class="cfg-hd">
      <span class="cfg-title">Configurações</span>
      <button class="bcls" onclick="closeCfg()"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
    </div>
    <div class="cfg-bdy">
      <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--txm);margin-bottom:12px">Integração Kommo CRM</div>
      <div class="fg" style="margin-bottom:10px">
        <label class="fl">Subdomínio</label>
        <input id="cfg-kommo-sub" class="fi" type="text" placeholder="Ex: florelle (de florelle.kommo.com)">
      </div>
      <div class="fg" style="margin-bottom:16px">
        <label class="fl">API Token (longa duração)</label>
        <input id="cfg-kommo-key" class="fi" type="password" placeholder="Cole o token aqui">
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="bsav" onclick="saveCfg()" style="flex:1">Salvar</button>
        <button id="kommo-sync-btn" class="bsec" onclick="syncKommo()" style="flex:1">Sincronizar agora</button>
      </div>
      <div id="kommo-last-sync" style="font-size:11px;color:var(--txl);text-align:center"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Verificar visual**

Abrir `C:\florelle\index.html` no navegador → clicar no menu hamburguer (⋯ ou ≡) → confirmar que aparece "Configurações" → clicar → modal abre com campos de subdomínio e token → fechar com X → fecha corretamente.

- [ ] **Step 6: Commit**

```
cd C:\florelle
git add index.html
git commit -m "feat: modal de configuracoes Kommo CRM"
```

---

## Task 2: Funções Kommo (`_kommoCfg`, `openCfg`, `closeCfg`, `saveCfg`, `syncKommo`)

**Files:**
- Modify: `C:\florelle\index.html` — bloco JS (inserir após `function tvToggleDone`)

**Interfaces:**
- Consome: `_kommoCfg()` → `{subdomain, apiKey}` do localStorage `florelle_kommo`
- Consome: `DATA`, `uid()`, `save()`, `renderAll()`, `_showCalToast()`, `gv()`, `sv2()`, `g()`
- Produz: `_kommoCfg()`, `openCfg()`, `closeCfg()`, `saveCfg()`, `syncKommo()`

- [ ] **Step 1: Inserir funções Kommo**

Localizar a linha:
```js
function tvToggleDone(taskId){
```

Inserir **antes** dela o bloco completo:

```js
/* ── KOMMO CRM ───────────────────────────────── */
function _kommoCfg(){try{return JSON.parse(localStorage.getItem('florelle_kommo')||'{}')}catch{return{};}}

function openCfg(){
  const cfg=_kommoCfg();
  sv2('cfg-kommo-sub',cfg.subdomain||'');
  sv2('cfg-kommo-key',cfg.apiKey||'');
  const ts=localStorage.getItem('florelle_kommo_sync');
  const lbl=g('kommo-last-sync');
  if(lbl)lbl.textContent=ts?'Última sync: '+ts:'Nunca sincronizado';
  g('cfg-ov').classList.remove('hidden');
}

function closeCfg(){g('cfg-ov').classList.add('hidden');}

function saveCfg(){
  const sub=gv('cfg-kommo-sub').trim().replace(/\.kommo\.com.*$/i,'').replace(/^https?:\/\//,'');
  const key=gv('cfg-kommo-key').trim();
  localStorage.setItem('florelle_kommo',JSON.stringify({subdomain:sub,apiKey:key}));
  _showCalToast('✅ Configurações salvas.');
}

async function syncKommo(){
  const cfg=_kommoCfg();
  if(!cfg.apiKey||!cfg.subdomain){
    alert('Configure o subdomínio e o token nas Configurações antes de sincronizar.');
    return;
  }
  const btn=g('kommo-sync-btn');
  if(btn){btn.disabled=true;btn.textContent='Sincronizando…';}
  try{
    const from=Math.floor((Date.now()-7*24*3600000)/1000);
    const url=`https://${cfg.subdomain}.kommo.com/api/v4/leads?with=contacts&filter[created_at][from]=${from}&limit=250`;
    const r=await fetch(url,{headers:{'Authorization':'Bearer '+cfg.apiKey,'Content-Type':'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status+' — verifique o token e o subdomínio');
    const data=await r.json();
    const leads=(data._embedded&&data._embedded.leads)||[];
    let added=0,skipped=0;
    leads.forEach(lead=>{
      const contact=lead._embedded&&lead._embedded.contacts&&lead._embedded.contacts[0]||null;
      const nome=(contact?contact.name:null)||lead.name||'Lead Kommo';
      let tel='';
      if(contact&&contact.custom_fields_values){
        const pf=contact.custom_fields_values.find(f=>f.field_code==='PHONE');
        if(pf&&pf.values&&pf.values[0])tel=String(pf.values[0].value).replace(/\D/g,'').replace(/^55/,'');
      }
      const exists=tel?DATA.some(b=>(b.telefone||'').replace(/\D/g,'')===tel):false;
      if(exists){skipped++;return;}
      DATA.push({id:uid(),crd:lead.created_at*1000,nome,telefone:tel,etapa:'lead',_kommoId:lead.id,upd:Date.now()});
      added++;
    });
    if(added>0){save();renderAll();}
    const ts=new Date().toLocaleString('pt-BR');
    localStorage.setItem('florelle_kommo_sync',ts);
    const syncLbl=g('kommo-last-sync');if(syncLbl)syncLbl.textContent='Última sync: '+ts;
    _showCalToast(`✅ ${added} noiva${added!==1?'s':''} adicionada${added!==1?'s':''}, ${skipped} já existia${skipped!==1?'m':''}.`);
  }catch(e){
    _showCalToast('❌ Erro ao conectar ao Kommo: '+e.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Sincronizar agora';}
  }
}
```

- [ ] **Step 2: Verificar salvar configurações**

No navegador: Menu → Configurações → preencher "teste" no subdomínio e "abc123" no token → Salvar → toast "✅ Configurações salvas." aparece → reabrir modal → campos mantêm os valores.

No console: `JSON.parse(localStorage.getItem('florelle_kommo'))` deve retornar `{subdomain:"teste",apiKey:"abc123"}`.

- [ ] **Step 3: Verificar syncKommo sem credenciais**

No console: `localStorage.removeItem('florelle_kommo'); syncKommo()` → deve mostrar alert de "Configure o subdomínio...".

- [ ] **Step 4: Commit**

```
cd C:\florelle
git add index.html
git commit -m "feat: integracao Kommo CRM - configuracoes e sync"
```

---

## Task 3: Follow-up Automático 24h/72h

**Files:**
- Modify: `C:\florelle\index.html` — helper `_isoDate`, `TASK_TYPES`, `buildTasks()`

**Interfaces:**
- Consome: `b.crd` (timestamp ms de criação da noiva), `b.etapa`, `bid`, `nome`
- Produz: tasks com `id:'fu24-{bid}'`, `id:'fu72-{bid}'`, `type:'followupPortfolio'`, `type:'followupFinal'`

- [ ] **Step 1: Adicionar helper `_isoDate`**

Localizar a linha:
```js
function addDays(s,n){
```

Inserir **antes** dela:

```js
function _isoDate(ms){const d=new Date(ms);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
```

- [ ] **Step 2: Adicionar tipos de follow-up em TASK_TYPES**

Localizar:
```js
const TASK_TYPES={
  silicaIn:    {ico:'🌿',label:'Colocar na sílica',           bg:'#EDF4EB'},
```

Adicionar ao final do objeto (antes do `};`):

```js
  followupPortfolio:{ico:'📸',label:'Follow-up portfólio',    bg:'#EEF0F8'},
  followupFinal:    {ico:'💬',label:'Follow-up final',         bg:'#FEF4EA'},
```

O bloco final de `TASK_TYPES` deve ficar:
```js
const TASK_TYPES={
  silicaIn:    {ico:'🌿',label:'Colocar na sílica',           bg:'#EDF4EB'},
  silicaOut:   {ico:'✨',label:'Retirar da sílica',            bg:'#EDF4EB'},
  montagem:    {ico:'🖼️',label:'Início da montagem',          bg:'#EEF0F8'},
  entrega:     {ico:'📦',label:'Entrega / Coleta',             bg:'#FEF8EE'},
  cobranca:    {ico:'💰',label:'Cobrança',                     bg:'#FEF4EA'},
  contrato:    {ico:'📄',label:'Acompanhar contrato',          bg:'#EEF0F8'},
  confirmacao: {ico:'📞',label:'Confirmar retirada do buquê',  bg:'#FEF8EE'},
  lembrete:    {ico:'🔔',label:'Lembrete',                     bg:'#F8F4EF'},
  followupPortfolio:{ico:'📸',label:'Follow-up portfólio',    bg:'#EEF0F8'},
  followupFinal:    {ico:'💬',label:'Follow-up final',         bg:'#FEF4EA'},
};
```

- [ ] **Step 3: Adicionar geração de follow-ups em `buildTasks()`**

Localizar dentro de `buildTasks()` o bloco dos lembretes (após os pagamentos):
```js
    // Lembretes
    const _postCasRE=/s[íi]lica|redoma|montagem|embalagem/i;
```

Inserir **antes** dele:

```js
    // Follow-up automático (lead e retomar conversa)
    if(b.etapa==='lead'||b.etapa==='retomar'){
      tasks.push({id:'fu24-'+bid,bid,nome,type:'followupPortfolio',date:_isoDate(b.crd+24*3600000),done:false,auto:true});
      tasks.push({id:'fu72-'+bid,bid,nome,type:'followupFinal',    date:_isoDate(b.crd+72*3600000),done:false,auto:true});
    }
```

- [ ] **Step 4: Verificar follow-ups no console**

No console do navegador:
```js
// Pegar uma noiva que está em lead
const l = DATA.find(b => b.etapa === 'lead');
if (l) {
  const d24 = _isoDate(l.crd + 24*3600000);
  const d72 = _isoDate(l.crd + 72*3600000);
  console.log('Follow-up 24h:', d24, '— Follow-up 72h:', d72);
  const tasks = buildTasks().filter(t => t.bid === l.id && t.type.startsWith('followup'));
  console.log('Tasks geradas:', tasks.map(t => t.type + ' ' + t.date));
}
```

Esperado: duas tasks `followupPortfolio` e `followupFinal` com datas baseadas em `l.crd`.

- [ ] **Step 5: Verificar na aba Tarefas**

Abrir aba Tarefas → filtro "Todas" → procurar noiva em etapa Lead → deve ver "📸 Follow-up portfólio" e "💬 Follow-up final" com as datas correspondentes.

Marcar "📸 Follow-up portfólio" como concluída (checkbox) → some da view "Pendentes" → permanece ao recarregar página.

- [ ] **Step 6: Commit**

```
cd C:\florelle
git add index.html
git commit -m "feat: follow-up automatico 24h e 72h para leads"
```

---

## Task 4: UX Tarefas — Filtro Padrão + Filtro por Etapa + Destaque Vermelho

**Files:**
- Modify: `C:\florelle\index.html` — `_tvFilter`, `buildTasks()`, `renderTasks()`

**Interfaces:**
- Consome: `b.etapa`, task objects com `{date, done}`
- Produz: filtro padrão `'pend'`, sílica só em `'secagem'`, montagem em `['secagem','montagem']`, classe `late-item` em itens atrasados não concluídos

- [ ] **Step 1: Mudar filtro padrão de 'all' para 'pend'**

Localizar:
```js
let _tvFilter='all';
```

Substituir por:
```js
let _tvFilter='pend';
```

- [ ] **Step 2: Refatorar bloco sílica/montagem em `buildTasks()` para filtrar por etapa**

Localizar o bloco completo:
```js
    // Sílica / montagem — só depois que o casamento ocorreu
    const _casPassou=!b.dataCasamento||b.dataCasamento<=today();
    if(_casPassou){
      if(b.dataSilica){
        tasks.push({id:'silicaIn-'+bid, bid,nome,type:'silicaIn', date:b.dataSilica,           done:false,auto:true});
        tasks.push({id:'silicaOut-'+bid,bid,nome,type:'silicaOut',date:addDays(b.dataSilica,30),done:false,auto:true});
        tasks.push({id:'montagem-'+bid, bid,nome,type:'montagem', date:addDays(b.dataSilica,45),done:false,auto:true});
      } else if(b.dataBuque){
        tasks.push({id:'silicaIn-'+bid, bid,nome,type:'silicaIn', date:addDays(b.dataBuque,2), done:false,auto:true});
        tasks.push({id:'silicaOut-'+bid,bid,nome,type:'silicaOut',date:addDays(b.dataBuque,32),done:false,auto:true});
        tasks.push({id:'montagem-'+bid, bid,nome,type:'montagem', date:addDays(b.dataBuque,47),done:false,auto:true});
      }
    }
```

Substituir por:
```js
    // Sílica / montagem — só depois que o casamento ocorreu
    const _casPassou=!b.dataCasamento||b.dataCasamento<=today();
    if(_casPassou){
      // Sílica: só enquanto em secagem
      if(b.etapa==='secagem'){
        if(b.dataSilica){
          tasks.push({id:'silicaIn-'+bid, bid,nome,type:'silicaIn', date:b.dataSilica,           done:false,auto:true});
          tasks.push({id:'silicaOut-'+bid,bid,nome,type:'silicaOut',date:addDays(b.dataSilica,30),done:false,auto:true});
        } else if(b.dataBuque){
          tasks.push({id:'silicaIn-'+bid, bid,nome,type:'silicaIn', date:addDays(b.dataBuque,2), done:false,auto:true});
          tasks.push({id:'silicaOut-'+bid,bid,nome,type:'silicaOut',date:addDays(b.dataBuque,32),done:false,auto:true});
        }
      }
      // Montagem: secagem ou montagem
      if(b.etapa==='secagem'||b.etapa==='montagem'){
        if(b.dataSilica)
          tasks.push({id:'montagem-'+bid,bid,nome,type:'montagem',date:addDays(b.dataSilica,45),done:false,auto:true});
        else if(b.dataBuque)
          tasks.push({id:'montagem-'+bid,bid,nome,type:'montagem',date:addDays(b.dataBuque,47),done:false,auto:true});
      }
    }
```

- [ ] **Step 3: Adicionar classe `late-item` em `renderTasks()`**

Localizar dentro de `renderTasks()` / na função `renderTasks()` a linha que constrói o `div.tv-item`:
```js
      return `<div class="tv-item${t.done?' done-item':''}" onclick="openModal('${t.bid}')">
```

Substituir por:
```js
      const _isLate=!t.done&&t.date&&t.date<today();
      return `<div class="tv-item${t.done?' done-item':_isLate?' late-item':''}" onclick="openModal('${t.bid}')">
```

- [ ] **Step 4: Verificar filtro padrão**

Recarregar página → ir para aba Tarefas → deve abrir já no filtro "Pendentes" (botão "Pendentes" destacado, tarefas concluídas não aparecem).

- [ ] **Step 5: Verificar filtro por etapa**

No console:
```js
// Verificar que noiva em 'montagem' não tem tasks de silica
const m = DATA.find(b => b.etapa === 'montagem');
if (m) {
  const silicaTasks = buildTasks().filter(t => t.bid === m.id && (t.type === 'silicaIn' || t.type === 'silicaOut'));
  console.log('Silica tasks para noiva em montagem (deve ser 0):', silicaTasks.length);
  const montagemTasks = buildTasks().filter(t => t.bid === m.id && t.type === 'montagem');
  console.log('Montagem tasks para noiva em montagem (deve ter):', montagemTasks.length);
}
```

- [ ] **Step 6: Verificar destaque vermelho**

Criar ou encontrar uma noiva com tarefa com data no passado e não concluída → ir para aba Tarefas → filtro "Em atraso" → items atrasados devem ter borda e fundo vermelho suave (`#FEF4F3`).

- [ ] **Step 7: Commit**

```
cd C:\florelle
git add index.html
git commit -m "fix: tarefas filtro padrao pendentes, silica por etapa, destaque atrasadas"
```

---

## Task 5: Deploy

**Files:**
- Modify: `C:\florelle\sw.js`

- [ ] **Step 1: Bump timestamp no sw.js**

Localizar em `C:\florelle\sw.js` a primeira linha:
```js
// 20260720020000
```

Substituir por (usar data/hora atual no formato YYYYMMDDHHmmSS):
```js
// 20260721010000
```

- [ ] **Step 2: Commit e push**

```
cd C:\florelle
git add index.html sw.js
git commit -m "feat: kommo + follow-up + tasks UX + sw cache bust"
git push origin main
```

- [ ] **Step 3: Verificar deploy**

Aguardar ~30 segundos → abrir `https://brunadona.github.io/florelle-app/` no celular → fechar e reabrir → versão nova deve carregar (modal de Configurações aparece no menu).

---

## Self-Review

### Cobertura do spec
- [x] Kommo settings modal (subdomain + token) → Task 1 + Task 2
- [x] Sync GET /api/v4/leads com deduplicação por telefone → Task 2 `syncKommo()`
- [x] Toast de resultado da sync → Task 2
- [x] Tipos followupPortfolio e followupFinal → Task 3
- [x] Follow-ups gerados para lead e retomar → Task 3
- [x] Follow-ups marcáveis como concluídos (mecanismo TV_DONE existente) → Task 3 verificação
- [x] Badge tv-bdg já conta follow-ups automaticamente (buildTasks + updTvBadge) → coberto
- [x] Filtro padrão 'pend' → Task 4
- [x] Sílica só em etapa secagem → Task 4
- [x] Montagem em secagem + montagem → Task 4
- [x] Embalagem/redoma (lembretes) sem restrição de etapa → NÃO ALTERADO (correto: lembretes passam pelo filtro `_postCasRE` que só bloqueia antes do casamento, independente da etapa)
- [x] late-item CSS e classe → Task 4
- [x] sw.js bump + push → Task 5

### Placeholders
Nenhum "TBD" ou "TODO" encontrado.

### Consistência de tipos
- `_isoDate(ms)` definido em Task 3 Step 1, usado em Task 3 Step 3 ✓
- `_kommoCfg()` definido em Task 2 Step 1, chamada em `openCfg()` e `syncKommo()` no mesmo bloco ✓
- `followupPortfolio` / `followupFinal` definidos em TASK_TYPES (Task 3 Step 2) e usados em buildTasks (Task 3 Step 3) ✓
- `late-item` CSS definido em Task 1 Step 2, classe aplicada em Task 4 Step 3 ✓
- IDs dos tasks de follow-up: `'fu24-'+bid` e `'fu72-'+bid` — estáveis por bride, compatíveis com `tvToggleDone` existente ✓
