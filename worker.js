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
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
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
      const brideId = decodeURIComponent(url.pathname.slice(10));
      if (!brideId) return json({ error: 'brideId obrigatório' }, 400);

      const html = await env.SIGN_KV.get('ct:' + brideId);
      if (!html) return json({ error: 'Contrato não encontrado' }, 404);

      return json({ html });
    }

    return new Response('Florelle Sign API', { headers: CORS });
  },
};
