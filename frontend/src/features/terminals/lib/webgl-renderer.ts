import type { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';

// Load xterm's GPU (WebGL) renderer. With many panes streaming output, the
// default DOM renderer is a heavy CPU sink on the client (local AND remote VPS
// users); WebGL offloads glyph drawing to the GPU and cuts that cost sharply.
//
// Safe by construction: if WebGL is unavailable (some mobile browsers) the
// constructor/loadAddon throws and we keep the DOM renderer; if the browser runs
// out of WebGL contexts later (many panes), `onContextLoss` disposes the addon
// and xterm transparently falls back to the DOM renderer for that pane. So the
// worst case equals the previous behavior — never worse.
//
// Must be called AFTER `term.open(container)` (WebGL needs the attached element).
export function tryLoadWebglRenderer(term: Terminal): void {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => addon.dispose());
    term.loadAddon(addon);
  } catch {
    // No WebGL context — DOM renderer stays in place.
  }
}
