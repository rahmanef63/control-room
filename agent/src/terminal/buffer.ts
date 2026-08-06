// Scrollback for one pty session, kept as chunks instead of one giant string.
// The old shape was `buffer = truncate(buffer + chunk)`, which re-allocated and
// copied the whole 250 KB cap on EVERY pty chunk — a fast TUI emits hundreds of
// chunks/sec and this box runs up to 16 panes on one event loop, so that was
// hundreds of MB/s of memcpy competing with pty I/O, SSE fan-out and the health
// API. Appending is now O(chunk); the join is paid only when a reader actually
// wants the whole string (getBuffer / bootstrap), and is cached until the next
// append.
export const MAX_BUFFER_CHARS = 250_000;

export class ScrollbackBuffer {
  private chunks: string[] = [];
  private length = 0;
  private joined: string | null = "";

  constructor(private readonly maxChars: number = MAX_BUFFER_CHARS) {}

  append(data: string): void {
    if (!data) return;
    this.chunks.push(data);
    this.length += data.length;
    this.joined = null;
    if (this.length > this.maxChars) {
      this.trim();
    }
  }

  // Drop whole chunks off the front, slicing inside a chunk only when one
  // straddles the cap, so the newest maxChars characters survive.
  // ponytail: chunk count is bounded only by maxChars (a pty writing one char
  // at a time would hold 250k tiny strings). Real pty reads are KBs, so no
  // compaction pass on purpose.
  private trim(): void {
    let overflow = this.length - this.maxChars;
    let dropped = 0;
    while (overflow > 0) {
      const head = this.chunks[dropped]!;
      if (head.length <= overflow) {
        overflow -= head.length;
        dropped += 1;
        continue;
      }
      this.chunks[dropped] = head.slice(overflow);
      overflow = 0;
    }
    if (dropped > 0) {
      this.chunks.splice(0, dropped);
    }
    this.length = this.maxChars;
  }

  toString(): string {
    if (this.joined === null) {
      this.joined = this.chunks.join("");
    }
    return this.joined;
  }
}
