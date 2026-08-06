#!/usr/bin/env node
// VPS Control Room — cross-platform local control CLI (Windows / macOS / Linux).
//
// This is the OS-agnostic "brain" behind the `vps-cr` command. The Windows
// `scripts/win-local/vps-cr.ps1` wrapper and any future bash wrapper both
// delegate here, so config / doctor / onboarding logic lives in ONE place.
//
//   node scripts/local/control.mjs <command> [flags]
//
// Commands:
//   install | config     Onboarding: write .env.local (interactive or via flags)
//   doctor               Diagnose the local setup (read-only)
//   doctor --fix         Repair broken/missing config back to working defaults
//   status               Health of frontend (4000) + agent (4001)
//   acc | approve <id>   Approve a login device   (delegates to approve-device.js)
//   list                 List approved + pending devices
//   revoke <id>          Un-trust a device
//   secret               Print one fresh 32-byte hex secret
//   help | --help        Show the menu
//
// Process start/stop/open are handled by the per-OS wrapper (PowerShell on
// Windows); on macOS/Linux this CLI also implements `start`/`stop`/`open`.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const IS_WIN = platform() === 'win32';
// Package manager + frontend runtime. Bun ships a real .exe on Windows (no
// .cmd shim like npm), so this is the whole platform difference.
const BUN = IS_WIN ? 'bun.exe' : 'bun';

const ROOT_ENV = join(REPO, '.env.local');
const FRONTEND_ENV = join(REPO, 'frontend', '.env.local');
const AGENT_VAR = join(REPO, 'agent', 'var');
const DEVICE_STORE = join(AGENT_VAR, 'auth-devices.json');
const APPROVE_SCRIPT = join(REPO, 'scripts', 'approve-device.js');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};
const ok = (s) => `${C.green}✓${C.reset} ${s}`;
const warn = (s) => `${C.yellow}!${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${s}`;

// ---- args ----------------------------------------------------------------
const rawArgs = process.argv.slice(2);
const cmd = (rawArgs[0] || 'help').replace(/^--/, '').toLowerCase();
const flags = new Set(rawArgs.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '')));
const positional = rawArgs.slice(1).filter((a) => !a.startsWith('--'));
function flagValue(name) {
  const i = rawArgs.indexOf(`--${name}`);
  return i >= 0 && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--') ? rawArgs[i + 1] : undefined;
}

