---
name: Feature request
about: Propose a new feature or enhancement
title: 'feat: '
labels: enhancement
---

## Problem

<!-- What's the pain point this would solve? Real-life example preferred. -->

## Proposed solution

<!-- High-level shape. UX sketch / API sketch welcome. -->

## Alternatives considered

<!-- What else did you think about? Why did you discard them? -->

## Scope check

Control Room v2 is a **single-owner, self-hosted terminal multiplexer**. Confirm
the proposal fits the product boundary:

- [ ] Directly improves creating, organizing, reconnecting to, or interacting with terminal sessions
- [ ] Works for one operator (not multi-user / multi-tenant)
- [ ] Does not make Control Room own another tool's credentials, browser automation, scheduler, or deployment lifecycle
- [ ] Does not add project-specific runtime coupling
- [ ] Does not send telemetry to a third party
- [ ] Documents any new authentication/network/host-privilege impact

If the feature belongs inside a CLI/tool running in a terminal, prefer keeping it
there rather than expanding Control Room core.

## Willing to contribute?

- [ ] I can send a PR
- [ ] I can test someone else's PR
- [ ] I just want to suggest it
