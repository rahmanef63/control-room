import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TERMINAL_PROFILES, resolveTerminalLaunch } from './profiles.js';

test('built-in profiles stay terminal-only and predictable', () => {
  assert.deepEqual(
    TERMINAL_PROFILES.map((item) => item.profile),
    ['shell', 'codex', 'claude', 'gemini', 'openclaw'],
  );
});

test('shell launch honors an existing absolute cwd and scrubs Control Room auth values', () => {
  const previous = {
    login: process.env.CONTROL_ROOM_SECRET,
    session: process.env.CONTROL_ROOM_SESSION_SECRET,
    gateway: process.env.AGENT_GATEWAY_SECRET,
  };
  process.env.CONTROL_ROOM_SECRET = 'temporary-test-login-value';
  process.env.CONTROL_ROOM_SESSION_SECRET = 'temporary-test-session-value';
  process.env.AGENT_GATEWAY_SECRET = 'temporary-test-gateway-value';

  try {
    const launch = resolveTerminalLaunch({ profile: 'shell', cwd: '/tmp' });
    assert.equal(launch.profile, 'shell');
    assert.equal(launch.cwd, '/tmp');
    assert.equal(launch.env.TERM, 'xterm-256color');
    assert.equal(launch.env.COLORTERM, 'truecolor');
    assert.equal(launch.env.CONTROL_ROOM_SECRET, undefined);
    assert.equal(launch.env.CONTROL_ROOM_SESSION_SECRET, undefined);
    assert.equal(launch.env.AGENT_GATEWAY_SECRET, undefined);
  } finally {
    if (previous.login === undefined) delete process.env.CONTROL_ROOM_SECRET;
    else process.env.CONTROL_ROOM_SECRET = previous.login;
    if (previous.session === undefined) delete process.env.CONTROL_ROOM_SESSION_SECRET;
    else process.env.CONTROL_ROOM_SESSION_SECRET = previous.session;
    if (previous.gateway === undefined) delete process.env.AGENT_GATEWAY_SECRET;
    else process.env.AGENT_GATEWAY_SECRET = previous.gateway;
  }
});

test('invalid cwd falls back instead of launching in a nonexistent path', () => {
  const launch = resolveTerminalLaunch({ profile: 'shell', cwd: '/definitely/not/a/control-room-directory' });
  assert.notEqual(launch.cwd, '/definitely/not/a/control-room-directory');
});

test('CLI profiles remain thin terminal launch wrappers', () => {
  const codex = resolveTerminalLaunch({ profile: 'codex', dangerouslyAllow: true });
  assert.equal(codex.title, 'Codex (YOLO)');
  assert.match(codex.args.join(' '), /codex/);
  assert.match(codex.args.join(' '), /--yolo/);

  const claude = resolveTerminalLaunch({ profile: 'claude', dangerouslyAllow: true });
  assert.equal(claude.title, 'Claude (YOLO)');
  assert.match(claude.args.join(' '), /claude/);
  assert.match(claude.args.join(' '), /--dangerously-skip-permissions/);

  const gemini = resolveTerminalLaunch({ profile: 'gemini', dangerouslyAllow: true });
  assert.equal(gemini.title, 'Gemini (YOLO)');
  assert.match(gemini.args.join(' '), /gemini/);
  assert.match(gemini.args.join(' '), /--yolo/);

  const openclaw = resolveTerminalLaunch({ profile: 'openclaw', dangerouslyAllow: true });
  assert.equal(openclaw.title, 'OpenClaw (YOLO)');
  assert.match(openclaw.args.join(' '), /openclaw/);
});

test('unknown runtime configuration ids fail closed', () => {
  assert.throws(
    () => resolveTerminalLaunch({ profile: 'shell', environmentId: '__missing_environment__' }),
    /Unknown environment/,
  );
  assert.throws(
    () => resolveTerminalLaunch({ profile: 'shell', agentProfileId: '__missing_agent__' }),
    /Unknown agent profile/,
  );
});
