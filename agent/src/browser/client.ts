// BrowserClient — drives the os-vps remote browser through ITS authed + audited
// HTTP API (/api/v1/browser/*), authenticating with the agent token header.
//
// SECURITY: this client NEVER holds OS_BROWSER_SECRET and NEVER talks to the
// runtime port (:4002) directly. os-vps is the single auth boundary in front of
// the browser; we send `x-os-agent-token` and let os-vps verify + audit every
// action. Shapes mirror rahman-browser-protocol (kept inline to avoid a
// cross-repo dependency).
import { config } from "../config.js";

export interface ScannedElement {
  tag: string;
  type?: string;
  role?: string;
  text: string;
  href?: string;
  selector: string;
  box: { x: number; y: number; w: number; h: number };
}
export interface PageState {
  url: string;
  title: string;
}
export interface ElementsResponse extends PageState {
  elements: ScannedElement[];
}

export class BrowserClient {
  constructor(
    private readonly baseUrl = config.OS_VPS_URL,
    private readonly token = config.OS_AGENT_TOKEN ?? "",
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1/browser${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        "x-os-agent-token": this.token,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`browser ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.call<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  }

  // --- reads ---
  state(): Promise<PageState> {
    return this.call<PageState>("/state");
  }
  content(): Promise<PageState & { text: string }> {
    return this.call("/content");
  }
  elements(): Promise<ElementsResponse> {
    return this.call<ElementsResponse>("/elements");
  }
  async screenshot(jpeg = true): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/v1/browser/screenshot${jpeg ? "?type=jpeg&q=60" : ""}`, {
      headers: { "x-os-agent-token": this.token },
    });
    if (!res.ok) throw new Error(`browser /screenshot → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // --- actions ---
  navigate(url: string): Promise<PageState> {
    return this.post<PageState>("/navigate", { url });
  }
  click(x: number, y: number): Promise<PageState> {
    return this.post<PageState>("/click", { x, y });
  }
  clickSelector(selector: string): Promise<PageState> {
    return this.post<PageState>("/click-selector", { selector });
  }
  fill(selector: string, value: string): Promise<{ ok: boolean }> {
    return this.post("/fill", { selector, value });
  }
  type(text: string): Promise<{ ok: boolean }> {
    return this.post("/type", { text });
  }
  key(key: string): Promise<PageState> {
    return this.post<PageState>("/key", { key });
  }
  scroll(dy: number): Promise<{ ok: boolean }> {
    return this.post("/scroll", { dy });
  }
  reload(): Promise<PageState> {
    return this.post<PageState>("/reload");
  }

  // --- helpers ---
  wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
  /** True when the page's visible text contains `needle` (CRUD verification). */
  async assertText(needle: string): Promise<boolean> {
    const { text } = await this.content();
    return text.includes(needle);
  }
  /** Find a scanned element whose visible text matches (case-insensitive). */
  async findByText(needle: string): Promise<ScannedElement | undefined> {
    const { elements } = await this.elements();
    const n = needle.toLowerCase();
    return elements.find((e) => e.text.toLowerCase().includes(n));
  }
}

/** True when OS_VPS_URL + a >=16-char OS_AGENT_TOKEN are configured. */
export function browserConfigured(): boolean {
  return Boolean(config.OS_VPS_URL) && (config.OS_AGENT_TOKEN ?? "").length >= 16;
}
