import os from 'os';

import type { TerminalProfile } from '@/lib/types';

export interface TerminalLaunchSpec {
  profile: TerminalProfile;
  title: string;
  command: string;
  args: string[];
  cwd: string;
}

const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';
const DEFAULT_CWD = process.env.TERMINAL_DEFAULT_CWD || `/home/${os.userInfo().username}`;

function escapeForSingleQuotes(input: string): string {
  return input.replace(/'/g, `'\\''`);
}

function missingBinaryFallback(binary: string): string {
  const safeBinary = escapeForSingleQuotes(binary);
  const safeShell = escapeForSingleQuotes(DEFAULT_SHELL);
  return `printf '\\r\\n[%s] is not installed on this VPS. Dropping into a shell.\\r\\n' '${safeBinary}'; exec '${safeShell}' -li`;
}

function interactiveBinaryCommand(binary: string, args: string[] = []): string {
  const safeBinary = escapeForSingleQuotes(binary);
  const shellCommand = [safeBinary, ...args.map(escapeForSingleQuotes)].join(' ');

  return [
    `if command -v '${safeBinary}' >/dev/null 2>&1; then`,
    `  exec ${shellCommand};`,
    'else',
    `  ${missingBinaryFallback(binary)};`,
    'fi',
  ].join(' ');
}

export const TERMINAL_PROFILES: Array<{
  profile: TerminalProfile;
  title: string;
  description: string;
}> = [
  { profile: 'shell', title: 'Empty Terminal', description: 'Interactive login shell on the VPS host.' },
  { profile: 'codex', title: 'Codex', description: 'Start a Codex CLI session directly in the terminal.' },
  { profile: 'claude', title: 'Claude', description: 'Start a Claude CLI session if the binary is installed.' },
  { profile: 'gemini', title: 'Gemini', description: 'Start a Gemini CLI session if the binary is installed.' },
  { profile: 'openclaw', title: 'OpenClaw TUI', description: 'Start OpenClaw in interactive mode on the VPS host.' },
];

export function resolveTerminalLaunch(profile: TerminalProfile): TerminalLaunchSpec {
  switch (profile) {
    case 'shell':
      return {
        profile,
        title: 'Empty Terminal',
        command: DEFAULT_SHELL,
        args: ['-li'],
        cwd: DEFAULT_CWD,
      };
    case 'codex':
      return {
        profile,
        title: 'Codex',
        command: '/bin/bash',
        args: ['-lc', interactiveBinaryCommand('codex')],
        cwd: DEFAULT_CWD,
      };
    case 'claude':
      return {
        profile,
        title: 'Claude',
        command: '/bin/bash',
        args: ['-lc', interactiveBinaryCommand('claude')],
        cwd: DEFAULT_CWD,
      };
    case 'gemini':
      return {
        profile,
        title: 'Gemini',
        command: '/bin/bash',
        args: ['-lc', interactiveBinaryCommand('gemini')],
        cwd: DEFAULT_CWD,
      };
    case 'openclaw':
      return {
        profile,
        title: 'OpenClaw TUI',
        command: '/bin/bash',
        args: [
          '-lc',
          [
            "if command -v 'openclaw' >/dev/null 2>&1; then",
            "  if openclaw tui --help >/dev/null 2>&1; then",
            '    exec openclaw tui;',
            '  else',
            '    exec openclaw;',
            '  fi;',
            'else',
            `  ${missingBinaryFallback('openclaw')};`,
            'fi',
          ].join(' '),
        ],
        cwd: DEFAULT_CWD,
      };
    default: {
      const exhaustiveCheck: never = profile;
      throw new Error(`Unsupported terminal profile: ${exhaustiveCheck}`);
    }
  }
}
