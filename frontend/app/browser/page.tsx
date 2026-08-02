'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';

const EXAMPLE = JSON.stringify(
  {
    steps: [
      { do: 'navigate', url: 'https://demo.playwright.dev/todomvc/' },
      { do: 'wait', ms: 1500 },
      { do: 'clickSelector', selector: '.new-todo' },
      { do: 'type', text: 'browser-agent CRUD test' },
      { do: 'key', key: 'Enter' },
      { do: 'wait', ms: 500 },
      { do: 'assertText', text: 'browser-agent CRUD test' },
      { do: 'clickSelector', selector: '.todo-list li .toggle' },
      { do: 'clickSelector', selector: '.clear-completed' },
      { do: 'assertText', text: 'browser-agent CRUD test', expect: false },
    ],
  },
  null,
  2,
);

// Browser CRUD console: drive the os-vps remote browser through the agent. The
// agent runs each step (navigate/click/fill/type/assertText...) on its own tab
// and returns a per-step result, so you operate any webapp by its UI — no app
// API. The gateway secret stays server-side (app/api/browser/crud proxy).
export default function BrowserCrudPage() {
  const [input, setInput] = useState(EXAMPLE);
  const [result, setResult] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult('');
    try {
      const parsed = JSON.parse(input);
      const res = await fetch('/api/browser/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (res.status === 501) {
        setResult(
          'Browser CRUD is an optional add-on and is not configured.\n\n' +
            'It proxies to a paired os-vps deployment that runs the headless browser.\n' +
            'Set OS_VPS_URL + OS_AGENT_TOKEN in .env.local to enable it, then restart\n' +
            'the agent. See docs/browser-crud.md.',
        );
        return;
      }
      setResult(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Browser CRUD</h1>
        <Link href="/" className="ml-auto text-sm text-muted-foreground hover:underline">
          ← Terminals
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">
        Optional add-on. Drive a paired os-vps headless browser through the agent —
        set <span className="font-mono">OS_VPS_URL</span> +{' '}
        <span className="font-mono">OS_AGENT_TOKEN</span> to enable. Edit the step list,
        then run it against any webapp&apos;s UI.
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        className="h-72 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-xs"
      />
      <div>
        <Button onClick={run} disabled={busy}>
          <Play className="h-4 w-4" />
          {busy ? 'Running…' : 'Run flow'}
        </Button>
      </div>
      {result && (
        <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs">
          {result}
        </pre>
      )}
    </main>
  );
}
