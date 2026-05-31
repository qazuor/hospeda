---
spec-id: SPEC-137
title: Admin i18n + Polish + Routing fixes
type: feature
complexity: medium
status: draft
created: 2026-05-16T01:30:00Z
effort_estimate_hours: 6-12
tags: [admin, i18n, polish, routing]
parent: SPEC-134
priority: medium
findings_addressed: [F-010, F-024, F-025, F-026, F-027, F-028, F-029, F-031]
deferred: [F-022]
findings_doc: ../SPEC-134-admin-audit-remediation/audit-baseline/findings.md
---

# SPEC-137: Admin i18n + Polish + Routing fixes

## 1. Overview

Cleanup of i18n inconsistencies, one critical routing bug, error UX, and visual polish nits. None of these are blockers individually but together they degrade the perceived quality of the admin. Most are XS/S effort.

## 2. Findings in scope (grouped by concern)

Refer to `../SPEC-134-admin-audit-remediation/audit-baseline/findings.md` for full detail.

### Group 1 — Routing bug — DEFERRED (out of scope)

> F-022 (`/accommodations/$id/gallery` renders byte-for-byte identical EDIT page) has been **removed from SPEC-137 scope** (decision 2026-05-16). Initial inspection suggests the Gallery feature was never implemented — only the route stub exists. That makes this a feature gap, not a routing bug. File separately as a new spec (e.g. "Accommodation gallery feature — implementation") and tackle independently.

### Group 2 — Error UX (do FIRST now that routing bug is deferred)

| Finding | Severity | Issue |
|---|---|---|
| F-024 | high | Raw Zod errors leaked to UI on `/billing/plans` + `/billing/settings` |

**Fix**:
- Wrap the API error in user-facing Spanish message at the hook/page level. Log details to Sentry only.
- Separately, the `/billing/plans` Zod schema is currently misaligned with the API response shape (response missing required fields, returning array instead of record for some fields). Either fix the schema OR fix the API response to match. This is two PRs.

### Group 3 — i18n cluster (bundle these)

| Finding | Severity | Issue |
|---|---|---|
| F-025 | medium | Breadcrumb shows raw URL slug (`Billing`, `Exchange-rates`, `Notifications`) instead of translation |
| F-028 | medium | `/notifications` has duplicate h1+h2 AND English breadcrumb |
| F-026 | medium | English empty state on `/accommodations/$id/amenities` ("No amenities…") |
| F-027 | medium | English plan descriptions in `/billing/plans` |
| F-010 | low | Role badges mix Spanish ("Acceso Total") and English ("Medio Access") |

**Fix**:
- Breadcrumb component reads i18n key map by route segment; add missing keys for billing/* + notifications + any other untranslated routes.
- Notifications: remove redundant h2 in card header (or rename to "Recientes").
- Empty state: wire through i18n + add CTA "Agregar amenidad".
- Plan descriptions: move source-defined strings to i18n locale files keyed by plan ID.
- Role badges: fix the i18n key in `packages/i18n/locales/es/*.json` under the access roles namespace.

### Group 4 — Polish (independent fixes)

| Finding | Severity | Issue |
|---|---|---|
| F-029 | medium | `/billing/cron` execute buttons render as oversized black bars |
| F-031 | low | Dashboard sidebar nav has accidental-looking visual gap |

**Fix**:
- F-029: Downgrade button variant from `default`/`primary` to `outline` or `ghost`; right-align inside card footer.
- F-031: Add a group label ("Personal" / "Trabajo") or reduce the divider gap in AppSidebar nav config.

## 3. Acceptance criteria

- [ ] `/billing/plans` shows a user-friendly error message (in Spanish) when the API misbehaves, no Zod string leakage
- [ ] `/billing/settings` shows a user-friendly message instead of "Billing service is not configured"
- [ ] All breadcrumbs are in Spanish (sample check: /billing/exchange-rates, /billing/invoices, /notifications, /accommodations/$id/amenities)
- [ ] `/notifications` shows a single h1 (no duplicate heading)
- [ ] `/accommodations/$id/amenities` empty state shows Spanish text + CTA
- [ ] `/billing/plans` "Descripción" column shows Spanish text for all plans
- [ ] `/access/roles` badges all in Spanish ("Acceso Total" / "Medio Acceso" / "Bajo Acceso", no "Access")
- [ ] `/billing/cron` execute buttons are visually subordinate to card content (not oversized black bars)
- [ ] `/dashboard` left sidebar nav groups are visually intentional (group label OR tighter spacing)
- [ ] Re-run audit script (see SPEC-134 §5) — F-010, F-024, F-025, F-026, F-027, F-028, F-029, F-031 no longer flagged (F-022 remains, tracked separately)

## 4. Out of scope

- Other languages (pt) — fixes go in es first, then mirror to en + pt. PT keys can be added in a follow-up if not done in original PRs.
- F-018/F-019 (h1 issues on /notifications and elsewhere) — handled in SPEC-136

## 5. Risks

- The "billing service is not configured" message may be intentional behavior for environments where billing isn't wired up. Check before suppressing — maybe the message just needs to be in Spanish + friendly, not removed.
- i18n key changes in `@repo/i18n` require dev-server restart (cache gotcha documented in `apps/admin/CLAUDE.md`).
