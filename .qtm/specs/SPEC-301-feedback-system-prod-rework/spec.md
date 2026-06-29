---
specId: SPEC-301
title: Feedback System Production Rework
type: feat
complexity: medium
status: in-progress
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

This was a **discovery-first** spec. The audit and owner decision session are now
**complete** (2026-06-28): OQ-1 (entry point), OQ-2 (field set), OQ-4 (anti-spam),
and OQ-6 (admin scope) are resolved (see §8 and the Revision History). Goals below
are now firm and implementation can proceed.

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

## 3. Goals (FIRM — owner-validated 2026-06-28)

- **G-1** Enable the feedback feature behind `PUBLIC_FEEDBACK_ENABLED=true` on
  `hospeda-web-prod` without a permanent floating button. The visible FAB is
  removed from the web app; a headless host keeps the keyboard shortcut and the
  `feedback:open` CustomEvent working.
- **G-2** Primary discovery surface (OQ-1): a **footer link "Reportar un
  problema"** that navigates to the standalone `/[lang]/feedback/` page.
  Supplementary surfaces that already exist stay: the 404/500 error-page links and
  the `Ctrl+Shift+F` keyboard shortcut.
- **G-3** Slim the form (OQ-2): keep **`type` + `title` + `description`** visible
  as the only required fields; move Step 2 (severity, stepsToReproduce,
  expectedResult, actualResult, attachments) into a collapsible **"agregar más
  detalles" expander** instead of a separate wizard step. All silently
  auto-captured context (URL, browser, user ID, Sentry event ID, console errors)
  is unchanged. `title` stays required, so the canonical schema barely changes.
- **G-4** Preserve the Sentry correlation bridge and the Linear destination
  unchanged. No new storage required (reports continue going straight to Linear).
- **G-5** Anti-spam (OQ-4): allow **anonymous** submissions (no login required) but
  add an **invisible Cloudflare Turnstile** challenge, verified server-side in the
  submit handler. The existing 30/IP/hour rate limit and the `website` honeypot
  field stay in place as additional layers.
- **G-6** The standalone `/[lang]/feedback/` page and its error-context pre-fill
  (used by 404 / 500 pages) stay fully functional.
- **G-7** The keyboard shortcut `Ctrl+Shift+F` keeps working as a power-user
  entry point, now alongside the footer link as a *primary* discovery surface
  instead of a supplementary one.
- **G-8** Apply the same rework to the **admin app** (OQ-6): remove the default-on
  admin FAB and give admin an equivalent entry point, so web and admin stay
  consistent.

## 4. Non-Goals

- Storing reports in a Hospeda DB table or building an in-app admin triage view.
  Linear remains the single destination; this is out of scope unless OQ-5 changes
  direction.
- Removing the Linear integration or changing the destination.
- Adding a native admin feedback dashboard (Linear covers triage for now).
- Changing the standalone page's shell / SEO setup.
- Multi-step wizard redesign as a ground-up rewrite. The two-step split collapses
  into one visible step (`type`/`title`/`description`) plus a collapsible
  expander; the `StepBasic`/`StepDetails` components are reused/refactored as
  needed, but no architectural rewrite of `@repo/feedback`.

> Note: reworking the **admin** feedback surface is **in scope** as of OQ-6 (see
> G-8) — it is no longer a non-goal.

## 5. Discovery Plan (Phase 1 — ✅ COMPLETE 2026-06-28)

Phase 1 was **read-only analysis + owner decisions**. It is now complete — the
audit ran (see Revision History) and OQ-1/OQ-2/OQ-4/OQ-6 are answered.
Implementation (Phase 2+) can proceed. The audit tasks below are kept for the
record.

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

## 6. High-Level Implementation Sketch (firm)

Implementation is expected to touch:

### Web entry point (G-1, G-2)

- `apps/web/src/layouts/BaseLayout.astro` — replace the visible `FeedbackFABClient`
  mount with a **headless host** that only registers the `Ctrl+Shift+F` shortcut +
  the `feedback:open` / `feedback:ack` CustomEvent listener (no visible button).
- `apps/web/src/layouts/Footer.astro` (and/or the web `Footer` component) — add the
  **"Reportar un problema"** link that navigates to `/[lang]/feedback/`.

### Slim form (G-3)

- `packages/feedback/src/components/FeedbackForm.tsx` + `steps/StepBasic.tsx` +
  `steps/StepDetails.tsx` — collapse the two-step wizard into one visible step
  (`type` + `title` + `description`) with the former Step 2 behind a collapsible
  "agregar más detalles" expander. Reuse existing components; no rewrite.
- `packages/schemas/src/feedback.ts` — `title` stays required, so the schema is
  largely unchanged; verify the client schema and the API mirror
  (`apps/api/src/routes/feedback/public/validation.ts`) stay in sync (risk R-4).

### Anti-spam — Cloudflare Turnstile invisible (G-5)

- Client: render an invisible Turnstile widget in the form, attach the token to the
  submit payload.
- Server: `apps/api/src/routes/feedback/public/submit.ts` — verify the Turnstile
  token against the siteverify endpoint before creating the Linear issue; reject on
  failure. Keep the existing honeypot + 30/IP/hr rate limit.
