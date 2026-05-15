---
spec-id: SPEC-131
title: Admin App — Visual + Functional Audit (~42 pages, 4 dimensions)
type: audit
complexity: high
status: draft
created: 2026-05-15T18:00:00Z
effort_estimate_hours: 16-32
tags: [admin, audit, ux, accessibility, responsive, performance, visual]
extracted_from: SPEC-117 PR #1106 audit (2026-05-15) — visual blind spot
priority: medium
---

# SPEC-131: Admin App — Visual + Functional Audit

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Produce a single, prioritized findings list for the entire `apps/admin` UI surface, evaluated across four dimensions: visual + interaction, accessibility (WCAG 2.1 AA), responsive behavior, and performance. The output is decision-ready — each finding has a severity, a reproduction recipe, an evidence artifact (screenshot, axe report, lighthouse score), and a suggested fix shape.

**Why now:** The SPEC-117 PR #1106 audit (2026-05-15) verified that the admin app code shipped, types compile, endpoints respond, and i18n keys resolve — but it did NOT verify any visual aspect of the new UI (delete buttons, create dialogs, the 5 entity-selects, KPI cards, FAB, sponsorship tabs). The admin app is the operator surface for the platform; visual and functional issues there directly degrade staff productivity and erode trust in the tool. This audit establishes a baseline before the team scales beyond the solo operator.

**Why a separate spec:** SPEC-117 is "code shipped"; this spec is "UX shipped." Mixing them inflates scope and delays SPEC-117 closure. SPEC-131 produces findings that subsequently fan out into targeted fix PRs.

**Audience:** Solo operator (qazuor) plus any future admin-panel users (staff, hosts with elevated access).

---

### 2. Out of Scope

- Implementing fixes. SPEC-131's deliverable is a findings document. Fixes are landed as separate PRs (or as a single bundled PR if scope is small enough).
- Web app (`apps/web`) audit — separate concern; web has its own UX criteria (anonymous user funnel, marketing polish).
- Backend correctness — already covered by typecheck, integration tests, and the SPEC-117 audit.
- Re-auditing pages that change before this spec ships. The audit is a snapshot at HEAD.
- Cross-browser matrix beyond Chromium (Firefox/Safari are nice-to-have but not gating). The admin is internal-tool grade.
- Internationalization checks beyond the `[MISSING:` smoke (SPEC-117 covered key resolution; verifying actual translation quality is out of scope here).
- Security review — separate concern (covered by SPEC-129 + ad-hoc penetration testing).

---

### 3. Coverage Matrix

The admin app has approximately 42 pages (LIST / VIEW / EDIT / CREATE per entity, plus dashboards, settings, access, billing). Phase 0 of this spec produces the canonical inventory by walking `apps/admin/src/routes/_authed/` and listing every leaf route. The audit covers ALL of them.

For each page × each dimension, the auditor must produce evidence (artifact path) and a verdict (PASS / WARN / FAIL with severity).

#### Dimensions

| Dimension | Tooling | Evidence per page |
|---|---|---|
| Visual + Interaction | Playwright screenshots + manual review | 1 screenshot per viewport (3 total) + interaction notes |
| Accessibility (WCAG AA) | `@axe-core/playwright` automated scan + manual keyboard nav | axe JSON report + keyboard nav notes |
| Responsive | Playwright at 375 / 768 / 1280 px viewports | 3 screenshots per page (one per viewport) |
| Performance | Lighthouse CI (`lighthouse` npm) on production-like build | Lighthouse JSON report (Performance score + LCP + CLS + TBT) |

**Note on overlap:** "Visual + Interaction" and "Responsive" share screenshots — the responsive sweep produces the visual artifacts as a side effect.

---

### 4. Methodology

#### 4.1 Visual + Interaction

For each page:

