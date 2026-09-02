import http from 'node:http';

const host = '127.0.0.1';
const port = 45999;
const secret = 'e2e-gateway-secret-0123456789abcdef0123456789abcdef012';
let workspaceState = null;
let terminalSessions = [];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  if (url.pathname === '/health') return json(res, 200, { status: 'ok', uptime: 1 });
  if (req.headers['x-control-room-secret'] !== secret) return json(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && url.pathname === '/terminals') {
    return json(res, 200, { sessions: terminalSessions, profiles: [], environments: [], agentProfiles: [] });
  }
  if (req.method === 'POST' && url.pathname === '/terminals') {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return json(res, 400, { error: 'invalid json' }); }
      const now = Date.now();
      const session = { id: `e2e-${now}`, profile: body.profile ?? 'shell', title: 'shell', command: '/bin/bash', pid: 12345, cwd: '/tmp', rows: 24, cols: 80, status: 'running', created_at: now, updated_at: now };
      terminalSessions = [...terminalSessions, session];
      return json(res, 201, { session });
    });
    return;
  }
  const terminalMatch = url.pathname.match(/^\/terminals\/([^/]+)(?:\/(input|buffer|resize))?$/);
  if (terminalMatch) {
    const id = decodeURIComponent(terminalMatch[1]);
    const action = terminalMatch[2] ?? null;
    if (!action && req.method === 'GET') {
      const session = terminalSessions.find((item) => item.id === id);
      return session ? json(res, 200, { session }) : json(res, 404, { error: 'not found' });
    }
    if (!action && req.method === 'DELETE') {
      terminalSessions = terminalSessions.filter((session) => session.id !== id);
      return json(res, 200, { ok: true });
    }
    if (!action && req.method === 'PATCH') {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        terminalSessions = terminalSessions.map((session) => session.id === id ? { ...session, title: body.title ?? session.title, updated_at: Date.now() } : session);
        return json(res, 200, { session: terminalSessions.find((session) => session.id === id) });
      });
      return;
    }
    if (action === 'input' && req.method === 'POST') {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        if (raw) JSON.parse(raw);
        return json(res, 200, { ok: true });
      });
      return;
    }
    if (action === 'buffer' && req.method === 'GET') return json(res, 200, { buffer: '' });
    if (action === 'resize' && req.method === 'POST') return json(res, 200, { ok: true });
  }
  if (url.pathname === '/state/workspaces' && req.method === 'GET') {
    return json(res, 200, { value: workspaceState });
  }
  if (url.pathname === '/state/workspaces' && req.method === 'PUT') {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try { workspaceState = JSON.parse(raw); } catch { workspaceState = null; }
      res.writeHead(204);
      res.end();
    });
    return;
  }
  return json(res, 404, { error: 'not found' });
});

server.listen(port, host, () => console.log(`e2e stub agent listening on ${host}:${port}`));
