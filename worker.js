// Florelle Sign Worker — Cloudflare Worker (ES Module)
// Armazena dados de contratos para assinatura e retorna token curto.
//
// SETUP (Dashboard Cloudflare → Workers & Pages → worker florelle):
//   1. Cole este código no editor
//   2. Aba KV → crie namespace "FLORELLE_SIGN" → anote o ID
//   3. Aba Settings → Variable bindings → KV Namespace
//      Variable name: SIGN_KV   KV namespace: FLORELLE_SIGN
//   4. Deploy

const CORS = {
  'Access-Control-Allow-Origin': 'https://brunadona.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Data-Version, X-App-Secret',
  'Access-Control-Expose-Headers': 'X-Data-Version',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Exige o header X-App-Secret em todo endpoint que expõe dados reais de clientes
// (nome, CPF, endereço, telefone, contratos) ou gasta a chave da IA — sem isso,
// qualquer pessoa que descobrisse a URL do Worker conseguia ler/escrever tudo.
// Único endpoint que fica de fora: GET /sign/:token, porque esse token já é o
// próprio controle de acesso (link único mandado pra noiva assinar).
function checkAppSecret(request, env) {
  if (!env.APP_SECRET) return true; // ainda não configurado — não trava o app
  return request.headers.get('X-App-Secret') === env.APP_SECRET;
}

// Gera token alfanumérico de 8 chars (sem ambíguos 0/O/I/l)
function genToken() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) t += chars[b % chars.length];
  return t;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // POST /sign  →  salva dados, devolve token
    if (request.method === 'POST' && url.pathname === '/sign') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      if (!body.data || typeof body.data !== 'string') {
        return json({ error: 'Campo data obrigatório' }, 400);
      }

      // Tenta até 3 vezes evitar colisão de token
      let token;
      for (let i = 0; i < 3; i++) {
        token = genToken();
        const existing = await env.SIGN_KV.get('s:' + token);
        if (!existing) break;
      }

      // Armazena por 60 dias
      await env.SIGN_KV.put('s:' + token, body.data, { expirationTtl: 5184000 });

      return json({ token });
    }

    // GET /sign/:token  →  recupera dados
    if (request.method === 'GET' && url.pathname.startsWith('/sign/')) {
      const token = url.pathname.slice(6).replace(/[^a-z0-9]/gi, '');
      if (!token) return json({ error: 'Token obrigatório' }, 400);

      const data = await env.SIGN_KV.get('s:' + token);
      if (!data) return json({ error: 'Link expirado ou inválido' }, 404);

      return json({ data });
    }

    // POST /contract/:brideId  →  salva HTML do contrato assinado (TTL 2 anos)
    if (request.method === 'POST' && url.pathname.startsWith('/contract/')) {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      const brideId = decodeURIComponent(url.pathname.slice(10));
      if (!brideId) return json({ error: 'brideId obrigatório' }, 400);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      if (!body.html || typeof body.html !== 'string') {
        return json({ error: 'Campo html obrigatório' }, 400);
      }

      await env.SIGN_KV.put('ct:' + brideId, body.html, { expirationTtl: 63072000 });
      return json({ ok: true });
    }

    // GET /contract/:brideId  →  recupera HTML do contrato assinado
    if (request.method === 'GET' && url.pathname.startsWith('/contract/')) {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      const brideId = decodeURIComponent(url.pathname.slice(10));
      if (!brideId) return json({ error: 'brideId obrigatório' }, 400);

      const html = await env.SIGN_KV.get('ct:' + brideId);
      if (!html) return json({ error: 'Contrato não encontrado' }, 404);

      return json({ html });
    }

    // POST /pending-confirm  →  salva confirmação pendente (quando app aberto sem dados)
    if (request.method === 'POST' && url.pathname === '/pending-confirm') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      if (!body.brideId) return json({ error: 'brideId obrigatório' }, 400);
      const raw = await env.SIGN_KV.get('pc_list');
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(x => x.brideId === body.brideId);
      const entry = { brideId: body.brideId, ts: body.ts || '', nome: body.nome || '' };
      if (idx >= 0) list[idx] = entry; else list.push(entry);
      await env.SIGN_KV.put('pc_list', JSON.stringify(list), { expirationTtl: 2592000 });
      return json({ ok: true });
    }

    // GET /pending-confirms  →  retorna e apaga lista de confirmações pendentes
    if (request.method === 'GET' && url.pathname === '/pending-confirms') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      const raw = await env.SIGN_KV.get('pc_list');
      if (!raw) return json({ confirms: [] });
      await env.SIGN_KV.delete('pc_list');
      return json({ confirms: JSON.parse(raw) });
    }

    // POST /analyze-wa  →  analisa conversa do WhatsApp com Claude (chave fica no Worker)
    if (request.method === 'POST' && url.pathname === '/analyze-wa') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      if (!env.ANTHROPIC_KEY) return json({ error: 'Chave Anthropic não configurada no Worker' }, 500);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      if (!body.text && !body.images?.length) return json({ error: 'Envie texto ou imagens' }, 400);

      const promptText = `Você analisa conversas do WhatsApp e/ou imagens (fotos de contratos, fichas, screenshots) de uma artesã de preservação de buquês de noivas (Florelle Atelier). Extraia as informações relevantes e retorne APENAS um objeto JSON válido, sem markdown, sem texto adicional.

Campos do JSON (inclua todos, use null ou "" quando não encontrado):
- "nome": nome da noiva/cliente (string | null)
- "telefone": número de telefone da noiva no formato "(00) 00000-0000" (string | null)
- "dataCasamento": data do casamento em YYYY-MM-DD — se só mês/dia sem ano, use o ano mais próximo futuro (string | null)
- "cpf": CPF somente números, 11 dígitos (string — vazio se não houver)
- "cep": CEP somente números, 8 dígitos (string — vazio se não houver)
- "cidade": cidade e estado no formato "Cidade/UF" (string — vazio se não houver)
- "endereco": endereço completo sem repetir a cidade (string — vazio se não houver)
- "produto": exatamente um de: "quadro25x30", "quadro32x42", "quadroMadeira37x40", "quadroMadeira40x60", "quadroMadeira50x70", "quadroSobMedida", "cupulaM", "cupulaMini", "multiplos" — ou null
- "produtoObs": detalhes do produto — cor, medidas, estilo, flores (string — vazio se não houver)
- "formaPagamento": exatamente "pixAVista", "pix3x" ou "cartao" — ou null
- "valorTotal": valor total no formato "1.290,00" sem "R$" (string — vazio se não houver)
- "retiradaBuque": "sedex" se a noiva envia pelos Correios, "florelle" se a Florelle vai buscar no evento (string | null)
- "autorizaReposicao": "sim" ou "nao" (string | null)
- "floresUtilizadas": flores mencionadas no buquê (string — vazio se não houver)
- "cerimonialista": nome do(a) cerimonialista (string — vazio se não houver)
- "cerimonialTel": telefone do(a) cerimonialista (string — vazio se não houver)
- "anotacoes": resumo da conversa em 2-3 frases (o que a noiva quer, principais dúvidas, contexto) + preferências, dúvidas e observações relevantes (string — vazio se não houver)
${body.text ? `\nConversa do WhatsApp:\n${body.text}\n` : ''}
Retorne apenas o JSON.`;

      // Monta conteúdo multimodal: imagens primeiro, texto por último
      const content = [];
      if (body.images?.length) {
        for (const img of body.images.slice(0, 4)) {
          if (img.mediaType && img.data) {
            content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
          }
        }
      }
      content.push({ type: 'text', text: promptText });

      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 900,
          messages: [{ role: 'user', content }],
        }),
      });

      if (!aiResp.ok) {
        let msg = 'Erro Anthropic ' + aiResp.status;
        try { const e = await aiResp.json(); msg = e.error?.message || msg; } catch {}
        return json({ error: msg }, 502);
      }

      const aiData = await aiResp.json();
      const raw = (aiData.content?.[0]?.text || '').trim();
      return json({ raw });
    }

    // GET /data  →  lê dados do app (sync entre dispositivos)
    // Formato armazenado: { data: [...], version: "<timestamp>" }. Compatível com o
    // formato antigo (array puro) que já estava salvo no KV antes dessa mudança.
    if (request.method === 'GET' && url.pathname === '/data') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      const raw = await env.SIGN_KV.get('florelle_app_data');
      if (!raw) return new Response('null', { headers: { ...CORS, 'Content-Type': 'application/json' } });
      let dataOnly = raw, version = '0';
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed) {
          dataOnly = JSON.stringify(parsed.data);
          version = parsed.version || '0';
        }
      } catch {}
      return new Response(dataOnly, { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'X-Data-Version': version } });
    }

    // POST /data  →  salva dados do app (sync entre dispositivos)
    // Controle de versão otimista: o cliente manda a versão que ele leu por último
    // (header X-Data-Version). Se já tem uma versão mais nova salva (outro dispositivo
    // salvou primeiro), rejeita com 409 em vez de sobrescrever silenciosamente.
    if (request.method === 'POST' && url.pathname === '/data') {
      if (!checkAppSecret(request, env)) return json({ error: 'Não autorizado' }, 401);
      const text = await request.text();
      let arr;
      try { arr = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
      const clientVersion = request.headers.get('X-Data-Version') || '';
      const existingRaw = await env.SIGN_KV.get('florelle_app_data');
      let existingVersion = '';
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed) existingVersion = parsed.version || '';
        } catch {}
      }
      if (clientVersion && existingVersion && clientVersion !== existingVersion) {
        return json({ error: 'conflict', version: existingVersion }, 409);
      }
      const newVersion = String(Date.now());
      await env.SIGN_KV.put('florelle_app_data', JSON.stringify({ data: arr, version: newVersion }));
      return json({ ok: true, version: newVersion });
    }

    return new Response('Florelle Sign API', { headers: CORS });
  },
};