- Screenshot at 1280×800 (desktop default) with auth fixture loaded.
- Trigger interactive states for the primary controls and capture each:
  - Hover on rows (DataTable), buttons, links, icons.
  - Focus ring on first input + first interactive element on the page.
  - Disabled state where applicable (Save button before form is dirty, Submit before validation passes, etc).
  - Loading state (initial fetch, async select dropdowns, mutation in flight).
  - Empty state (filtered to no results, brand-new entity with no children).
  - Error state (forced 500 from API, or invalid form submission).
- Manual review checklist per page:
  - Spacing follows the design tokens (no magic-number paddings).
  - Typography hierarchy is consistent (page title size, section title size, body text).
  - Iconography is consistent in size + alignment.
  - Color usage matches the palette (no hardcoded hex outside the token set).
  - Dark mode (if enabled in admin) renders correctly.
  - Toast feedback after actions matches the gender + entity-name conventions established in SPEC-117.

Artifact path: `audits/spec-131/<entity>/<page>-<state>-<viewport>.png`. State is one of `default | hover | focus | disabled | loading | empty | error`. Viewport is `mobile | tablet | desktop`.

#### 4.2 Accessibility (WCAG 2.1 AA)

For each page:

- Run `axe-core` via Playwright. Capture the JSON report.
- Manual keyboard navigation: Tab through every interactive element, verify the tab order is logical and that focus is visible at every step.
- Verify form labels are programmatically associated with their inputs (`for` / `aria-labelledby`).
- Verify icon-only buttons (delete row, sort toggle, expand caret) have an accessible name (`aria-label` or visually-hidden text).
- Verify color contrast meets AA (4.5:1 for normal text, 3:1 for large text and UI components). axe will flag this; manual review for edge cases.
- Verify the page has a single `<h1>` and a sane heading hierarchy.
- Verify any modal/dialog traps focus + restores focus on close.
- Verify error messages associated with form fields use `aria-describedby` or live region.

Artifact path: `audits/spec-131/<entity>/<page>-axe-report.json` + a markdown summary listing the keyboard-nav notes.

Severity mapping for a11y findings:
- `critical` axe rule violations → blocker
- `serious` axe rule violations → high
- `moderate` axe rule violations → medium
- `minor` axe rule violations → low
- Missing `aria-label` on a primary action → high
- Missing focus indicator → high
- Heading hierarchy violations → medium
- Manual findings (keyboard trap, focus loss, missing skip-link) → blocker if it locks out the user, otherwise high

#### 4.3 Responsive (mobile/tablet/desktop)

For each page:

