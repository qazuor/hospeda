---
spec-id: SPEC-144
title: Admin design-token contrast remediation (badges, muted text, destructive on muted bg)
type: feature
complexity: medium
status: draft
created: 2026-05-16T13:00:00Z
renumberedFrom: SPEC-141
renumberedAt: 2026-05-17T23:50:00Z
renumberedReason: Collision with SPEC-141 subscription post-launch follow-ups (merged via PR #1139, commit 7c27b995a) — engram registry resolved in favor of the merged work; this draft renumbered to SPEC-144 (next free after SPEC-143 billing-testing-coverage reservation).
effort_estimate_hours: 4-8
tags: [admin, accessibility, wcag, design-tokens, tailwind]
parent: SPEC-134
extractedFrom: SPEC-136 post-fix axe verification (2026-05-16)
priority: medium
findings_addressed: [color-contrast-residual]
---

# SPEC-144: Admin design-token contrast remediation

## 1. Overview

SPEC-136 closed the named axe findings (F-003..F-019) and brought the admin to **0 critical / 0 serious** for the targeted rules. The post-fix axe sweep surfaced a residual `color-contrast` (serious) cluster — **47 nodes across 8 admin pages** — that does NOT match the F-014 sort-header pattern SPEC-136 targeted. These are global design-token contrast failures in `bg-muted text-muted-foreground` badges, `text-muted-foreground text-xs` form helpers, and `bg-destructive/5 text-destructive` accent buttons.

SPEC-136 deferred this cluster on scope and design-review grounds (see SPEC-136 `spec.md` §4). This spec lands the design-token fix.

## 2. Findings in scope

Re-run the SPEC-134 audit-baseline sweep against admin after SPEC-136 merges to staging. Expected violations (snapshot from 2026-05-16 verification):

| Page | Nodes | Pattern |
|---|---|---|
| `/access/users` | 27 | Role badges: `bg-muted text-muted-foreground` ("Sistema") |
| `/events` | 6 | Type badges: same token combo ("Otro") |
| `/posts` | 2 | Tag badges: same token combo ("Tradiciones") |
| `/access/users/$id` | 1 | Destructive button on muted bg: `bg-destructive/5 text-destructive` |
| `/access/users/$id/edit` | 5 | Truncated text spans (inherit muted from parent) |
| `/access/users/new` | 2 | Form progress helper: `text-muted-foreground text-xs` ("0/4 campos completos") |
| `/billing/settings` | 3 | Error text on muted: `font-medium text-destructive` over muted card |
| `/destinations` | 1 | "(predeterminado)" suffix: `text-muted-foreground` |

Total: 47 nodes, 8 pages.

## 3. Root causes

1. **Badge variant tokens** — `bg-muted text-muted-foreground` gives ~3.5:1 contrast in light mode, ~4.0:1 in dark mode. Both below WCAG 2.1 AA 4.5:1 for normal text.
2. **`text-muted-foreground text-xs`** — small text on white needs 4.5:1; the muted foreground HSL value is too close to muted/background pairings on form helpers.
3. **`bg-destructive/5 text-destructive`** — destructive text on a 5%-tinted destructive background fails because the bg is too washed-out to contrast against destructive red.
4. **Truncated text without explicit color** — inherits parent color which in some card layouts is `text-muted-foreground`.

## 4. Fix shape (proposed)

### A. Tailwind config

Edit `packages/tailwind-config/src/index.ts` (or the shared theme file admin imports):

- Bump `muted-foreground` HSL to meet 4.5:1 against `muted` AND `background`. Likely a ~15-20% shift toward foreground.
- Add a new `muted-foreground-strong` token for cases where the existing muted needs to stay subtle for visual hierarchy but axe-affected nodes need higher contrast.

### B. Badge variants

In `apps/admin/src/components/ui/badge.tsx` (or wherever the muted Badge variant lives), the default variant `secondary` / `muted` should use the new strong-contrast token. Affected pages: `/access/users`, `/events`, `/posts`.

### C. Destructive-on-muted

Replace `bg-destructive/5 text-destructive` on `/access/users/$id` action button with `bg-destructive/10 text-destructive-foreground` OR raise opacity of the bg to give the text adequate contrast. Audit other usages of this pattern (`grep -r "bg-destructive/" apps/admin/src`).

### D. Truncated text spans

In `/access/users/$id/edit` and similar, add explicit `text-foreground` on the truncated span so it doesn't inherit muted from a parent.

### E. Form helpers

`text-muted-foreground text-xs` on "0/4 campos completos" needs `text-foreground` OR a new `text-muted-strong text-xs` token.

## 5. Acceptance criteria

- [ ] Re-run audit-baseline sweep against admin — 0 `color-contrast` violations on the 8 pages listed in §2.
- [ ] Dark-mode contrast also passes (axe sweep at `prefers-color-scheme: dark` OR manual check with dev tools).
- [ ] Visual review by design — the bumped tokens still feel subordinate to primary content (don't compete with `text-foreground`).
- [ ] No regression on shadcn component variants (Badge, Button, Card) — check with `apps/admin/test/visual/` snapshots if they exist.
- [ ] Web app (`apps/web`) — verify the same tokens are NOT in use, OR if they are, audit the web pages too and decide whether to bump globally or admin-only.

## 6. Out of scope

- Icon contrast (axe doesn't flag those at AA).
- The CardTitle / heading-level work already shipped in SPEC-136.
- Web app overhaul beyond the verify-tokens step in §5 last bullet.

## 7. Risks

- **Design regression**: bumping `muted-foreground` may make every muted text feel less "soft", changing the perceived hierarchy across the entire app. Tradeoff is design vs accessibility — design should be consulted before merging.
- **Dark mode**: Shadcn theme variables differ between light + dark. Fix must verify both modes pass AA contrast.
- **Token sprawl**: Introducing `muted-foreground-strong` adds a token to maintain. Cleaner to bump `muted-foreground` itself IF design signs off. The two-token approach is the fallback.

## 8. Verification workflow

Same as SPEC-136 — see SPEC-134 audit-baseline `_scripts/sweep.ts` and `aggregate-axe.ts`. Filter to the 8 affected pages with `ONLY_ENTITY=access ONLY_ENTITY=billing` (or run the full critical priority).
