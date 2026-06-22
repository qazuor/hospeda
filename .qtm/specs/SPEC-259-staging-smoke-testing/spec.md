---
spec-id: SPEC-259
title: Systematic Chrome smoke testing of staging features (post-e2fb184)
type: testing
complexity: high
status: draft
created: 2026-06-22T15:39:13Z
---

# SPEC-259 — Systematic Chrome smoke testing of merged staging features

> Every feature merged to `staging` must get a **real, end-to-end Chrome smoke test
> as a real user** — happy paths and not-so-happy paths — before we consider it truly
> done. This spec is the campaign for the features merged since `e2fb184` (2026-06-06)
> that still lack a complete smoke. It is a recurring-style process spec, not a code
> feature.

## 1. Overview & goal

Drive each in-scope feature through a hands-on Chrome smoke (logged in as the relevant
real user role), exercising the full flow end-to-end, hunting for bugs. Each bug gets a
**human decision** (fix now vs report for later). When a feature's smoke is complete and
any in-session fixes are green, close that feature out across the indexes + CSV + engram.

### Why

Unit/integration tests passed for all these features, but the SPEC-222 and SPEC-257
smokes proved that mocked tests hide real defects (undici-7 regression, wrong actor
field names, a non-existent DB column, anti-bot dead-ends). Only a real-browser e2e
catches these. Several merged features were only "quick/parallel validated" or have just
a "smoke plan", not a deep smoke.

## 2. Procedure (per feature)

1. **Smoke as a real user, end to end, in Chrome.** Log in with the relevant role
   (host, commerce owner, tourist, admin). Walk the **happy path** AND the **not-happy
   paths** (empty states, permission denials, invalid input, edge data, navigation
   mid-flow). Actively look for problems — visual, functional, data, i18n, performance.
