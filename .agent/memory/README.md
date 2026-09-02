# Memory types

All records use Markdown plus frontmatter so they remain searchable, reviewable, and easy to diff.

- `tasks/`: scope, result, files, verification, remaining work.
- `debug/`: symptoms, reproduction, root cause, attempts, failed approaches, fix, regression proof.
- `tests/`: automated and manual test evidence. User manual testing is first-class and should use `source: "user-manual"`.
- `decisions/`: architecture/process decisions and rationale.
- `failures/`: approaches that failed, so later agents do not repeat them blindly.

Lifecycle: `active → confirmed → superseded → archived`. Supersede old records rather than deleting historical context.
