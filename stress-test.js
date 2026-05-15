/**
 * Florelle — Stress Test
 * Cole no console do browser com florelle.html aberto.
 */
(async function stressTest() {
  'use strict';

  const T = { pass: 0, fail: 0, times: [] };
  function assert(name, cond, detail = '') {
    if (cond) { T.pass++; console.log(`  ✅ ${name}`); }
    else { T.fail++; console.warn(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
  }
  function timed(label, fn) {
    const s = performance.now(); fn(); const ms = (performance.now() - s).toFixed(1);
    T.times.push({ label, ms: +ms });
    console.log(`  ⏱  ${label}: ${ms}ms`);
  }

  console.group('%c🌸 Florelle Stress Test', 'font-weight:700;font-size:14px;color:#5C7050');
  console.log(`  ℹ  Início: ${new Date().toLocaleTimeString('pt-BR')}, dados existentes: ${DATA.length} noivas`);

  // ── Backup ──────────────────────────────────────
  const backup = JSON.parse(JSON.stringify(DATA));

  // ── 1. Gerar 50 noivas ───────────────────────────
  console.groupCollapsed('1. Gerar 50 noivas');
  const ETAPAS = ['lead','retomar','contratoEnviado','contratoAssinado','reserva',
                  'secagem','montagem','embalado','entregue','cancelado'];
  const PRODUTOS = ['quadro25x30','quadro32x42','cupulaG','cupulaM','multiplos','quadroSobMedida'];
  const PAGS = ['pixAVista','pix3x','cartao'];
  const EMBS = ['naoEncomendada','encomendada','emMaos'];
  const NOMES = [
    'Ana Silva','Beatriz Costa','Camila Rocha','Daniela Alves','Elisa Martins',
    'Fernanda Lima','Gabriela Santos','Helena Ferreira','Isabela Pereira','Juliana Souza',
    'Karla Mendes','Letícia Nunes','Mariana Carvalho','Natalia Ribeiro','Olivia Gomes',
    'Patricia Vieira','Quezia Torres','Rafaela Barbosa','Sabrina Moraes','Tatianne Leal',
    'Ursula Melo','Valentina Cruz','Wanda Dias','Ximena Faria','Yasmin Borges',
    'Adriana Campos','Bianca Teixeira','Claudia Ramos','Debora Freitas','Erica Azevedo',
    'Fabiana Pinto','Giovana Cardoso','Helena Nascimento','Ingrid Castro','Jessica Cavalcante',
    'Kelly Correia','Larissa Medeiros','Melissa Brito','Nicole Cunha','Olivia Araujo',
    'Priscila Macedo','Roberta Monteiro','Sandra Viana','Thais Rodrigues','Ursula Pires',
    'Vanessa Castelo','Wendy Lemos','Xuxa Paiva','Yasmin Duarte','Zara Fontes'
  ];

  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rndDate(a, b) {
    const s = new Date(a), e = new Date(b);
    return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().slice(0, 10);
  }
  function rndBRL() { return (800 + Math.random() * 2200).toFixed(2).replace('.', ','); }

  DATA.length = 0;
  const testIds = [];

  timed('Inserir 50 noivas', () => {
    for (let i = 0; i < 50; i++) {
      const etapa = ETAPAS[i % ETAPAS.length];
      const hasSilica = etapa === 'secagem' || etapa === 'montagem';
      const hasPag = Math.random() > 0.25;
      const rec = {
        id: uid(), crd: Date.now() + i, upd: Date.now() + i,
        nome: NOMES[i], etapa,
        dataCasamento: rndDate('2025-06-01', '2027-06-01'),
        produto: rnd(PRODUTOS),
        produtoObs: i % 4 === 0 ? 'Obs produto ' + i : '',
        statusEmbalagem: rnd(EMBS),
        dataEntregaEmbalagem: '',
        formaPagamento: hasPag ? rnd(PAGS) : '',
        dataPagamento: hasPag ? rndDate('2025-01-01', '2026-12-01') : '',
        autorizaReposicao: i % 3 === 0 ? 'sim' : 'nao',
        pecasAdicionais: [], pecasOutro: '',
        dataSilica: hasSilica ? rndDate('2025-03-01', '2026-06-01') : '',
        dataBuque: hasSilica ? rndDate('2025-03-01', '2026-06-01') : '',
        redomaPedida: i % 2 === 0 ? 'sim' : 'nao',
        redomaDataPedido: '',
        embPedida: i % 3 === 0 ? 'nao' : 'sim',
        embPrevisao: '',
        valorTotal: rndBRL(),
        lembretes: i % 4 === 0
          ? [{ id: uid(), text: 'Lembrete teste ' + i, data: rndDate('2025-01-01', '2027-01-01'), auto: false, done: false }]
          : [],
        anotacoes: i % 3 === 0 ? 'Observação de stress test para ' + NOMES[i] : '',
        anexos: [],
        driveFolder: '',
        endereco: 'Rua Teste, ' + (i + 1) + ' - Curitiba/PR',
      };
      DATA.push(rec);
      testIds.push(rec.id);
    }
  });

  assert('50 noivas em DATA', DATA.length === 50, `got ${DATA.length}`);
  const dist = {};
  ETAPAS.forEach(e => dist[e] = DATA.filter(b => b.etapa === e).length);
  console.log('  ℹ  Distribuição por etapa:', dist);
  console.groupEnd();

  // ── 2. Performance de renderização ────────────────
  console.groupCollapsed('2. Performance de renderização');
  timed('renderAll() com 50 noivas', () => renderAll());
  const cards50 = document.querySelectorAll('.bcard').length;
  assert(`50 cards no DOM`, cards50 === 50, `got ${cards50}`);
  timed('renderAll() 2ª vez (DOM já existe)', () => renderAll());
  timed('renderAll() 3ª vez', () => renderAll());
  console.groupEnd();

  // ── 3. localStorage ──────────────────────────────
  console.groupCollapsed('3. localStorage — persistência e tamanho');
  timed('save() com 50 noivas', () => save());
  const stored = localStorage.getItem('florelle_v3');
  assert('Dados persistidos no localStorage', !!stored);
  const sizeKB = (stored.length / 1024).toFixed(1);
  console.log(`  ℹ  Tamanho: ${sizeKB} KB (limite típico: 5.000 KB)`);
  assert('localStorage dentro de 500 KB (sem anexos)', stored.length < 512000, `${sizeKB} KB`);
  const reloaded = JSON.parse(stored);
  assert('50 noivas recarregadas', reloaded.length === 50, `got ${reloaded.length}`);
  assert('Nomes preservados', reloaded.every((b, i) => b.nome === DATA[i].nome));
  assert('Etapas preservadas', reloaded.every(b => typeof b.etapa === 'string' && b.etapa.length > 0));
  assert('IDs únicos', new Set(reloaded.map(b => b.id)).size === 50);
  assert('upd timestamps presentes', reloaded.every(b => b.upd > 0));
  console.groupEnd();

  // ── 4. CRUD ──────────────────────────────────────
  console.groupCollapsed('4. Operações CRUD');

  // Editar card
  const toEdit = DATA[7];
  const origNota = toEdit.anotacoes;
  toEdit.anotacoes = 'EDITADO_STRESS_TEST';
  toEdit.upd = Date.now();
  save();
  const checkEdit = JSON.parse(localStorage.getItem('florelle_v3')).find(b => b.id === toEdit.id);
  assert('Edição persistida', checkEdit?.anotacoes === 'EDITADO_STRESS_TEST');

  // Mover cards entre colunas (simula drag-and-drop)
  const toMove = DATA.slice(0, 5);
  toMove.forEach(b => { b.etapa = 'montagem'; b.upd = Date.now(); });
  timed('save() após mover 5 cards', () => save());
  timed('renderAll() após movimentação', () => renderAll());
  assert('Cards movidos para montagem', DATA.filter(b => b.etapa === 'montagem').length >= 5);

  // Adicionar lembretes
  const withRem = DATA[15];
  const remBefore = withRem.lembretes.length;
  withRem.lembretes.push({ id: uid(), text: 'Lembrete stress added', data: '2026-08-01', auto: false, done: false });
  save();
  assert('Lembrete adicionado', DATA[15].lembretes.length === remBefore + 1);
  assert('Lembrete persistido no localStorage',
    JSON.parse(localStorage.getItem('florelle_v3')).find(b => b.id === withRem.id)?.lembretes?.length === remBefore + 1);

  // Excluir 5 cards
  const toDeleteIds = testIds.slice(45, 50);
  toDeleteIds.forEach(id => {
    const i = DATA.findIndex(x => x.id === id);
    if (i !== -1) DATA.splice(i, 1);
  });
  save();
  assert('5 noivas excluídas', DATA.length === 45, `got ${DATA.length}`);
  timed('renderAll() após exclusão', () => renderAll());
  const cardsAfterDel = document.querySelectorAll('.bcard').length;
  assert('45 cards no DOM após exclusão', cardsAfterDel === 45, `got ${cardsAfterDel}`);
  assert('Excluídas ausentes no localStorage',
    !JSON.parse(localStorage.getItem('florelle_v3')).some(b => toDeleteIds.includes(b.id)));

  // Marcar lembrete como feito
  const remCard = DATA.find(b => b.lembretes.length > 0);
  if (remCard) {
    remCard.lembretes[0].done = true;
    save();
    assert('Lembrete marcado como done', JSON.parse(localStorage.getItem('florelle_v3'))
      .find(b => b.id === remCard.id)?.lembretes[0]?.done === true);
  }

  console.groupEnd();

  // ── 5. Busca ─────────────────────────────────────
  console.groupCollapsed('5. Performance de busca');

  timed('Search "Ana"', () => doSearch('Ana'));
  const anaExpected = DATA.filter(b =>
    (b.nome || '').toLowerCase().includes('ana') || (b.endereco || '').toLowerCase().includes('ana')
  ).length;
  const anaGot = document.querySelectorAll('.bcard').length;
  assert(`Busca "Ana" filtrou ${anaExpected} resultados`, anaGot === anaExpected, `got ${anaGot}`);

  timed('Search "Silva"', () => doSearch('Silva'));
  const silvaExpected = DATA.filter(b =>
    (b.nome || '').toLowerCase().includes('silva') || (b.endereco || '').toLowerCase().includes('silva')
  ).length;
  assert(`Busca "Silva": ${silvaExpected} resultados`, document.querySelectorAll('.bcard').length === silvaExpected);

  timed('Search termo sem resultado "ZZZZQQQQ"', () => doSearch('ZZZZQQQQ'));
  assert('Busca sem resultado retorna 0', document.querySelectorAll('.bcard').length === 0);

  timed('Limpar busca', () => doSearch(''));
  assert('Limpar busca mostra 45 cards', document.querySelectorAll('.bcard').length === 45,
    `got ${document.querySelectorAll('.bcard').length}`);

  // Busca simulando digitação rápida (debounce stress)
  timed('10 buscas rápidas consecutivas', () => {
    ['B','Be','Bea','Beat','Beatr','Beatri','Beatriz','Beatriz ','Beatriz C','Beatriz Co'].forEach(q => doSearch(q));
  });
  doSearch(''); // reset
  console.groupEnd();

  // ── 6. Relatórios ────────────────────────────────
  console.groupCollapsed('6. Cálculos de relatório');

  // calcValor
  let calcErrors = 0;
  let totalCalc = 0;
  DATA.forEach(b => {
    const v = calcValor(b);
    if (!Number.isFinite(v) || v < 0) calcErrors++;
    totalCalc += v;
  });
  assert('calcValor() retorna valores válidos para todas as noivas', calcErrors === 0, `${calcErrors} erros`);
  console.log(`  ℹ  Total previsto (45 noivas): R$ ${totalCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // addDays
  assert('addDays("2026-01-01", 30) = "2026-01-31"', addDays('2026-01-01', 30) === '2026-01-31', addDays('2026-01-01', 30));
  assert('addDays("2026-01-31", 1) = "2026-02-01"', addDays('2026-01-31', 1) === '2026-02-01', addDays('2026-01-31', 1));
  assert('addDays("2026-02-28", 1) = "2026-03-01"', addDays('2026-02-28', 1) === '2026-03-01', addDays('2026-02-28', 1));
  assert('addDays("", 30) = ""', addDays('', 30) === '');
  assert('today() formato YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(today()), today());
  assert('daysTo(today()) = 0', daysTo(today()) === 0, `got ${daysTo(today())}`);
  assert('daysTo("2099-01-01") > 0', daysTo('2099-01-01') > 0);
  assert('daysTo("2020-01-01") < 0', daysTo('2020-01-01') < 0);
  assert('daysTo("") = null', daysTo('') === null);

  // Render reports
  showTab('rv');
  timed('renderReports() com 45 noivas', () => renderReports());
  assert('Relatório financeiro renderizado', (g('fin-bdy')?.children.length || 0) > 0);
  assert('Resumo renderizado', (g('sum-bdy')?.children.length || 0) > 0);
  assert('Material renderizado', !!g('mat-bdy'));
  showTab('kb');
  console.groupEnd();

  // ── 7. Saves rápidos em sequência ────────────────
  console.groupCollapsed('7. Stress de saves rápidos');
  timed('20 saves consecutivos', () => {
    for (let i = 0; i < 20; i++) { DATA[i % DATA.length].upd = Date.now(); save(); }
  });
  assert('DATA intacto após 20 saves', DATA.length === 45, `got ${DATA.length}`);
  assert('localStorage consistente após 20 saves',
    JSON.parse(localStorage.getItem('florelle_v3')).length === 45);
  console.groupEnd();

  // ── 8. Integridade dos dados ─────────────────────
  console.groupCollapsed('8. Integridade de dados');
  const REQUIRED = ['id', 'nome', 'etapa', 'upd'];
  let missingFields = 0;
  DATA.forEach(b => {
    REQUIRED.forEach(f => { if (b[f] === undefined || b[f] === null) missingFields++; });
  });
  assert('Todos os campos obrigatórios presentes', missingFields === 0, `${missingFields} campos ausentes`);
  assert('Todos os IDs são strings não-vazias', DATA.every(b => typeof b.id === 'string' && b.id.length > 0));
  assert('Todos os lembretes têm id+text', DATA.every(b =>
    (b.lembretes || []).every(r => r.id && typeof r.text === 'string')
  ));
  assert('Todos os anexos têm id+nome', DATA.every(b =>
    (b.anexos || []).every(a => a.id && a.nome)
  ));
  assert('Etapas válidas', DATA.every(b => ETAPAS.includes(b.etapa)), 'etapa fora do domínio');
  console.groupEnd();

  // ── Restaurar dados originais ────────────────────
  console.log('  🔄 Restaurando dados originais...');
  DATA.length = 0;
  backup.forEach(b => DATA.push(b));
  save();
  renderAll();
  assert('Dados originais restaurados', DATA.length === backup.length, `got ${DATA.length}`);

  // ── Sumário ──────────────────────────────────────
  console.groupEnd();
  console.group('%c📊 Resultado do Stress Test', 'font-weight:700;font-size:14px;color:#5C7050');
  console.log(`  Testes: ${T.pass + T.fail} | ✅ ${T.pass} passou | ❌ ${T.fail} falhou`);
  const slow = T.times.filter(x => x.ms > 100);
  if (slow.length) {
    console.warn('  ⚠  Operações lentas (>100ms):');
    slow.forEach(x => console.warn(`     • ${x.label}: ${x.ms}ms`));
  } else {
    console.log('  ⚡ Todas as operações rápidas (<100ms)');
  }
  const maxTime = T.times.reduce((a, b) => b.ms > a.ms ? b : a, { label: '', ms: 0 });
  console.log(`  ⏱  Mais lenta: "${maxTime.label}" (${maxTime.ms}ms)`);
  if (T.fail === 0) {
    console.log('%c  ✅ TODOS OS TESTES PASSARAM', 'color:#5C7050;font-weight:700;font-size:13px');
  } else {
    console.error(`%c  ❌ ${T.fail} TESTES FALHARAM`, 'color:#B03420;font-weight:700;font-size:13px');
  }
  console.groupEnd();

  return { pass: T.pass, fail: T.fail, times: T.times };
})();