2. **For every problem found, a HUMAN decides** fix-now vs report-for-later. The decision
   inputs: is it **blocking** (can't keep testing) or not? is it a **minor detail** or a
   **severe bug**? In ALL cases the human makes the call — the agent surfaces the problem
   with severity + context and waits.
   - **Fix now**: typically blocking issues, or quick safe fixes that unblock further testing.
   - **Report for later**: non-blocking, or larger changes better done deliberately.
3. **Test the FULL feature** (don't stop at the first bug unless it's blocking).
4. **On completion**, if there were in-session fixes: commit them atomically and open a
   PR on a **dedicated testing branch** for that feature (e.g. `test/SPEC-NNN-smoke`).
5. **When the smoke is done, tested, and the PR is green**: update the specs index,
   tasks index, prioritization CSV, and engram — marking that feature's smoke **fully
   complete** and the spec closed.
6. **For anything deferred**, two options (human chooses):
   - (a) Fix it before closing, as part of finishing the smoke, or
   - (b) Open a **new formal spec** for it and close the already-merged feature.

### Testing environment

- **Test as much as possible LOCAL** (worktree dev env: web/API/DB isolated). Billing
  entitlement/limit logic is local via the billing test-mode env var; only the real
  **MercadoPago checkout/webhook** and **Brevo email delivery** need the **staging VPS**
  (the webhook needs a public URL).
- Each feature below lists its **env vars** so the smoke runs against real config (not
  defaults that silently degrade).

## 3. In-scope features (merged since e2fb184, implemented, smoke incomplete)

> Excluded and why: SPEC-222/237/240/215/241/257 already 100% smoked; SPEC-254/250/248
> are draft-only merges (no implementation); SPEC-243 is the mobile app (not Chrome);
> SPEC-251/238/236/244/245/246/env-hardening are infra/non-user-facing.

### Phase 1 — SPEC-230: list soft-delete filtering (100% LOCAL)

- **Surface:** service-layer bugfix; visible on any owner list view.
- **Smoke:** soft-delete a promotion → "Mis promociones" no longer shows it; same for an
  accommodation; `?includeDeleted=true` opt-in still returns deleted; an entity without
  `deletedAt` is unaffected.
- **Env vars:** none. **Classification:** LOCAL.

### Phase 2 — SPEC-203: self-serve plan management UI (LOCAL+VPS)

- **Surface:** web host zone `/[lang]/mi-cuenta/suscripcion`.
- **Smoke (happy):** view current plan/status/renewal; change plan → plan picker;
  downgrade → preview of excess accommodations/promotions/photos + keepIds selector →
  confirm → `active` / `scheduled` outcome; scheduled-downgrade banner on dashboard; real
  soft-cancel modal → access-until date.
- **Smoke (not-happy):** `HOSPEDA_USER_CANCEL_ENABLED=false` → graceful email fallback;
  invalid/past scheduledAt banner; verify cancel hits the correct soft-cancel endpoint
  (regression: it used to point at hard-cancel).
- **VPS part:** the **upgrade → `pending_payment` → MercadoPago checkout redirect** needs
  real MP sandbox credentials (valid `checkoutUrl`).
- **Env vars:** `HOSPEDA_USER_CANCEL_ENABLED=true` (local cancel smoke; default false);
  `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`, `HOSPEDA_MERCADO_PAGO_SANDBOX=true`,
  `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` (VPS checkout). **Classification:** LOCAL+VPS.

### Phase 3 — SPEC-239: commerce listings core / Gastronomía (LOCAL+VPS)

- **Surface:** web public `/[lang]/gastronomia` (list + detail), admin CRUD + lead inbox
  - review moderation, owner force-password gate.
- **Smoke (happy):** public listing + filters; detail page (hours, menu, amenities, FAQs,
  reviews, rating); public lead form → ops notification; admin creates owner + listing;
  admin starts binary subscription → listing becomes visible; admin manages leads
  (mark-handled) + moderates reviews; "approve & provision" single action.
- **Smoke (not-happy):** hidden/unsubscribed listing → 404; tourist review → PENDING (not
  visible until approved); host+commerce user keeps correct **accommodation** entitlements
  (commerce sub must not pollute the accommodation engine).
- **VPS part:** **MercadoPago preapproval subscription activation + webhook-driven
  visibility flip** (webhook needs a public URL).
- **Env vars:** MP vars (above); `HOSPEDA_COMMERCE_PLAN_ID` (in registry);
  ⚠️ `HOSPEDA_COMMERCE_LEAD_NOTIFY_EMAIL` (**not in registry yet** — add it or lead
  notifications silently skip); Brevo transport. **Classification:** LOCAL+VPS.

### Phase 4 — SPEC-249: commerce owner self-service web (LOCAL+VPS)

- **Surface:** web host zone `/[lang]/mi-cuenta/comercio` (owner edit) + admin "approve &
  provision".
- **Smoke (happy):** admin approves a lead → provisions owner → credential email; owner
  logs in with temp creds → forced to `/mi-cuenta/cambiar-contrasena` → sets password →
  gate clears; owner sees listings → edits operational fields (hours, contact, socials,
  media, menuUrl, priceRange, richDescription, amenities) → saved → reflected on public ficha.
- **Smoke (not-happy):** non-owner/tourist hitting `/mi-cuenta/comercio` → redirect/404;
  owner forging identity fields (`name`/`slug`/`type`) in PATCH → server strips/rejects;
  force-password gate blocks all other routes until cleared; owner with zero listings →
  empty state.
- **VPS part:** real **Brevo credential-email delivery** (local can use the notifications
  stub).
- **Env vars:** ⚠️ `HOSPEDA_COMMERCE_LEAD_NOTIFY_EMAIL` (not in registry); Brevo transport.
  **Classification:** LOCAL+VPS.

## 4. Out of scope

- Re-smoking the already-complete features (SPEC-222/237/240/215/241/257).
- Implementing the draft specs (SPEC-254/250/248) — nothing to smoke there.
- Mobile app (SPEC-243) — separate (Expo, not Chrome).
- Net-new features. Any deferred bug that needs real work spawns its own spec (per §2.6b).

## 5. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| MP/webhook parts can't be done local | Medium | Split LOCAL vs VPS per phase; do the VPS portion on staging with MP sandbox |
| Apify/external actors flaky (anti-bot) | Medium | Space out runs; don't dead-end the smoke; report as known-flaky |
| `HOSPEDA_COMMERCE_LEAD_NOTIFY_EMAIL` missing → silent skip | Medium | Add to registry + set before the SPEC-239/249 smoke |
| Scope creep (fixing too much mid-smoke) | Medium | Human gate on every bug; prefer report-for-later for non-blocking/large |
| Closing a spec while a deferred bug lingers | Low | §2.6: either fix before close or open a formal follow-up spec |

## 6. Tasks (suggested — one phase per feature, plus close-out)

- **Setup:** confirm local worktree env + env vars per phase (MP sandbox, `USER_CANCEL_ENABLED`, `COMMERCE_LEAD_NOTIFY_EMAIL`, Brevo, Apify).
- **Phase 1 — SPEC-230 smoke** (local) → fixes (if any) → close SPEC-230.
- **Phase 2 — SPEC-203 smoke** (local + VPS checkout) → fixes → close SPEC-203.
- **Phase 3 — SPEC-239 smoke** (local + VPS subscription/webhook) → fixes → close SPEC-239.
- **Phase 4 — SPEC-249 smoke** (local + VPS email) → fixes → close SPEC-249.
- **Per phase:** dedicated `test/SPEC-NNN-smoke` branch + PR (green) for any fixes; then
  index/CSV/engram close-out for that spec.
- **Wrap-up:** update the engram smoke-registry; report deferred items (fixed-before-close
  or promoted to new specs).

## Internal Review Notes

- Built from the post-e2fb184 merge audit + the per-spec analysis (surfaces, external deps,
  local/VPS split, env vars). The draft-only merges (SPEC-254/250/248) were explicitly
  excluded after confirming they have no implementation.
- **Open questions:** (Q1) order — proposed 230 → 203 → 239 → 249 (trivial-first, then
  billing, then commerce core, then commerce owner which depends on 239). (Q2) for VPS
  portions, do we batch them into a single staging session at the end, or do each phase's
  VPS part inline? (Q3) deferred-bug default — fix-before-close vs new-spec — decided
  per bug by the human at smoke time.
