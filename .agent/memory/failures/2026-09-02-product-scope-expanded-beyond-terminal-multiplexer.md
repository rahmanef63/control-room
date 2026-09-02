---
type: "failure"
status: "confirmed"
confidence: "high"
created_at: "2026-09-02T18:11:15.457Z"
updated_at: "2026-09-02T18:16:09.280Z"
last_verified: "2026-09-02T18:16:09.280Z"
scope: "product-architecture"
tags: ["scope-creep", "terminal", "architecture"]
commit: "bdad906040aa6c4ebca2b605a89fd71201502634"
supersedes: null
superseded_by: null
source: "agent"
---

# Product scope expanded beyond terminal multiplexer

## Goal

Make Control Room standalone, reliable, and easier to maintain.

## Attempt

Instead of only removing cross-project dependencies, the isolated implementation moved several unrelated integration domains into Control Room itself and exposed them as product features.

## Why it failed

The dependency problem was replaced with product ownership of unrelated domains. Control Room became harder to understand and operate even though its intended job is only persistent terminal multiplexing through a browser/mobile UI.

## Evidence

The product boundary was explicitly clarified as a tmux-like terminal alternative. The simplification checkpoint removed the provider/credential, browser automation, scheduler, supervisory orchestration, managed-app, and generic host-exec surfaces; the checkpoint itself removed more than eight thousand lines from the over-expanded branch and the resulting repository passed all verification gates.

## Do not repeat until

Do not add non-terminal control-plane domains unless there is an explicit product decision to change Control Room from a terminal multiplexer into a broader operations platform.
