import http from 'node:http';

const host = '127.0.0.1';
const port = 45999;
const secret = 'e2e-gateway-secret-0123456789abcdef0123456789abcdef012';
let workspaceState = null;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  if (url.pathname === '/health') return json(res, 200, { status: 'ok', uptime: 1 });
  if (req.headers['x-control-room-secret'] !== secret) return json(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && url.pathname === '/terminals') {
    return json(res, 200, { sessions: [], profiles: [], environments: [], agentProfiles: [] });
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
