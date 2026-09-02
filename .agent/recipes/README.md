# Recipes

Recipes capture repeated reasoning/tool workflows before they deserve executable automation.

Lifecycle:

`observed → repeated → verified → scripted`

Use `bun run recipe:observe -- --name <name> ...` after a useful repeated workflow. A second observation automatically marks it `repeated`. Promote only after the preconditions, safety, and verification are stable. Deterministic scripts belong in `scripts/engineering/` and should produce structured output.
