---
specId: SPEC-301
title: Feedback System Production Rework
type: feat
complexity: medium
status: draft
created: 2026-06-27
tags: [feedback, error-reporting, web, admin, ux]
---

# SPEC-301 — Feedback System Production Rework

> Redesign the feedback / bug-report widget so it can be safely enabled in
> production: no permanent floating button, a lighter form, and controls that
> prevent spam without blocking real users.

## 1. Summary

The current feedback system (`@repo/feedback`) is effectively **staging-only**:
`PUBLIC_FEEDBACK_ENABLED` defaults to `false`, and the always-visible FAB would
compete with page content and invite abuse if exposed on `hospeda.com.ar`. The
owner wants to enable the feature in production but with three changes:

1. **Remove the permanent FAB** — do not show a floating button that always
   occupies screen real estate.
2. **Surface entry points contextually** — users should still be able to find and
   open the form; it just should not be obtrusively visible at all times.
3. **Reduce the data burden** — the current two-step form (type + title +
   description + contact info → severity + steps + expected/actual + attachments)
   is too heavy for a casual visitor; a leaner form lowers the submission bar.

This is a **discovery-first** spec. Goals, form design, and entry-point strategy
are provisional and must be validated with the owner before implementation starts.
The first phase is an audit + a short design decision session.

## 2. Current State

### Key files

