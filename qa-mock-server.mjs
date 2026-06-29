// THROWAWAY local API mock for QA only. Not committed.
import { createServer } from 'http';
const u = new Map();
const tok = (e) => 'qa.' + Buffer.from(e).toString('base64');
const fromTok = (t) => { try { return Buffer.from(String(t).replace('qa.', ''), 'base64').toString(); } catch { return null; } };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });
const send = (res, c, o) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const auth = (req) => fromTok((req.headers.authorization || '').replace('Bearer ', ''));
createServer(async (req, res) => {
  const { url, method } = req;
  if (url === '/api/auth/signup' && method === 'POST') { const { email, password, name } = await body(req); if (u.has(email)) return send(res, 409, { error: 'exists' }); u.set(email, { name: name || email.split('@')[0], password, state: null }); return send(res, 201, { token: tok(email), user: { email, name: name || email.split('@')[0] } }); }
  if (url === '/api/auth/login' && method === 'POST') { const { email, password } = await body(req); const x = u.get(email); if (!x || x.password !== password) return send(res, 401, { error: 'Invalid email or password.' }); return send(res, 200, { token: tok(email), user: { email, name: x.name } }); }
  const e = auth(req); const x = e && u.get(e);
  if (url === '/api/auth/me') return x ? send(res, 200, { user: { email: e, name: x.name } }) : send(res, 401, { error: 'Unauthorized' });
  if (url === '/api/state') { if (!x) return send(res, 401, { error: 'Unauthorized' }); if (method === 'GET') return send(res, 200, { state: x.state ?? null }); if (method === 'PUT') { x.state = (await body(req)).state; return send(res, 200, { ok: true }); } }
  send(res, 404, { error: 'nf' });
}).listen(3000, () => console.log('QA mock on :3000'));
