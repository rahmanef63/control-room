import http from 'node:http';

const host = '127.0.0.1';
const port = 45999;
const secret = 'e2e-gateway-secret-0123456789abcdef0123456789abcdef012';
let workspaceState = null;
let terminalSessions = [];
let lastTerminalInput = null;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  if (url.pathname === '/health') return json(res, 200, { status: 'ok', uptime: 1 });
  if (url.pathname === '/e2e/last-input') return json(res, 200, { lastTerminalInput });
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
        const body = raw ? JSON.parse(raw) : {};
        lastTerminalInput = { id, data: body.data ?? null };
        return json(res, 200, { ok: true });
      });
      return;
    }
    if (action === 'buffer' && req.method === 'GET') return json(res, 200, { buffer: '' });
    if (action === 'resize' && req.method === 'POST') return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/si-coder/tools') {
    return json(res, 200, {
      installed: true,
      version: '0.8.14-e2e',
      tools: [
        { name: 'sc.user.list', description: 'List users', inputSchema: { type: 'object' } },
        { name: 'sc.user.which', description: 'Resolve user', inputSchema: { type: 'object' } },
        { name: 'sc.user.providers.list', description: 'List providers', inputSchema: { type: 'object' } },
        { name: 'sc.user.connections.list', description: 'List connections', inputSchema: { type: 'object' } },
        { name: 'sc.user.credential.request', description: 'Credential handoff', inputSchema: { type: 'object' } }
      ]
    });
  }
  if (req.method === 'POST' && url.pathname === '/si-coder/tools/call') {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid json' }); }
      const name = body.name;
      if (name === 'sc.user.list') {
        return json(res, 200, { ok: true, result: {
          defaultUser: 'rahmanfakhr', currentUser: 'rahmanfakhr', currentReason: 'e2e',
          users: [{ name: 'rahmanfakhr', owner: 'Rahman', credentialCount: 3, legacyCredentialCount: 0, connectionCount: 2, isDefault: true, isCurrent: true, folders: [], providers: [] }]
        }});
      }
      if (name === 'sc.user.which') {
        return json(res, 200, { ok: true, result: { cwd: body.arguments?.cwd ?? '/tmp', user: 'rahmanfakhr', unresolvedUser: null, reason: 'e2e mapping', rule: '/tmp', defaultUser: 'rahmanfakhr', mappings: [{ path: '/tmp', user: 'rahmanfakhr' }] } });
      }
      if (name === 'sc.user.providers.list') {
        return json(res, 200, { ok: true, result: { user: 'rahmanfakhr', providers: [
          { user: 'rahmanfakhr', id: 'github', title: 'GitHub', blurb: 'repo create + push', providerStatus: 'implemented', connection: 'default', connectionLabel: 'Default GitHub', authMethod: 'personal-access-token', scope: 'account', connectionCount: 1, defaultConnection: 'default', legacy: false, state: 'ready', stored: 2, total: 2, invalid: 0, missingRequired: 0, credentials: [] },
          { user: 'rahmanfakhr', id: 'convex-cloud', title: 'Convex Cloud', blurb: 'managed Convex backend', providerStatus: 'implemented', connection: 'client-dev', connectionLabel: 'Client Dev', authMethod: 'deployment-key', scope: 'deployment', connectionCount: 1, defaultConnection: 'client-dev', legacy: false, state: 'incomplete', stored: 1, total: 2, invalid: 0, missingRequired: 1, credentials: [] }
        ] }});
      }
      if (name === 'sc.user.connections.list') {
        const provider = body.arguments?.provider ?? 'github';
        if (provider === 'github') return json(res, 200, { ok: true, result: { user: 'rahmanfakhr', connections: [{
          user: 'rahmanfakhr', provider: 'github', id: 'default', label: 'Default GitHub', authMethod: 'personal-access-token', scheme: 'API_KEY', scope: 'account', isDefault: true, external: false, state: 'ready', stored: 2, total: 2, invalid: 0, missingRequired: 0,
          credentials: [
            { key: 'GITHUB_TOKEN', required: true, secret: true, state: 'stored', stored: true, valid: true, readable: false, connection: 'default' },
            { key: 'GH_OWNER', required: false, secret: false, state: 'stored', stored: true, valid: true, readable: false, connection: 'default' }
          ]
        }] }});
        return json(res, 200, { ok: true, result: { user: 'rahmanfakhr', connections: [{
          user: 'rahmanfakhr', provider: 'convex-cloud', id: 'client-dev', label: 'Client Dev', authMethod: 'deployment-key', scheme: 'API_KEY', scope: 'deployment', isDefault: true, external: false, state: 'incomplete', stored: 1, total: 2, invalid: 0, missingRequired: 1,
          credentials: [
            { key: 'CONVEX_DEPLOYMENT_NAME', required: true, secret: false, state: 'stored', stored: true, valid: true, readable: false, connection: 'client-dev' },
            { key: 'CONVEX_DEPLOY_KEY', required: true, secret: true, state: 'missing', stored: false, valid: false, readable: false, connection: 'client-dev' }
          ]
        }] }});
      }
      if (name === 'sc.user.connection.request') return json(res, 200, { ok: true, result: { user: 'rahmanfakhr', provider: body.arguments?.provider, authMethods: [{ id: 'personal-access-token', label: 'Personal access token', scheme: 'API_KEY', scope: 'account', external: false, recommended: 'direct', fields: ['TOKEN'], requiredFields: ['TOKEN'] }] }});
      if (name === 'sc.user.credential.request') return json(res, 200, { ok: true, result: { ...(body.arguments || {}), required: true, secret: true, state: 'missing', stored: false, valid: false, readable: false, requiresUserTerminal: true, command: `sc user credential-set ${body.arguments?.user} ${body.arguments?.provider} ${body.arguments?.key} --connection ${body.arguments?.connection}`, policy: 'secure terminal only' }});
      if (name === 'sc.user.provider.verify') return json(res, 200, { ok: true, result: { output: 'provider verification ok' } });
      if (name === 'sc.user.default' || name === 'sc.user.connection.manage') return json(res, 200, { ok: true, result: { ok: true } });
      return json(res, 422, { ok: false, result: null, error: `unsupported e2e tool ${name}` });
    });
    return;
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