// ---- env helpers ---------------------------------------------------------
function genSecret() {
  return randomBytes(32).toString('hex');
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readEnv(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function defaultCwd() {
  return IS_WIN ? (process.env.USERPROFILE || homedir()).replace(/\\/g, '/') : homedir();
}

// Canonical config — single source for what a valid local .env.local contains.
function defaultValues() {
  return {
    CONTROL_ROOM_SECRET: '',
    CONTROL_ROOM_SESSION_SECRET: '',
    AGENT_GATEWAY_SECRET: '',
    SESSION_EXPIRY_HOURS: '72',
    // Local-only: a correct password auto-approves the browser (no manual device
    // approval). Localhost single-user — never set this on a VPS/network deploy.
    CONTROL_ROOM_LOCAL_TRUST: '1',
    CONTROL_ROOM_PORT: '4000',
    CONTROL_ROOM_HOST: '127.0.0.1',
    AGENT_HEALTH_PORT: '4001',
    AGENT_HEALTH_HOST: '127.0.0.1',
    HOST_TELEMETRY_INTERVAL_MS: '15000',
    NEXT_PUBLIC_APP_URL: 'http://localhost:4000',
    NEXT_PUBLIC_APP_HOST: 'localhost',
    SHELL: IS_WIN ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'),
    TERMINAL_DEFAULT_CWD: defaultCwd(),
  };
}

function renderEnv(v) {
  const port = v.CONTROL_ROOM_PORT || '4000';
  const shellBlock = IS_WIN
    ? `# --- Windows-local overrides (agent terminal panes) ---\n` +
      `# The agent defaults to /bin/bash + /home/<user>, which don't exist on Windows.\n` +
      `SHELL=${v.SHELL || 'powershell.exe'}\n` +
      `TERMINAL_DEFAULT_CWD=${v.TERMINAL_DEFAULT_CWD}\n`
    : `# --- Local terminal defaults ---\n` +
      `SHELL=${v.SHELL || process.env.SHELL || '/bin/bash'}\n` +
      `TERMINAL_DEFAULT_CWD=${v.TERMINAL_DEFAULT_CWD}\n`;
  return (
    `# VPS Control Room — LOCAL (localhost-only) config. Managed by \`vps-cr config\`.\n` +
    `# No VPS / Tailscale / systemd involved. Generated for ${platform()}.\n\n` +
    `# --- Auth ---\n` +
    `CONTROL_ROOM_SECRET=${v.CONTROL_ROOM_SECRET}\n` +
    `CONTROL_ROOM_SESSION_SECRET=${v.CONTROL_ROOM_SESSION_SECRET}\n` +
    `AGENT_GATEWAY_SECRET=${v.AGENT_GATEWAY_SECRET}\n` +
    `SESSION_EXPIRY_HOURS=${v.SESSION_EXPIRY_HOURS || '72'}\n` +
    `# Local single-user convenience: correct password auto-approves the browser.\n` +
    `# Never enable on a network/VPS deploy (drops the device second factor).\n` +
    `CONTROL_ROOM_LOCAL_TRUST=${v.CONTROL_ROOM_LOCAL_TRUST || '1'}\n\n` +
    `# --- Frontend (server-only) ---\n` +
    `CONTROL_ROOM_PORT=${port}\n` +
    `CONTROL_ROOM_HOST=${v.CONTROL_ROOM_HOST || '127.0.0.1'}\n\n` +
    `# --- Agent (server-only) ---\n` +
    `AGENT_HEALTH_PORT=${v.AGENT_HEALTH_PORT || '4001'}\n` +
    `AGENT_HEALTH_HOST=${v.AGENT_HEALTH_HOST || '127.0.0.1'}\n` +
    `HOST_TELEMETRY_INTERVAL_MS=${v.HOST_TELEMETRY_INTERVAL_MS || '15000'}\n\n` +
    `# --- Public env (ships to browser) — localhost, plain http ---\n` +
    `NEXT_PUBLIC_APP_URL=${v.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`}\n` +
    `NEXT_PUBLIC_APP_HOST=${v.NEXT_PUBLIC_APP_HOST || 'localhost'}\n\n` +
    shellBlock
  );
}

function writeEnvFiles(v) {
  const text = renderEnv(v);
  writeFileSync(ROOT_ENV, text, { mode: 0o600 });
  writeFileSync(FRONTEND_ENV, text, { mode: 0o600 });
}

// ---- readline prompt -----------------------------------------------------
async function ask(question, def) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = def ? ` ${C.dim}[${def}]${C.reset}` : '';
  const answer = await new Promise((res) => rl.question(`  ${question}${suffix}: `, res));
  rl.close();
  return answer.trim() || def || '';
}

// ---- health --------------------------------------------------------------
async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

// ---- commands ------------------------------------------------------------
function showHelp() {
  console.log(`
${C.bold}${C.cyan}vps-cr${C.reset} — VPS Control Room (local, cross-platform)

${C.dim}Run the dashboard${C.reset}
  ${C.bold}vps-cr${C.reset}                 start servers + open in your browser
  ${C.bold}vps-cr app${C.reset}             start + open in a NATIVE app window — all features, light
  ${C.bold}vps-cr start${C.reset}           start servers only — NO browser (saves RAM)
  ${C.bold}vps-cr build${C.reset}           build the light PROD servers (run once; fixes lag w/ many panes)
  ${C.bold}vps-cr stop${C.reset}            stop both servers
  ${C.bold}vps-cr status${C.reset}          health of frontend(4000) + agent(4001)

${C.dim}Native shells — Windows only, no browser (lightest)${C.reset}
  ${C.bold}vps-cr term [n]${C.reset}        open n native terminal panes in Windows Terminal (default 4)
  ${C.bold}vps-cr ssh [target]${C.reset}    open a native SSH pane to the VPS (default: vpsku)

${C.dim}Setup & repair${C.reset}
  ${C.bold}vps-cr install${C.reset}         onboarding wizard — write .env.local
  ${C.bold}vps-cr config${C.reset}          re-run config (set login password, etc.)
  ${C.bold}vps-cr config --reset${C.reset}  regenerate secrets + reset to defaults
  ${C.bold}vps-cr doctor${C.reset}          diagnose the local setup
  ${C.bold}vps-cr doctor --fix${C.reset}    repair broken/missing config

${C.dim}Login devices${C.reset}
  ${C.bold}vps-cr acc <id>${C.reset}        approve a login device
  ${C.bold}vps-cr list${C.reset}            list approved + pending devices
  ${C.bold}vps-cr revoke <id>${C.reset}     un-trust a device
  ${C.bold}vps-cr secret${C.reset}          print one fresh 32-byte hex secret

  ${C.bold}vps-cr help${C.reset}            show this menu

  ${C.dim}Flags also accept the --form: vps-cr --doctor --fix${C.reset}
  ${C.dim}Light-run guide: docs/NATIVE-WINDOWS.md · Install: docs/INSTALL-LOCAL.md${C.reset}
`);
}

async function doctor() {
  const fix = flags.has('fix');
  console.log(`\n${C.bold}vps-cr doctor${C.reset}${fix ? ` ${C.yellow}--fix${C.reset}` : ''}  ${C.dim}(${platform()})${C.reset}\n`);
  let problems = 0;
  const note = (line) => console.log('  ' + line);

  // 1. Runtimes — bun runs the frontend + tooling, node runs the agent daemon.
  const major = Number(process.versions.node.split('.')[0]);
  major >= 18 ? note(ok(`Node ${process.versions.node}`)) : (note(fail(`Node ${process.versions.node} — need >=18`)), problems++);
  const bunVersion = spawnSync(BUN, ['--version'], { encoding: 'utf8' });
  bunVersion.status === 0
    ? note(ok(`Bun ${bunVersion.stdout.trim()}`))
    : (note(fail('bun not found — install: https://bun.sh')), problems++);

  // 2. Repo layout
  const hasFront = existsSync(join(REPO, 'frontend'));
  const hasAgent = existsSync(join(REPO, 'agent'));
  hasFront && hasAgent ? note(ok('repo layout (frontend/ + agent/)')) : (note(fail('missing frontend/ or agent/ — wrong directory?')), problems++);

  // 3. deps installed
  for (const part of ['frontend', 'agent']) {
    if (existsSync(join(REPO, part, 'node_modules'))) note(ok(`${part} deps installed`));
    else { note(fail(`${part}/node_modules missing — run: bun install --cwd ${part}`)); problems++; }
  }

  // 4-6. env files + sync
  let v = readEnv(ROOT_ENV);
  if (!existsSync(ROOT_ENV)) {
    note(fail('.env.local missing (repo root)'));
    problems++;
    if (fix) { v = applyDefaults(readEnv(ROOT_ENV)); writeEnvFiles(v); note(ok('created .env.local from defaults')); }
  } else {
    note(ok('.env.local present'));
  }
  if (!existsSync(FRONTEND_ENV)) {
    note(fail('frontend/.env.local missing (Next reads from frontend/)'));
    problems++;
    if (fix) { writeEnvFiles(applyDefaults(v)); note(ok('synced frontend/.env.local')); }
  } else {
    const fv = readEnv(FRONTEND_ENV);
    const drift = Object.keys(v).filter((k) => v[k] !== fv[k]);
    if (drift.length) {
      note(warn(`root vs frontend/.env.local drift: ${drift.join(', ')}`));
      if (fix) { writeEnvFiles(applyDefaults(v)); note(ok('re-synced both .env.local')); }
      else problems++;
    } else note(ok('.env.local files in sync'));
  }

  // 7. session secret (fatal, fixable)
  v = readEnv(ROOT_ENV);
  if ((v.CONTROL_ROOM_SESSION_SECRET || '').length < 32) {
    note(fail('CONTROL_ROOM_SESSION_SECRET missing or <32 chars (forgeable cookie)'));
    problems++;
    if (fix) { v.CONTROL_ROOM_SESSION_SECRET = genSecret(); writeEnvFiles(applyDefaults(v)); note(ok('generated CONTROL_ROOM_SESSION_SECRET')); }
  } else note(ok('CONTROL_ROOM_SESSION_SECRET ok (>=32)'));

  // 8. login password present
  v = readEnv(ROOT_ENV);
  if (!v.CONTROL_ROOM_SECRET) {
    note(fail('CONTROL_ROOM_SECRET (login password) empty — login impossible'));
    problems++;
    if (fix) { v.CONTROL_ROOM_SECRET = 'changeme-' + randomBytes(3).toString('hex'); writeEnvFiles(applyDefaults(v)); note(warn(`set a temporary password — change it with: vps-cr config`)); }
  } else if (v.CONTROL_ROOM_SECRET.length < 6) {
    note(warn(`CONTROL_ROOM_SECRET is short (${v.CONTROL_ROOM_SECRET.length} chars) — ok locally (device-approval is the 2nd factor)`));
  } else note(ok('CONTROL_ROOM_SECRET set'));

  // 9. gateway secret
  v = readEnv(ROOT_ENV);
  if (!v.AGENT_GATEWAY_SECRET) {
    note(warn('AGENT_GATEWAY_SECRET empty — frontend→agent reuses login password'));
    if (fix) { v.AGENT_GATEWAY_SECRET = genSecret(); writeEnvFiles(applyDefaults(v)); note(ok('generated AGENT_GATEWAY_SECRET')); }
  } else note(ok('AGENT_GATEWAY_SECRET set'));

  // 10. device store
  if (!existsSync(AGENT_VAR)) {
    note(warn('agent/var/ missing (created on first login)'));
    if (fix) { mkdirSync(AGENT_VAR, { recursive: true }); note(ok('created agent/var/')); }
  } else if (existsSync(DEVICE_STORE)) {
    try {
      const store = JSON.parse(readFileSync(DEVICE_STORE, 'utf8'));
      const a = Object.keys(store.approved || {}).length;
      const p = Object.keys(store.pending || {}).length;
      note(ok(`device store: ${a} approved, ${p} pending`));
      if (p) note(`  ${C.dim}pending → approve with: vps-cr acc <id>${C.reset}`);
    } catch { note(fail('auth-devices.json is corrupt JSON')); problems++; }
  } else note(ok('agent/var/ present (no devices yet)'));

  // 11. health
  v = readEnv(ROOT_ENV);
  const fp = v.CONTROL_ROOM_PORT || '4000';
  const ap = v.AGENT_HEALTH_PORT || '4001';
  const [fc, ac] = await Promise.all([probe(`http://127.0.0.1:${fp}/login`), probe(`http://127.0.0.1:${ap}/health`)]);
  note(fc === 200 ? ok(`frontend up (127.0.0.1:${fp})`) : warn(`frontend not responding on ${fp} — start with: vps-cr start`));
  note(ac === 200 ? ok(`agent up (127.0.0.1:${ap})`) : warn(`agent not responding on ${ap} — start with: vps-cr start`));

  console.log('');
  if (problems === 0) console.log(`  ${C.green}${C.bold}healthy${C.reset} — no blocking problems.\n`);
  else if (fix) console.log(`  ${C.yellow}fixed what I could${C.reset} — re-run ${C.bold}vps-cr doctor${C.reset} to confirm.\n`);
  else console.log(`  ${C.red}${problems} problem(s)${C.reset} — run ${C.bold}vps-cr doctor --fix${C.reset} to repair.\n`);
}

// Fill any missing required value with a default (used by config + doctor --fix).
function applyDefaults(v) {
  const d = defaultValues();
  const out = { ...v };
  for (const [k, dv] of Object.entries(d)) {
    if (out[k] === undefined || out[k] === '') {
      // Secrets get fresh random values; everything else gets the static default.
      if (k === 'CONTROL_ROOM_SESSION_SECRET' || k === 'AGENT_GATEWAY_SECRET') out[k] = genSecret();
      else out[k] = dv;
    }
  }
  return out;
}

async function config() {
  const reset = flags.has('reset');
  const yes = flags.has('yes') || flags.has('y');
  const interactive = process.stdin.isTTY && !yes;
  console.log(`\n${C.bold}vps-cr ${reset ? 'config --reset' : 'config'}${C.reset}  ${C.dim}(${platform()})${C.reset}\n`);

  let v = reset ? {} : readEnv(ROOT_ENV);
  const d = defaultValues();

  // password
  let password = flagValue('password') ?? v.CONTROL_ROOM_SECRET;
  if (interactive) password = await ask('Login password', password || '');
  let generatedPw = false;
  if (!password) {
    password = 'cr-' + randomBytes(4).toString('hex');
    generatedPw = true;
  }

  // ports + cwd
  let port = flagValue('port') ?? v.CONTROL_ROOM_PORT ?? d.CONTROL_ROOM_PORT;
  let agentPort = flagValue('agent-port') ?? v.AGENT_HEALTH_PORT ?? d.AGENT_HEALTH_PORT;
  let cwd = flagValue('cwd') ?? v.TERMINAL_DEFAULT_CWD ?? d.TERMINAL_DEFAULT_CWD;
  let shell = flagValue('shell') ?? v.SHELL ?? d.SHELL;
  if (interactive) {
    port = await ask('Frontend port', port);
    agentPort = await ask('Agent port', agentPort);
    cwd = await ask('Terminal start dir', cwd);
    shell = await ask('Default shell', shell);
  }

  // secrets: keep existing strong ones unless --reset
  const sessionSecret = reset || (v.CONTROL_ROOM_SESSION_SECRET || '').length < 32
    ? genSecret() : v.CONTROL_ROOM_SESSION_SECRET;
  const gatewaySecret = reset || !v.AGENT_GATEWAY_SECRET ? genSecret() : v.AGENT_GATEWAY_SECRET;

  const merged = applyDefaults({
    ...v,
    CONTROL_ROOM_SECRET: password,
    CONTROL_ROOM_SESSION_SECRET: sessionSecret,
    AGENT_GATEWAY_SECRET: gatewaySecret,
    CONTROL_ROOM_PORT: port,
    AGENT_HEALTH_PORT: agentPort,
    TERMINAL_DEFAULT_CWD: cwd,
    SHELL: shell,
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  });
  writeEnvFiles(merged);
  console.log('  ' + ok(`wrote ${ROOT_ENV}`));
  console.log('  ' + ok(`wrote ${FRONTEND_ENV}`));

  // Surface the login password so the user can actually sign in. On a fresh
  // non-interactive install it's auto-generated, so it MUST be shown.
  console.log(`\n  ${C.bold}Login password:${C.reset} ${C.green}${password}${C.reset}` +
    (generatedPw ? `  ${C.dim}(auto-generated — change with: vps-cr config)${C.reset}` : ''));

  if ((flags.has('install') || (interactive && (await ask('Run bun install now? (y/N)', 'N')).toLowerCase().startsWith('y'))) && !flags.has('no-install')) {
    for (const part of ['frontend', 'agent']) {
      console.log(`  ${C.dim}installing ${part} deps…${C.reset}`);
      spawnSync(BUN, ['install', '--cwd', join(REPO, part)], { stdio: 'inherit', cwd: REPO });
    }
  }
  // Local trust is on by default, so first login just needs the password above —
  // no manual device approval.
  console.log(`\n  Next: ${C.bold}vps-cr${C.reset} (start + open), then log in with the password above.\n`);
}

function device(action) {
  if (!existsSync(APPROVE_SCRIPT)) { console.error(fail('scripts/approve-device.js not found')); process.exit(1); }
  const id = positional[0];
  let args;
  if (action === 'list') args = ['--list'];
  else if (action === 'revoke') { if (!id) { console.error(warn('need a device id: vps-cr revoke <id>')); return; } args = ['--revoke', id]; }
  else { if (!id) { console.error(warn('need a device id: vps-cr acc <id>')); return; } args = [id, ...positional.slice(1)]; }
  spawnSync('node', [APPROVE_SCRIPT, ...args], { stdio: 'inherit' });
}

async function status() {
  const v = readEnv(ROOT_ENV);
  const fp = v.CONTROL_ROOM_PORT || '4000';
  const ap = v.AGENT_HEALTH_PORT || '4001';
  const [fc, ac] = await Promise.all([probe(`http://127.0.0.1:${fp}/login`), probe(`http://127.0.0.1:${ap}/health`)]);
  console.log(`frontend(${fp})=${fc === 200 ? C.green + 'up' : C.red + 'down'}${C.reset}  agent(${ap})=${ac === 200 ? C.green + 'up' : C.red + 'down'}${C.reset}`);
}

const RUN_FILE = join(REPO, '.local-run.json');

function openBrowser(url) {
  const opener = IS_WIN ? 'cmd' : platform() === 'darwin' ? 'open' : 'xdg-open';
  const args = IS_WIN ? ['/c', 'start', '', url] : [url];
  spawn(opener, args, { stdio: 'ignore', detached: true }).unref();
}

// Open the dashboard in a dedicated, lightweight app window (chromeless, own
// process tree + profile) instead of the user's heavy everyday browser — every
// feature of the web UI, a fraction of the RAM. Falls back to a normal browser
// tab if no Chromium-based browser is found.
function appWindow(url) {
  const profileDir = join(REPO, '.local-app-profile');
  const flags = [`--app=${url}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check'];
  const candidates = IS_WIN
    ? ['msedge', 'chrome']
    : platform() === 'darwin'
      ? ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['microsoft-edge', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) { openBrowser(url); return; }
    const child = spawn(candidates[i++], flags, { stdio: 'ignore', detached: true });
    child.on('error', tryNext); // binary missing → try the next candidate
    child.unref();
  };
  tryNext();
}

function hasProdBuild() {
  return existsSync(join(REPO, 'frontend', '.next', 'BUILD_ID')) &&
    existsSync(join(REPO, 'agent', 'dist', 'index.js'));
}

function build() {
  const env = { ...process.env, NEXT_PUBLIC_BUILD_ID: 'unknown' };
  console.log('== Building frontend (next build) — 1-3 min ==');
  spawnSync(BUN, ['run', '--cwd', join(REPO, 'frontend'), 'build'], { stdio: 'inherit', cwd: REPO, env });
  console.log('== Building agent (tsc) ==');
  spawnSync(BUN, ['run', '--cwd', join(REPO, 'agent'), 'build'], { stdio: 'inherit', cwd: REPO, env });
  console.log(ok('build done — `vps-cr` now launches the light prod servers'));
}

function startServices() {
  // Spawn both servers detached + record PIDs so `stop` can find them.
  // Prefer the PROD build (next start + node dist) when present — far lighter
  // on CPU than the dev servers, so many terminal panes don't freeze the UI.
  // (On Windows the vps-cr.ps1 wrapper uses its windowed launcher instead.)
  const v = readEnv(ROOT_ENV);
  const port = v.CONTROL_ROOM_PORT || '4000';
  const env = { ...process.env, ...v, NEXT_PUBLIC_BUILD_ID: 'unknown' };
  const opts = { cwd: REPO, env, stdio: 'ignore', detached: true };
  const prod = hasProdBuild();
  const script = prod ? 'start' : 'dev';
  // bun runs the scripts; the agent's own script keeps its daemon on node
  // (node-pty streams no data under the bun runtime).
  const agent = spawn(BUN, ['run', '--cwd', join(REPO, 'agent'), script], opts);
  const frontend = spawn(BUN, ['run', '--cwd', join(REPO, 'frontend'), script], opts);
  agent.unref();
  frontend.unref();
  try { writeFileSync(RUN_FILE, JSON.stringify({ frontend: frontend.pid, agent: agent.pid, port }, null, 2)); } catch {}
  console.log(ok(`starting frontend(${port}) + agent [${prod ? 'prod — light' : 'dev — run `vps-cr build` for the lighter prod server'}] — PIDs ${frontend.pid}/${agent.pid}, ~20s to ready`));
  return port;
}

function stopServices() {
  if (!existsSync(RUN_FILE)) { console.log(warn('nothing tracked (.local-run.json missing)')); return; }
  let rec = {};
  try { rec = JSON.parse(readFileSync(RUN_FILE, 'utf8')); } catch {}
  for (const name of ['frontend', 'agent']) {
    const pid = rec[name];
    if (!pid) continue;
    try {
      if (IS_WIN) process.kill(pid);
      else process.kill(-pid, 'SIGTERM'); // detached child leads its own group
      console.log(ok(`stopped ${name} (pid ${pid})`));
    } catch { console.log(warn(`${name} (pid ${pid}) was not running`)); }
  }
  try { rmSync(RUN_FILE); } catch {}
}

async function openAndWait(mode = 'browser') {
  const port = startServices();
  process.stdout.write('  waiting for frontend');
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write('.');
    if ((await probe(`http://127.0.0.1:${port}/login`)) === 200) {
      const url = `http://localhost:${port}`;
      if (mode === 'app') { console.log(`\n  ${ok('up — opening native app window')}`); appWindow(url); }
      else { console.log(`\n  ${ok('up — opening browser')}`); openBrowser(url); }
      return;
    }
  }
  console.log(`\n  ${warn('not ready after 120s — check: vps-cr status')}`);
}

// ---- dispatch ------------------------------------------------------------
(async () => {
  switch (cmd) {
    case 'help': case 'h': showHelp(); break;
    case 'doctor': await doctor(); break;
    case 'config': case 'install': case 'onboard': await config(); break;
    case 'status': case 'health': await status(); break;
    case 'acc': case 'approve': device('approve'); break;
    case 'list': device('list'); break;
    case 'revoke': device('revoke'); break;
    case 'secret': console.log(genSecret()); break;
    case 'open': await openAndWait('browser'); break;
    case 'app': await openAndWait('app'); break;
    case 'start': startServices(); break;
    case 'build': build(); break;
    case 'stop': stopServices(); break;
    default: console.log(warn(`unknown command: ${cmd}`)); showHelp();
  }
})();
