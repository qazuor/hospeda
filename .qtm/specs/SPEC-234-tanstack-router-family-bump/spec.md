---
spec-id: SPEC-234
title: TanStack Router family bump — unblock the production-minor-patch Dependabot group
type: chore
complexity: high
status: draft
created: 2026-06-15
---

# SPEC-234 — TanStack Router family bump (unblock production group)

## 1. Overview

### Goal

Migrate the `@tanstack/react-router` family (core + `-devtools` + `-ssr-query`) from
1.131 to 1.170 together, validate the admin app (notably the documented `/healthz`
route), then lift/narrow the Dependabot ignore so the grouped production dependency
PR can regenerate and merge cleanly.

### Motivation

Dependabot's grouped **production-minor-patch (66 updates)** PR ([PR #1615](https://github.com/qazuor/hospeda/pull/1615))
fails CI (Build, E2E P0). Root cause: `.github/dependabot.yml` ignores
`@tanstack/react-router` (per SPEC-219, because 1.131→1.170 risked the `/healthz` route),
but the ignore does NOT cover the sibling packages `@tanstack/react-router-devtools` and
`@tanstack/react-router-ssr-query`. The group still bumps those cousins to 1.167+, leaving
the router family version-split (core pinned at 1.131, cousins at 1.167) → broken build.

Two ways out: (a) migrate the whole router family to a single aligned version and lift the
ignore, or (b) extend the ignore to the cousins so the group stays internally consistent.
Option (a) is the real fix and is preferred; (b) is the stop-gap. This spec covers (a),
with (b) as an interim if needed.

### Success Criteria

- `@tanstack/react-router` + `-devtools` + `-ssr-query` all on the same 1.170 line.
- Admin app builds, typechecks, and the `/healthz` route + router behavior verified.
- Dependabot ignore for the router family lifted (or correctly scoped); a regenerated
  production group PR passes CI.

## 2. Scope

### In Scope

- Align and bump the `@tanstack/react-router` family across `apps/admin` (and anywhere used).
- Fix any router API breakages; verify `/healthz` and key routes.
- Update `.github/dependabot.yml`: remove the router ignore (after migration) or, as an
  interim, extend it to `-devtools` / `-ssr-query` to unblock the rest of the group.

### Out of Scope

- The other ignored majors (`zod` → SPEC-132; `@astrojs/node` → astro 6.4 follow-up).
- The non-router bumps in the group (they ride the regenerated PR once router is resolved).

## 3. Tasks (suggested)

- T-001: Bump the router family to 1.170 together; capture build/type/route breakages.
- T-002: Fix breakages; verify `/healthz` + router behavior in admin.
- T-003: Update `dependabot.yml` (lift/scope the ignore); `@dependabot recreate` the group.
- T-004: Confirm the regenerated production group PR passes CI; merge to `staging`.

## 4. References

- Dependabot group PR #1615 (closed — superseded by this spec).
- SPEC-219 (Dependabot CI hardening — added the original router ignore).
- `docs/guides/dependabot-policy.md`.