- Screenshot at 375×667 (iPhone SE baseline, mobile).
- Screenshot at 768×1024 (iPad portrait, tablet).
- Screenshot at 1280×800 (small desktop / laptop).
- Verify no horizontal scroll on mobile.
- Verify primary actions remain reachable on mobile (no off-screen, no overlap with FAB).
- Verify forms remain usable on mobile (inputs are tappable size ≥44×44px, no zooming required for text input).
- Verify tables degrade gracefully on mobile (column hide, horizontal scroll with sticky first col, or card layout — admin's pattern needs to be validated).
- Verify dialogs/modals fit the mobile viewport (no overflow, scrollable body if content exceeds height).

Artifact path: see §4.1 (shared screenshots).

Severity mapping for responsive findings:
- Page is unusable on mobile (horizontal scroll, primary action unreachable) → high
- Page renders but is awkward (tables overflow, form fields too narrow) → medium
- Visual polish issues only (slightly misaligned, padding could be tighter) → low

#### 4.4 Performance (Lighthouse)

For each page:

- Run Lighthouse on the production build (`pnpm build && pnpm start`) with throttling at "Slow 4G" preset (consistent with web app's audit baseline).
- Capture the JSON report.
- Extract: Performance score, LCP, CLS, TBT, total bundle size transferred, blocking time.
- Identify any page where:
  - Performance score < 70 → high severity
  - LCP > 4.0s → high
  - CLS > 0.25 → high
  - Bundle > 1MB JS transferred → medium (admin tolerates more JS than web, but 1MB is a soft cap)
  - Lighthouse flags a P1 opportunity ("Eliminate render-blocking resources", "Avoid enormous network payloads", etc) → medium

Artifact path: `audits/spec-131/<entity>/<page>-lighthouse.json` + screenshot of the Lighthouse summary card.

**Important caveat for admin:** Performance budgets here are looser than for `apps/web`. Admin is a behind-auth tool used by trained operators on workstations with good connections. Don't optimize what isn't worth optimizing — flag findings, but the bar for action is "actively painful for the operator," not "below web-app threshold."

---

### 5. Severity Rubric

Every finding gets a severity. Use this table; when in doubt, escalate.

| Severity | Definition | Examples |
|---|---|---|
| **blocker** | Page is unusable or causes data loss / security exposure. | Save button silently fails. Delete confirmation dialog has no Cancel button. Modal traps focus and Esc doesn't close it. axe `critical` violation. |
| **high** | Page is usable but significantly degraded; operator workflow is impacted. | Form validation messages don't appear inline. Loading state is missing so user double-clicks Submit. Performance score <70. Mobile rendering breaks primary action. |
| **medium** | Polish or consistency issue that affects perceived quality but not function. | Inconsistent button alignment between similar pages. Tooltip text uses wrong locale. Heading hierarchy skips levels. Lighthouse P1 opportunity present. |
| **low** | Minor nit, edge case, or future-proofing concern. | One pixel off in a card border. axe `minor` violation. Hover state is slightly inconsistent across two similar buttons. |

---

### 6. Tooling

- **Playwright + Playwright MCP** — page navigation, screenshots, interaction triggers, axe injection. The MCP server is already wired in this repo's settings.
- **`@axe-core/playwright`** — automated WCAG scan injected into each page after load. May need to add as devDependency if not present.
- **Lighthouse** — CLI mode, standalone (not Lighthouse CI; CI tooling overhead is not justified for a one-shot audit). Run via `npx lighthouse <url> --output=json --output-path=...`.
- **Manual review** — required for visual polish, keyboard nav flow, perceived UX. Cannot be automated.
- **Auth fixture** — reuse the super-admin test user (`superadmin@hospeda.com` / `Audit2026!`) and a session cookie capture script. The audit must NOT require fresh login per page.
- **Local dev environment** — admin running on `localhost:3000`, API on `localhost:3001`, DB on `localhost:5436`. Production-like build (`pnpm build && pnpm start`) for the Lighthouse phase only; Playwright + axe run against dev for iteration speed.

---

### 7. Findings Format

The audit's primary deliverable is `findings.md` in this spec dir. Each finding follows this template:

```markdown
### F-<NNN> — <short title>

- **Severity**: blocker | high | medium | low
- **Page**: `<route path>` (e.g. `/access/users`)
- **Dimension**: visual | interaction | a11y | responsive | performance
- **Reproduce**:
  1. Step
  2. Step
  3. Observe
- **Expected**: <what should happen>
- **Actual**: <what happens>
- **Evidence**: `audits/spec-131/<path>/<artifact>`
- **Suggested fix shape**: 1-2 sentences pointing at file/component to touch.
- **Effort estimate**: XS / S / M / L (informal)
```

A summary table at the top of `findings.md` aggregates by severity + dimension so qazuor can pick fix priorities at a glance.

---

### 8. Phases / Tasks Outline (to be split via `/task-master:task-from-spec`)

#### Phase 0 — Inventory and tooling
- Walk `apps/admin/src/routes/_authed/` and produce a `pages-inventory.md` listing every leaf route, its purpose (LIST / VIEW / EDIT / CREATE / dashboard / etc), and its priority bucket (critical / standard).
- Verify Playwright + axe + Lighthouse are installed and runnable from a script.
- Capture an auth-cookie fixture script that any subsequent task can reuse.

#### Phase 1 — Responsive screenshot sweep
- For each page in inventory, capture 3 screenshots (375 / 768 / 1280). This is the cheapest dimension to automate and produces 80% of visual findings as a byproduct.
- Output: `audits/spec-131/<entity>/<page>-{mobile,tablet,desktop}.png` for every page.

#### Phase 2 — Visual + Interaction sweep
- For each page, capture interactive-state screenshots (hover / focus / disabled / loading / empty / error) at desktop viewport.
- Manual review pass: walk the screenshot gallery and log findings into `findings.md`.

#### Phase 3 — Accessibility sweep
- For each page, run axe-core, save JSON report, log findings.
- For each page, manual keyboard nav pass, log findings.

#### Phase 4 — Performance sweep
- Build admin in production mode (`pnpm build && pnpm start`).
- Run Lighthouse on each page, save JSON, log findings exceeding thresholds (§4.4).

#### Phase 5 — Aggregate and prioritize
- Consolidate findings from Phases 2-4 into the master `findings.md`.
- Generate the summary table.
- Cross-reference findings to ensure the same root cause isn't double-counted under multiple dimensions.

#### Phase 6 — Spec closure
- Mark spec status `completed`.
- Update index.json + engram allocations status.
- Optional: open a tracking GitHub issue per `blocker` and `high` finding so they don't get lost.

---

### 9. Acceptance Criteria

- [ ] Phase 0 inventory produced and stored at `audits/spec-131/pages-inventory.md`.
- [ ] All ~42 pages have screenshots at all 3 viewports stored under `audits/spec-131/`.
- [ ] All ~42 pages have an axe JSON report stored.
- [ ] All ~42 pages have a Lighthouse JSON report stored.
- [ ] `findings.md` exists with the summary table at top and a finding entry for every issue surfaced.
- [ ] Every finding has severity, page, dimension, reproduction steps, expected, actual, evidence path, suggested fix shape, effort estimate.
- [ ] No `blocker` findings remain undocumented (if a blocker is found, even partial Phase coverage is acceptable as long as `findings.md` lists it).
- [ ] index.json updated with `status: completed` once Phase 6 closes.
- [ ] engram registry entry flipped to `completed`.

---

### 10. Risks & Notes

- **Audit volume is large.** ~42 pages × 4 dimensions = many artifacts. Use parallelization where Playwright supports it (multiple browser contexts), and accept that the responsive sweep alone produces ~126 screenshots.
- **State setup per page.** Some pages (entity edit/view) need a real entity ID. The audit script will need to either (a) seed deterministic test fixtures or (b) read whatever exists in the dev DB. Option (b) is faster but produces non-reproducible artifacts. Pick (a) if the audit is going to be re-run; (b) if this is one-shot.
- **Performance numbers are noisy on dev hardware.** Run Lighthouse 3 times per page and take the median, or accept noisy results and only act on findings that are consistently bad across runs.
- **Findings can drift before fixes land.** The audit is a snapshot. Document the HEAD SHA at audit start in `findings.md` so future-you knows what was tested.
- **Some "findings" will be design debt the operator already knows about.** Flag them anyway, then qazuor can mark them `wont-fix` with a reason. Don't pre-filter.
- **Auth scope.** The audit logs in as `SUPER_ADMIN`. Pages that show different UI for lesser roles are NOT covered. If multi-role audit is needed, add a Phase 7 task with a non-admin fixture.
- **Dark mode.** Verify whether admin has dark mode at all before committing to dual-theme screenshots. If absent, mark as out of scope in the inventory.

---

### 11. Provenance

Surfaced during SPEC-117 PR #1106 audit (2026-05-15). The audit confirmed code-side correctness but explicitly skipped visual verification — the operator (qazuor) flagged this as a gap and requested a formal follow-up. Engram allocation: `spec-registry/hospeda/last-number` updated to 131 (130 also taken on a branch not visible from this worktree).
