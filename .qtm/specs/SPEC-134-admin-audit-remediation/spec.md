---
spec-id: SPEC-134
title: Admin Audit Remediation — Master
type: epic
complexity: high
status: draft
created: 2026-05-16T01:30:00Z
effort_estimate_hours: 28-48
tags: [admin, remediation, ux, accessibility, responsive, i18n, epic, master]
extracted_from: SPEC-131 admin app audit findings (2026-05-15/16)
priority: high
input: ./audit-baseline/findings.md
children: [SPEC-135, SPEC-136, SPEC-137]
---

# SPEC-134: Admin Audit Remediation — Master

## 1. Overview

SPEC-131 audited the entire admin app (105 pages successfully captured, 5 deferred) across visual, accessibility, and responsive dimensions. The audit surfaced **31 findings** consolidated into **7 root-cause clusters**. This master spec coordinates the remediation campaign via three children, grouped by dimension.

The audit deliverable (`audit-baseline/findings.md`) is the **source of truth** for what needs fixing. The 3 children specs reference findings by F-NNN ID — the actual reproduce steps, evidence paths, and suggested fix shapes live in `findings.md`.

## 2. Children

| Spec | Title | Findings | Estimated effort |
|---|---|---|---|
| SPEC-135 | Mobile Responsive Remediation | F-020 (blocker), F-021, F-023, F-030 | M-L (~12-20h) |
| SPEC-136 | A11y Compliance (WCAG 2.1 AA) | F-003, F-004, F-011, F-013, F-014, F-015, F-016, F-017, F-018, F-019 | M-L (~10-16h) |
| SPEC-137 | i18n + Polish + Routing | F-010, F-022, F-024, F-025, F-026, F-027, F-028, F-029, F-031 | M (~6-12h) |

Total = 28-48h estimated across all children.

**Out of scope** from this remediation: F-001 (signin hydration mismatch), F-002 (auth 500 instead of 401). Operator deferred these to a separate auth-focused session (per 2026-05-15 conversation).

## 3. Execution sequence

### Phase A — Mobile + a11y in parallel (high-impact)

SPEC-135 and SPEC-136 can run in parallel. They touch DIFFERENT shared components mostly:

- SPEC-135 touches: FormShell, DataTable (mobile breakpoint side), EntityTabsLayout
- SPEC-136 touches: root `__root.tsx` head/lang, Tabs component (ARIA structure), DataTable (sort-header text-color side), form-control wrappers, entity-page h1 components

There IS one overlap: DataTable. F-014 (sort header color contrast, a11y) and F-021 (mobile column truncation, responsive) both touch DataTable but on different layers. Coordinate the PRs to merge in order (a11y first → mobile second, or bundle).

### Phase B — i18n + polish (SPEC-137)

Can start any time but recommend AFTER Phase A so the team can re-verify visual/responsive baselines without ES/EN noise.

### Phase C — Final re-audit (this spec's last task)

Once SPEC-135 / 136 / 137 are merged:

1. Re-run the audit script: `cd .qtm/specs/SPEC-134-admin-audit-remediation/audit-baseline/_scripts && bun install && bun sweep.ts`
2. Run aggregator: `bun aggregate-axe.ts`
3. Compare `_fixtures/axe-aggregate.json` against the original findings to confirm fixed items are closed.
4. For any NEW findings introduced by the remediation work, file as follow-up SPEC.
5. Update SPEC-134 status `draft` → `in-progress` → `completed`.

## 4. Acceptance criteria (master)

- [ ] All 3 children specs (135/136/137) status = `completed`
- [ ] F-020 (BLOCKER) confirmed fixed: re-audit shows multi-section forms usable on mobile (CREATE + EDIT pages render single-column at 375px viewport)
- [ ] All `high`-severity findings (F-011, F-014, F-021, F-022, F-023, F-024) confirmed fixed in re-audit
- [ ] axe-aggregate post-fix shows 0 critical impact violations on the 105 captured pages
- [ ] axe-aggregate post-fix shows 0 serious impact violations EXCEPT documented exceptions (if any)
- [ ] Re-audit's `findings.md` (regenerated) is empty OR contains only NEW findings, all explicitly classified
- [ ] `_fixtures/axe-aggregate.json` from re-audit committed to this spec as evidence of closure

## 5. Re-audit fixture state

The screenshots + axe reports from the original SPEC-131 sweep are NOT committed (~80MB of generated content). The re-audit will regenerate them. What IS committed in `audit-baseline/`:

- `findings.md` — the catalogue + root-cause clusters
- `pages-inventory.md` — 110-route inventory (still valid as long as no routes added/removed)
- `_scripts/{sweep.ts, aggregate-axe.ts, md-to-json.ts, package.json, bun.lock, .gitignore}` — re-runnable audit tooling

To regenerate the audit environment:

```bash
cd .qtm/specs/SPEC-134-admin-audit-remediation/audit-baseline/_scripts
bun install
bunx playwright install chromium  # one-time, ~113MB
# Ensure admin is running on localhost:3000 with VITE_FEEDBACK_ENABLED=false
# Then export the local-DB superadmin password (required, no default):
export AUDIT_PASSWORD=...   # see your local seed / DB account
bun sweep.ts                # ~17 min, generates screenshots + axe JSON
bun aggregate-axe.ts          # generates _fixtures/axe-aggregate.json
```

Optional env vars:
- `AUDIT_ADMIN_URL` (default `http://localhost:3000`)
- `AUDIT_EMAIL` (default `superadmin@hospeda.com`)
- `ONLY_ENTITY=<name>` to scope to a single entity (e.g. `accommodations`)
- `ONLY_PRIORITY=critical` to scope to only critical-bucket pages
- `LIMIT=N` to capture only first N pages (smoke testing)

## 6. Risks & notes

- **Baseline drift**: The audit baseline (SHA `1486e139d`) represents the admin's state on 2026-05-15. If non-remediation changes land between then and re-audit, the diff will include unrelated changes. Either re-audit each child PR individually, or batch-rebase before final re-audit.
- **Page count may grow**: If routes are added during remediation, `pages-inventory.md` becomes stale. Regenerate via `bun md-to-json.ts` and recommit.
- **5 skipped pages**: `/conversations/$id`, `/newsletter/campaigns/$campaignId`, `/sponsors/$id`, `/sponsors/$id/edit`, `/tags/entity-attribution/$type/$id` were never captured because seed DB has no rows. Seed example data for these entities OR file a follow-up "seed gap" SPEC. Tracked in `findings.md` "Skipped pages" section.
- **F-020 priority**: This is a BLOCKER on mobile usability. Operators currently can't edit any entity from a mobile device. Recommend treating SPEC-135 as the highest priority among children.

## 7. Provenance

This spec was created as a follow-up to SPEC-131 (Admin App — Visual + Functional Audit), which completed 2026-05-16 with the deliverable `audit-baseline/findings.md`. SPEC-131's spec frontmatter references this remediation spec's location.
