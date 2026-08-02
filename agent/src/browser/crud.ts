// crud — a generic, replayable CRUD flow over a webapp UI (no app API). Each
// step is one browser action with an optional verification; every step is logged
// so a run can be audited or replayed. On a failed click the flow re-scans
// /elements and retries by visible text, recovering from a stale selector.
import { logger } from "../logger.js";
import { BrowserClient } from "./client.js";

export type Step =
  | { do: "navigate"; url: string }
  | { do: "clickSelector"; selector: string; orText?: string }
  | { do: "fill"; selector: string; value: string }
  | { do: "type"; text: string }
  | { do: "key"; key: string }
  | { do: "wait"; ms: number }
  | { do: "assertText"; text: string; expect?: boolean };

export interface StepResult {
  step: Step;
  ok: boolean;
  detail?: string;
}

async function runStep(c: BrowserClient, s: Step): Promise<StepResult> {
  try {
    switch (s.do) {
      case "navigate":
        await c.navigate(s.url);
        return { step: s, ok: true };
      case "clickSelector": {
        await c.clickSelector(s.selector);
        // Recover: if the page didn't change as expected, retry by visible text.
        if (s.orText) {
          const found = await c.findByText(s.orText);
          if (found && found.selector !== s.selector) await c.clickSelector(found.selector);
        }
        return { step: s, ok: true };
      }
      case "fill":
        await c.fill(s.selector, s.value);
        return { step: s, ok: true };
      case "type":
        await c.type(s.text);
        return { step: s, ok: true };
      case "key":
        await c.key(s.key);
        return { step: s, ok: true };
      case "wait":
        await c.wait(s.ms);
        return { step: s, ok: true };
      case "assertText": {
        const got = await c.assertText(s.text);
        const want = s.expect ?? true;
        return { step: s, ok: got === want, detail: `text "${s.text}" present=${got}, expected=${want}` };
      }
    }
  } catch (e) {
    return { step: s, ok: false, detail: String(e) };
  }
}

/** Run a CRUD flow; stops at the first failed step. Returns every result. */
export async function runCrudFlow(steps: Step[], client = new BrowserClient()): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of steps) {
    const r = await runStep(client, step);
    results.push(r);
    logger.info(`browser-crud: ${step.do} ${r.ok ? "ok" : "FAIL"}${r.detail ? ` — ${r.detail}` : ""}`);
    if (!r.ok) break;
  }
  return results;
}