| File | Role |
|------|------|
| `packages/feedback/src/components/FeedbackFAB.tsx` | Always-visible pill button; auto-collapses to icon after 2.2 s, pulses every 30 s |
| `packages/feedback/src/components/FeedbackModal.tsx` | Modal wrapper that owns open/close state |
| `packages/feedback/src/components/FeedbackForm.tsx` | Hosts the two-step form |
| `packages/feedback/src/components/steps/StepBasic.tsx` | Step 1: type, title, description, reporter name/email (when not auth'd) |
| `packages/feedback/src/components/steps/StepDetails.tsx` | Step 2: severity, stepsToReproduce, expectedResult, actualResult, attachments (up to 5 files) |
| `packages/feedback/src/config/feedback.config.ts` | `FEEDBACK_CONFIG` with kill switch `enabled: true`, Linear IDs, rate limit (30/IP/hr) |
| `apps/web/src/components/feedback/FeedbackFAB.client.tsx` | Astro island: wires `@sentry/astro` correlation into the base FAB |
| `apps/web/src/layouts/BaseLayout.astro` | Mounts `FeedbackFABClient` with `client:idle`; gated by `isFeedbackEnabled()` |
| `apps/web/src/lib/env.ts` | `isFeedbackEnabled()` reads `PUBLIC_FEEDBACK_ENABLED` (boolean, defaults false) |
| `apps/web/src/pages/[lang]/feedback/index.astro` | Standalone page (minimal shell, bypasses BaseLayout, receives error context via QS params) |
| `apps/web/src/pages/404.astro` and `500.astro` | Already link to `/[lang]/feedback/` with pre-filled error context |
| `apps/api/src/routes/feedback/public/submit.ts` | POST handler: validates, creates Linear issue (3 retries), falls back to email |
| `packages/schemas/src/feedback.ts` | Canonical Zod schemas for form payload + environment |

### What the form collects today

**Step 1 (required):** report type (6 options), title (5–200 chars), description
(10–5 000 chars), reporter email + name (pre-filled from session when auth'd).

**Step 2 (optional):** severity (4 levels), steps to reproduce (max 3 000 chars),
expected result (max 1 000 chars), actual result (max 1 000 chars), image
attachments (up to 5 files).

**Auto-collected silently:** URL, browser, OS, viewport, timestamp, app source,
deploy version, user ID (auth'd), console errors (last 20), Sentry event ID,
navigation history, last user interactions, locale, timezone, device type,
connection type, color scheme, localStorage feature flags.

### What gates the feature today

- `PUBLIC_FEEDBACK_ENABLED` env var must be `'true'` (transforms to boolean; omit
  → `false`). Set per environment in Coolify.
- `FEEDBACK_CONFIG.enabled` in `packages/feedback/src/config/feedback.config.ts`
  is a compile-time kill switch (currently `true`; would need a rebuild to change).

### Existing entry points (beyond the FAB)

- **Keyboard shortcut** `Ctrl+Shift+F` — already wired in `FeedbackFAB.tsx` via
  `useKeyboardShortcut`; fires even when the FAB is collapsed.
- **CustomEvent `feedback:open`** — any page can dispatch this and the FAB
  responds; the FAB acknowledges with `feedback:ack`.
- **Standalone page** `/[lang]/feedback/` — `noindex`; accepts `type`, `title`,
  `description`, `error`, `stack`, `source` query params for pre-fill.
- **404 / 500 pages** — already link to the standalone page with error context.
- **Linear integration** — fully configured (team, project, labels, source
  differentiation web/admin/standalone).

## 3. Provisional Goals (SUBJECT TO OWNER VALIDATION)

- **G-1** Enable the feedback feature behind `PUBLIC_FEEDBACK_ENABLED=true` on
  `hospeda-web-prod` without a permanent floating button (FAB removal or
  permanent hide).
- **G-2** Provide at least two discoverable entry points for the reworked form
  (exact surface TBD in discovery — see OQ-1).
- **G-3** Reduce the required form surface to the minimum needed to file a useful
  report. Candidate: a single-step form with only `type` + `description` (already
  auto-captured: URL, browser, user ID, Sentry event ID, console errors). All
  Step 2 fields become either hidden or moved to a toggleable "add more details"
  expander — exact field set confirmed in OQ-2.
- **G-4** Preserve the Sentry correlation bridge and the Linear destination
  unchanged. No new storage required (reports continue going straight to Linear).
- **G-5** Rate limiting remains at 30 reports/IP/hour (server-side, already in
  place). Evaluate whether anonymous submissions should be allowed in prod or
  require auth (OQ-4).
- **G-6** The standalone `/[lang]/feedback/` page and its error-context pre-fill
  (used by 404 / 500 pages) stay fully functional.
- **G-7** The keyboard shortcut `Ctrl+Shift+F` keeps working as a power-user
  entry point, now as one of the *primary* discovery surfaces instead of a
  supplementary one.

## 4. Non-Goals

- Storing reports in a Hospeda DB table or building an in-app admin triage view.
  Linear remains the single destination; this is out of scope unless OQ-5 changes
  direction.
- Removing the Linear integration or changing the destination.
- Adding a native admin feedback dashboard (Linear covers triage for now).
- Changing the standalone page's shell / SEO setup.
- Reworking the admin app's feedback surface (if it has one — to be confirmed in
  discovery; likely out of scope for this spec).
- Multi-step wizard redesign: if the form becomes a single compact step, the
  `StepBasic`/`StepDetails` split may become irrelevant. Refactoring the package
  internals is in scope only to the extent needed; no architectural rewrite.

## 5. Discovery Plan (Phase 1 — before any code)

Phase 1 is **read-only analysis + owner decisions**. No implementation until the
questions below are answered.

### Audit tasks

1. **Confirm FAB removal scope**: decide whether to (a) simply not mount the FAB
   component at all in prod (`isFeedbackEnabled()` stays false for the FAB mount
   but the shortcut + standalone page still work), or (b) keep the FAB mount but
   strip the visible button and rely entirely on the keyboard shortcut +
   contextual links.
2. **Map all current entry points**: confirm which entry points already exist
   without the FAB (keyboard shortcut, 404/500 links, standalone page) and
   identify what is missing.
3. **Field audit**: list every field the form currently shows to the user, which
   are required vs optional, and which are already auto-captured (invisible to the
   user). This feeds the minimal-form decision (OQ-2).
4. **Rate-limit and spam review**: verify the existing 30/IP/hr rate limit is
   adequate for prod; check whether Cloudflare WAF already provides a first layer.
5. **Auth requirement audit**: check whether the current form accepts anon
   submissions (it does — reporter email/name are required fields in Step 1 when
   the user is not logged in). Decide prod policy (OQ-4).

### Owner decisions needed (see Open Questions)

OQ-1 through OQ-6 must be answered before starting implementation.

## 6. High-Level Implementation Sketch (provisional)

Once discovery is done, implementation is expected to touch:

- `apps/web/src/layouts/BaseLayout.astro` — either remove the `FeedbackFABClient`
  mount entirely, or replace it with a headless version that only registers the
  keyboard shortcut + the CustomEvent listener (no visible button).
- `apps/web/src/layouts/Footer.astro` — add a "Reportar un problema" link (or
  similar; surface TBD by OQ-1) that either navigates to the standalone page or
  dispatches `feedback:open`.
- `packages/feedback/src/components/FeedbackForm.tsx` (or a new sibling) — slim
  down to a single-step form; exact fields per OQ-2.
- `packages/schemas/src/feedback.ts` — update `feedbackFormSchema` if required
  fields change (e.g. `title` becomes optional or derived from description).
- `apps/web/src/env.ts` — no schema change needed; `PUBLIC_FEEDBACK_ENABLED` is
  already wired.
- Coolify env config — set `PUBLIC_FEEDBACK_ENABLED=true` on `hospeda-web-prod`
  once the redesign is merged.
- No DB migrations needed (Linear remains the destination).

## 7. Risks

- **R-1 — Discoverability regression.** Removing the FAB makes feedback harder to
  find for non-tech users who don't know the keyboard shortcut. The contextual
  entry points (footer link, error pages, post-interaction nudge) must compensate.
  Validate with a quick usability sanity check before merging.
- **R-2 — Spam on prod.** Enabling anonymous form submission on a public prod site
  without a visible friction (no FAB ≈ lower surface area, but direct URL still
  works) could invite bots. The existing IP rate limit + honeypot field in the
  submit handler are the current guards. May need Cloudflare Turnstile or similar
  if abuse appears. Decide in OQ-4.
- **R-3 — Field reduction loses signal.** Removing Step 2 fields (steps to
  reproduce, expected/actual) reduces the quality of reports filed. Auto-captured
  context (URL, console errors, Sentry event) partly compensates, but power users
  will lose the ability to add structured reproduction steps. An "add more details"
  expander (collapsible Step 2) mitigates this.
- **R-4 — Schema / API drift.** Slimming the form means some previously required
  fields (title, possibly) become optional or derived. The API route validation
  schema (`apps/api/src/routes/feedback/public/validation.ts`) mirrors the client
  schema; both must change together. Missed sync = 400 on submission.
- **R-5 — Keyboard shortcut unknown to users.** `Ctrl+Shift+F` is a power-user
  affordance with zero discoverability without the tooltip that the FAB provided.
  At least one visible entry point (footer or help menu) is mandatory.

## 8. Open Questions

- **OQ-1** — What replaces the FAB as the primary entry point? Options being
  considered: (a) footer "Reportar un problema" link → standalone page; (b) site
  header "?" or "help" dropdown item → opens the modal inline; (c) a small fixed
  "feedback" text link in the page corner (much smaller than the current FAB, no
  icon, collapses on mobile); (d) only error pages + keyboard shortcut (fully
  implicit). **Owner decision needed.**
- **OQ-2** — Minimal field set: what fields must the user fill in? Candidate A:
  only `description` (type auto-set to "other", title derived from first 80 chars).
  Candidate B: `type` dropdown + `description`. Candidate C: keep `type` + `title`
  + `description` but hide everything else (Step 2 becomes an expander, not a
  step). Candidate D: per-report-type adaptive form (bug → ask for reproduction
  steps; feature-request → simpler). **Owner decision needed.**
- **OQ-3** — Should the keyboard shortcut `Ctrl+Shift+F` be surfaced somewhere
  visible (e.g. a tooltip on the footer link, or in the help page)? Currently it
  is only discoverable via the FAB tooltip.
- **OQ-4** — Auth requirement in prod: allow fully anonymous submissions (current
  behavior: form shows reporter email + name fields), require login, or use a
  light challenge (Cloudflare Turnstile)? Impact on spam risk and submission
  friction must be weighed. **Owner decision needed.**
- **OQ-5** — Should reports eventually be stored in a Hospeda DB table (for
  in-app admin triage), or is Linear sufficient as the permanent destination?
  Out of scope for this spec but worth stating as a future consideration.
- **OQ-6** — Is there a feedback entry point in the admin app that should be
  reworked in parallel? The admin uses `@repo/feedback` indirectly but an admin
  FAB was not confirmed during discovery. Confirm during audit.

## 9. Relationship to Existing Systems

- **`@repo/feedback` package** — the existing implementation. Changes here affect
  both web and any future consumer (admin). Prefer additive changes (new minimal
  form component alongside existing multi-step form) over destructive rewrites
  until the design is settled.
- **Sentry** (`@sentry/astro`) — Sentry correlation is already in place via the
  `getSentryEventId` / `onSentryFeedback` bridge in the island wrapper. This
  wiring must remain intact regardless of FAB removal.
- **Linear** — all real Linear IDs are already configured in
  `feedback.config.ts`. No Linear config changes are expected.
- **`SPEC-162` (audit log)** — feedback submissions are NOT audit-logged today.
  Whether prod submissions should emit an audit log entry is OQ-5 adjacent;
  descoped for now.
- **`SPEC-294` (a11y sweep)** — any new entry point (footer link, modal trigger)
  must meet the same a11y bar the sweep established. Keyboard navigation and
  focus management on the slimmed form should be verified.

## 10. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-301). Discovery-first; goals
  provisional pending owner decisions on OQ-1 (entry point), OQ-2 (field set),
  and OQ-4 (auth requirement). Audit of current system confirmed: `@repo/feedback`
  package, 2-step form, Linear destination, no DB table, `PUBLIC_FEEDBACK_ENABLED`
  gate (currently `false` on prod), keyboard shortcut already wired.
