import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp } from 'lucide-react';

interface PaneScrollRailProps {
  onScroll: (lines: number) => void;
}

export function PaneScrollRail({ onScroll }: PaneScrollRailProps) {
  return (
    <aside className="terminal-pane-rail" aria-label="Scroll controls">
      <div className="rail-group">
        <button
          type="button"
          onClick={() => onScroll(-1)}
          className="rail-btn"
          aria-label="Scroll up 1 line"
          title="Scroll up 1 line"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onScroll(-10)}
          className="rail-btn"
          aria-label="Scroll up many lines"
          title="Scroll up many lines"
        >
          <ChevronsUp className="h-4 w-4" />
        </button>
      </div>
      <div className="rail-group">
        <button
          type="button"
          onClick={() => onScroll(10)}
          className="rail-btn"
          aria-label="Scroll down many lines"
          title="Scroll down many lines"
        >
          <ChevronsDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onScroll(1)}
          className="rail-btn"
          aria-label="Scroll down 1 line"
          title="Scroll down 1 line"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
