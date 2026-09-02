import { fontSizeForPinch, touchDistance } from './pinch-zoom';

export function attachTerminalPinchZoom(
  node: HTMLElement,
  getFontSize: () => number,
  onChange?: (size: number) => void
): () => void {
  let startDistance = 0;
  let startFontSize = getFontSize();
  let lastAppliedSize = startFontSize;

  const reset = () => { startDistance = 0; };
  const start = (event: TouchEvent) => {
    if (!onChange || event.touches.length !== 2) { reset(); return; }
    startDistance = touchDistance(event.touches[0], event.touches[1]);
    startFontSize = getFontSize();
    lastAppliedSize = startFontSize;
    if (startDistance > 0) event.preventDefault();
  };
  const move = (event: TouchEvent) => {
    if (!onChange || startDistance <= 0 || event.touches.length !== 2) return;
    event.preventDefault();
    const next = fontSizeForPinch(startFontSize, startDistance, touchDistance(event.touches[0], event.touches[1]));
    if (next === lastAppliedSize) return;
    lastAppliedSize = next;
    onChange(next);
  };
  const end = (event: TouchEvent) => { if (event.touches.length < 2) reset(); };

  node.addEventListener('touchstart', start, { passive: false });
  node.addEventListener('touchmove', move, { passive: false });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', reset);
  return () => {
    node.removeEventListener('touchstart', start);
    node.removeEventListener('touchmove', move);
    node.removeEventListener('touchend', end);
    node.removeEventListener('touchcancel', reset);
  };
}
