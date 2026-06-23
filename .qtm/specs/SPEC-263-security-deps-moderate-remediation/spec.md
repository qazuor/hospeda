---
spec-id: SPEC-263
title: Security deps moderate remediation (framework bumps + overrides)
type: security
complexity: medium
status: draft
created: 2026-06-22T00:00:00Z
effort_estimate_hours: 8-16
tags: [security, dependencies, supply-chain, framework-bump, overrides]
extracted_from: SPEC-129 low-risk pass (2026-06-22)
priority: medium
dependsOn: []
---

# SPEC-263: Security deps moderate remediation (framework bumps + overrides)

## Part 1 — Overview & Goals

**Goal:** Clear the **20 remaining moderate/low** dependency advisories left after SPEC-129's
low-risk pass. None of these block the CI Security gate (which runs `--audit-level=high` and is
already green), so this is **defense-in-depth hardening**, not a gate unblock. Each remaining
advisory needs either a framework-level bump or a `pnpm.overrides` entry — both carry real
regression risk and so were deliberately deferred out of SPEC-129.

**Why now / why later:** SPEC-129 cleared the 2 original blockers (already resolved by prior
bumps) plus `dompurify` (16 advisories) and the easy transitive duplicates via `pnpm dedupe`.
What remains touches auth, admin routing, the Astro/nitro SSR stack, and deep build-tool
transitives. This spec can run after the go-live blockers (it does not gate production), but
should land before broad public exposure.

**Baseline:** see `../SPEC-129-security-audit-vulnerabilities/risk-accepted.md` for the full
accepted-risk table captured at SPEC-129 close.

## Part 2 — Scope (work items)

### A. Framework-coupled bumps (build/SSR/routing regression risk)

1. **`better-auth` → `>=1.6.2`** — OAuth callback `state` mismatch fix. **MUST** be validated
   with an end-to-end Google + Facebook + magic-link OAuth smoke on staging before merge
   (the fix tightens `state` validation and can surface latent callback bugs).
2. **`@tanstack/start-server-core` → `>=1.167.30`** — server-function deserialization fix.
   Bump TanStack Start in `apps/admin`; watch for `routeTree.gen` regressions and run the admin
   smoke.
3. **Astro / nitro / h3 stack** — `h3` (3 advisories: SSE injection, cookie-loop DoS, mount
   path-boundary), `nitropack` (2 advisories: open redirect, proxy scope bypass). These are
   transitive via Astro 6.4.7 → resolve by bumping Astro/`@astrojs/node` to a release that pins
   patched `h3`/`nitropack`, or via overrides if no coordinated release exists. Validate the
   `apps/web` + `apps/landing` SSR build and a content-page render.

### B. Deep transitives (override-only; weigh maintenance cost)

For each, there is no patched parent release, so the only fix is a root `pnpm.overrides` entry.
Add overrides one at a time and re-run the full build + test to confirm the parent still works:

4. `@opentelemetry/core` → `>=2.8.0` (unbounded memory in W3C Baggage propagation)
5. `file-type` → `>=21.3.1` (infinite loop in ASF parser)
6. `serialize-javascript` → `>=7.0.5` (CPU-exhaustion DoS)
7. `tar` → `>=7.5.16` (PAX size-override parser differential)
8. `ua-parser-js` → `>=2.0.10` (ReDoS in `withClientHints()`)
9. `uuid` → `>=11.1.1` (missing buffer bounds check in v3/v5/v6 with `buf`)

### C. Re-confirm `sanitize-html`

The `sanitize-html` 2.17.0 critical advisory (GHSA-rpr9-rxv7-x643) no longer matches in the
current audit. Verify against the upstream Apostrophe tracker whether a 2.17.x patch or a clean
upgrade exists, and bump if so. If still unpatched but no longer reported, document the final
state.

## Part 3 — Acceptance Criteria

- [ ] `pnpm audit --prod` reports **0 critical / 0 high / 0 moderate** (lows may remain if
      genuinely unpatchable, each documented).
- [ ] CI Security job stays green.
- [ ] OAuth signup (Google + Facebook + magic-link) verified end-to-end on staging after the
      `better-auth` bump.
- [ ] Admin smoke (routing, rich-text, key flows) green after the TanStack Start bump.
- [ ] `apps/web` + `apps/landing` SSR build green and a content page renders after the Astro/nitro/h3 bump.
- [ ] Every `pnpm.overrides` entry added is justified inline (advisory id + why no parent release).
- [ ] No regression in web/admin/api smoke tests.

## Part 4 — Risks & Notes

- **`better-auth`** is the highest-risk item — auth regression locks every user out. Smoke OAuth
  on staging, not just locally (the local stub does not exercise the real callback).
- **Overrides are a maintenance burden** — each one pins a transitive that future installs must
  keep honoring. Prefer a parent bump whenever one exists; only override when there is no patched
  parent.
- **Astro/nitro is a coupled bump** — `@astrojs/node`, `astro`, `nitropack`, `h3` version-lock;
  bump them as a batch and read the changelog for breaking changes.
