import { ReadOnlyTerminalView } from '@/features/terminals/components/readonly-terminal-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SharedTerminalPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="terminal-shell">
      <header className="terminal-topbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Read-only view
          </span>
          <span className="truncate font-mono text-xs text-foreground">{id}</span>
        </div>
      </header>
      <main className="terminal-main">
        <ReadOnlyTerminalView id={id} />
      </main>
    </div>
  );
}