- **New env vars** (follow the project env-var workflow — registry + Zod +
  `.env.example` + doc + Coolify set):
  - `PUBLIC_TURNSTILE_SITE_KEY` (web, public, client widget)
  - `HOSPEDA_TURNSTILE_SECRET_KEY` (api, secret, server verify)

### Admin alignment (G-8)

- `apps/admin/src/routes/__root.tsx` — remove the default-on `FeedbackFAB` mount;
  add an equivalent admin entry point (e.g. a header/help link) to the standalone
  feedback page or the slim form.

### Deploy / config

- Coolify env: set `PUBLIC_FEEDBACK_ENABLED=true` + the two Turnstile keys on
  `hospeda-web-prod` (and the relevant admin/api apps) once the redesign is merged.
- No DB migrations needed (Linear remains the destination).

## 7. Risks

- **R-1 — Discoverability regression.** Removing the FAB makes feedback harder to
  find for non-tech users who don't know the keyboard shortcut. The contextual
  entry points (footer link, error pages, post-interaction nudge) must compensate.
  Validate with a quick usability sanity check before merging.
- **R-2 — Spam on prod.** Enabling anonymous form submission on a public prod site
  without a visible friction could invite bots. **Resolved (OQ-4):** an invisible
  Cloudflare Turnstile challenge is now part of the design, verified server-side,
  on top of the existing IP rate limit + `website` honeypot. Residual risk: a
  misconfigured/missing Turnstile secret must **fail closed** (reject the
  submission) rather than silently letting bots through — covered by tests.
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

- **OQ-1** — ✅ **RESOLVED (2026-06-28):** the primary entry point is option (a) —
  a footer **"Reportar un problema"** link that navigates to the standalone
  `/[lang]/feedback/` page. The 404/500 links and the `Ctrl+Shift+F` shortcut
  remain as additional surfaces.
- **OQ-2** — ✅ **RESOLVED (2026-06-28):** Candidate C — keep `type` + `title` +
  `description` visible; the former Step 2 (severity, stepsToReproduce,
  expected/actual, attachments) moves into a collapsible "agregar más detalles"
  expander instead of a separate step.
- **OQ-3** — Should the keyboard shortcut `Ctrl+Shift+F` be surfaced somewhere
  visible (e.g. a tooltip on the footer link, or in the help page)? **Open, not
  blocking.** Recommendation: add it as a `title`/tooltip on the footer link.
  Decide during implementation of the footer surface.
- **OQ-4** — ✅ **RESOLVED (2026-06-28):** allow **anonymous** submissions + add an
  **invisible Cloudflare Turnstile** challenge verified server-side, on top of the
  existing rate limit + honeypot. (Note: `reporterEmail`/`reporterName` are
  currently required server-side even for authed users — confirm whether anonymous
  flow keeps requiring them or relaxes to Turnstile-only during implementation.)
- **OQ-5** — Should reports eventually be stored in a Hospeda DB table (for
  in-app admin triage), or is Linear sufficient as the permanent destination?
  **Out of scope for this spec** (future consideration). Linear stays the
  destination.
- **OQ-6** — ✅ **RESOLVED (2026-06-28):** the admin app DOES mount a default-on
  `FeedbackFAB` (`apps/admin/src/routes/__root.tsx`, gated by
  `VITE_FEEDBACK_ENABLED !== 'false'`). Decision: **align admin** with the web
  rework (remove the FAB, add an equivalent entry point — see G-8).

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

- 2026-06-28 — **Discovery closed; status → in-progress.** Code audit completed and
  owner decisions locked:
  - OQ-1 → footer "Reportar un problema" link → standalone page (primary surface),
    keeping 404/500 links + `Ctrl+Shift+F`.
  - OQ-2 → keep `type`+`title`+`description` visible; Step 2 → collapsible
    "agregar más detalles" expander.
  - OQ-4 → anonymous allowed + invisible Cloudflare Turnstile (server-verified),
    plus existing rate limit + honeypot. Adds two env vars
    (`PUBLIC_TURNSTILE_SITE_KEY`, `HOSPEDA_TURNSTILE_SECRET_KEY`).
  - OQ-6 → admin FAB confirmed (default-on); decision = align admin (new G-8).
  - Audit corrections vs the original draft: the FAB auto-collapses to icon after
    2.2 s (not a permanent pill); `reporterEmail`/`reporterName` are required
    server-side even when authenticated (`validation.ts`); if Linear + email
    fallback both fail the API returns 503 (not a silent 200); honeypot field is
    `website`; rate limit 30/IP/hr; no DB persistence (Linear only).
  - Goals firmed (G-1…G-8). Admin removed from Non-Goals.
- 2026-06-27 — Initial draft (allocated SPEC-301). Discovery-first; goals
  provisional pending owner decisions on OQ-1 (entry point), OQ-2 (field set),
  and OQ-4 (auth requirement). Audit of current system confirmed: `@repo/feedback`
  package, 2-step form, Linear destination, no DB table, `PUBLIC_FEEDBACK_ENABLED`
  gate (currently `false` on prod), keyboard shortcut already wired.
