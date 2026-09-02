import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

import { clampFontSize, TERMINAL_SCROLLBACK } from './types';

export function createXtermRuntime(fontSize: number): { term: XTerm; fitAddon: FitAddon } {
  const term = new XTerm({
    scrollback: TERMINAL_SCROLLBACK,
    fontSize: clampFontSize(fontSize),
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: 1.18,
    convertEol: true,
    cursorBlink: true,
    rightClickSelectsWord: true,
    macOptionClickForcesSelection: true,
    allowProposedApi: true,
    theme: {
      background: '#08111f', foreground: '#d7e3f6', cursor: '#f8fafc', black: '#08111f',
      red: '#fb7185', green: '#4ade80', yellow: '#facc15', blue: '#60a5fa',
      magenta: '#f472b6', cyan: '#22d3ee', white: '#d7e3f6', brightBlack: '#334155',
      brightRed: '#fda4af', brightGreen: '#86efac', brightYellow: '#fde047', brightBlue: '#93c5fd',
      brightMagenta: '#f9a8d4', brightCyan: '#67e8f9', brightWhite: '#f8fafc'
    }
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  return { term, fitAddon };
}

export function attachWebgl(term: XTerm): void {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => addon.dispose());
    term.loadAddon(addon);
  } catch {
    // DOM renderer remains active when WebGL is unavailable.
  }
}
