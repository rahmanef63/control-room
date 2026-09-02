# Engineering workflow: evidence, memory, and safe iteration

Control Room keeps its development workflow inside this repository. The goal is not enterprise ceremony; it is to make solo development safer while reducing repeated investigation and tool usage over time.

## 1. Start from the real repository state

Before changing code, inspect branch/HEAD, dirty files, stack, tests, browser coverage, deployment flow, docs, existing memory, and relevant technical debt. Do not assume a previous chat or report is still current.

## 2. Choose isolation by risk

| Risk | Typical work | Default |
|---|---|---|
| Low | copy, spacing, typo, tiny isolated style/docs | direct `main` is acceptable after targeted checks |
| Medium | one feature/slice, new behavior, multi-file component change | short-lived branch/worktree when it improves safety |
| High | auth, schema/state migration, shared architecture, deployment/runtime config, destructive work, overlapping agents | branch/worktree required |

The rule is not “never work on main.” The rule is: **never make an unverified high-risk change directly on main.**

Production should point at a known-good commit/release. `main` may be an integration branch while the product is actively developed.

## 3. Verification is evidence, not a feeling

A change is done only when the relevant claim has proof. Evidence receipts live in `.agent/evidence/receipts/` and record:

- repository commit and dirty state;
- environment and target;
- explicit assertions;
- check/test/build results;
- browser result;
- console/network error counts when relevant;
- deployment state when relevant.

Create a receipt manually:

```bash
bun run evidence:create -- \
  --target "mobile navigation" \
  --environment development \
  --assert "navigation fits narrow viewport=passed" \
  --check "frontend-check=passed" \
  --check "playwright=passed" \
  --browser passed \
  --artifact .agent/evidence/artifacts/terminal-workspace-after-mobile.png
```

For UI work, the reusable pipeline is:

```bash
bun run verify:ui -- --target "mobile navigation" --record
```

It runs Svelte diagnostics, lint, frontend unit tests, production build, and Playwright. Playwright also fails on unexpected browser `console.error`, page errors, transport failures, and HTTP 5xx responses.

Use before/after screenshots only when they prove something useful: a regression, a meaningful layout change, or a problematic state. Generated screenshots/traces belong in `.agent/evidence/artifacts/`, stay local/private by default, and can be referenced from a receipt with repeated `--artifact` flags.

## 4. Repository-local memory

`.agent/memory/` is canonical engineering memory. It is Markdown + frontmatter so a developer can read it without a database or external service.

Create records with:

```bash
bun run memory:new -- --type debug --title "Terminal first row disappears" --scope terminal --tags mobile,xterm
bun run memory:new -- --type test --title "User mobile fullscreen retest" --source user-manual --scope terminal
bun run memory:new -- --type failure --title "Resize-before-fit workaround" --scope terminal
```

Search only when the task is heavy enough to benefit:

```bash
bun run memory:query -- terminal freeze mobile
bun run memory:query -- --type failure xterm resize
```

Memory types:

- **task** — task, scope, result, files, verification, remaining issue;
- **debug** — symptoms, reproduction, root cause, attempts, failed approaches, fix, regression tests/evidence;
- **test** — automated or user-manual test steps and observations;
- **decision** — architecture/process decision and rationale;
- **failure** — approaches that failed so they are not repeated blindly.

Lifecycle is `active → confirmed → superseded → archived`. Supersede old knowledge instead of silently deleting history:

```bash
bun run memory:supersede -- --file .agent/memory/decisions/old.md --by .agent/memory/decisions/new.md
```

For a trivial copy/spacing change, do not perform a heavy memory search. For intermittent runtime bugs, auth, complex sync, responsive architecture, or broad refactors, search related debug/test/failure records before modifying code.

## 5. User manual tests are first-class evidence

When the user reports “still broken,” “works now,” a freeze, a device-specific issue, or a reproduction sequence, create/update a `test` or `debug` memory record with `source: "user-manual"`. Record the environment and observation, not private credentials or session data.

The next debugging session should retrieve those records instead of rereading the entire conversation history.

## 6. Recipe to script

Repeated workflows evolve gradually:

`observed → repeated → verified → scripted`

Record an observation:

```bash
bun run recipe:observe -- \
  --name verify-responsive-ui \
  --summary "Check mobile/desktop layout and browser errors" \
  --steps "check → build → Playwright → receipt"
```

A second observation automatically marks it `repeated`. Only promote it when preconditions, safety, and verification are stable:

```bash
bun run recipe:promote -- --name verify-responsive-ui --status verified
bun run recipe:promote -- --name verify-responsive-ui --status scripted --script "bun run verify:ui"
```

Recipes still allow reasoning. Scripts are for deterministic work. Do not create a script after one accidental repetition.

## 7. Privacy and secret handling

Memory and evidence may contain internal routes, hostnames, user observations, or console output. They must never contain raw tokens, passwords, cookies, API keys, private keys, or credential values.

Run:

```bash
bun run evidence:check
```

The check scans canonical `.agent` memory/recipe/receipt files for secret-like material and validates receipt shape. Evidence creation also redacts common secret patterns in notes.

## 8. Daily flow

```text
classify risk
→ inspect relevant memory only when useful
→ isolate if required
→ change
→ targeted tests
→ build/browser verification when relevant
→ evidence receipt
→ update task/debug/test/failure memory
→ mark known-good commit/release
```

CI remains intentionally small. The root `bun run verify` is the repository quality gate; engineering-memory tests, documentation consistency checks, and artifact secret checks are part of it.

## Versi sederhana

- **Yang lebih aman:** perubahan besar tidak langsung mengotori `main`; hasil perubahan juga harus punya bukti test, bukan cuma “kayaknya sudah benar”.
- **Yang otomatis:** browser test sekarang ikut menangkap error console/network/server; script bisa membuat evidence receipt, mencari memory lama, dan mendeteksi workflow berulang.
- **Kapan perlu branch:** auth, deployment, shared refactor, destructive change, atau perubahan besar/berisiko. Perubahan sedang boleh pakai branch pendek. Perubahan kecil boleh langsung `main` setelah check.
- **Kapan langsung `main` boleh:** typo, copy, spacing, docs, atau perubahan kecil yang terisolasi dan mudah diverifikasi.
- **Bagaimana memory membantu:** bug, test user, solusi gagal, dan keputusan lama disimpan di repo. Session berikutnya cukup mencari topik yang relevan, tidak perlu membaca seluruh chat lama.
- **Yang dilakukan sehari-hari:** kerjakan seperti biasa; untuk task besar cari memory dulu, jalankan test yang relevan, buat evidence, lalu simpan hasil penting. Sistem teknisnya tetap di belakang layar.
