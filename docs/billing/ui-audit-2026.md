# Billing UI audit — 2026-05-20

> **Context**: post SPEC-143 close, audit ran to decide UI work before the smoke gate (T-143-21/23/37/46). Output of four exploration agents over `apps/web` + `apps/admin`.
> **Owner**: handoff doc for the next session. Self-contained.
> **Status**: Audit complete, remediation plan defined (4 phases), implementation not started.

---

## 1. What we audited and why

After SPEC-143 closed with 59/65 done and the Sentry bundle shipped, the question was: **can the user run the SPEC-143 smoke checklists (T-143-21/23/37/46) against staging today, or does the UI need fixes first?**

The hypothesis "UI first" was tested via 4 sequential exploration agents:

1. **Web app billing UI audit** — inventory of what exists, what's obsolete, what needs adjustments, what's ready.
2. **Admin app billing UI audit** — same buckets.
3. **Web + admin endpoint mismatch audit** — cross-reference every fetch call against the current API surface (paths, methods, bodies).
4. **Backend aliases + response shape audit** — verify if the `/protected/billing/*` endpoints the admin app is calling actually exist on the backend (so we know if admin is "broken" or "working by accident"), and whether the response unwrap patterns match.

---

## 2. Consolidated findings

### 2.1 Backend `/protected/billing/*` aliases

The admin app violates the CLAUDE.md rule "Never use `/api/v1/protected/*` in admin panel code". Audit verified the impact:

- **15 of 17 endpoints exist** via QZPay pre-built routes mounted at `apps/api/src/routes/billing/index.ts:124`. The admin app's calls to `/protected/billing/{subscriptions,payments,invoices}` resolve to those QZPay routes. **Admin works by accident in staging.**
- **2 endpoints are genuine 404** in staging today:
  - `GET /api/v1/protected/billing/customers/search`
  - `GET /api/v1/protected/billing/customers/:id/usage`
- **1 endpoint is silently broken**: `PUT /protected/billing/subscriptions/:id` with body `{ planSlug }`. QZPay's generic PUT accepts partial updates but likely rejects this body shape with Zod validation (4xx).

### 2.2 Web app endpoint mismatches

| File:Line | Method | Path | Body | Issue |
| --------- | ------ | ---- | ---- | ----- |
| `src/components/billing/PlanPurchaseButton.client.tsx:207` | POST | `/api/v1/protected/billing/checkout` | `{ planId }` | Legacy endpoint, missing `billingInterval`, body uses `planId` instead of `planSlug` |
| `src/lib/api/endpoints-protected.ts:486` (`createCheckout`) | POST | `/api/v1/protected/billing/checkout` | `{ planId, billingInterval }` | Same legacy endpoint; uses `planId` instead of `planSlug` |
| `src/lib/api/endpoints-protected.ts:418` (`changePlan`) | POST | `/api/v1/protected/billing/subscriptions/change-plan` | `{ planId, billingInterval }` | Endpoint OK; body uses `planId` instead of `newPlanId` |
| `src/components/account/SubscriptionDashboard.client.tsx:337` | DELETE | `/api/v1/protected/billing/subscriptions/current` | — | Endpoint does not exist; no user-self-cancel exists (SPEC-147 gap) |
| `src/lib/api/endpoints-protected.ts:551` (`getAddons`) | GET | `/api/v1/protected/billing/addons/my` | — | Likely legacy path; backend actual is `/billing/addons` |

**5 endpoints broken. ~4-5h to fix.**

### 2.3 Admin app endpoint mismatches

The admin app has **14 broken calls** across 4 features. The dominant pattern: hooks call `/protected/billing/*` when they should call `/admin/billing/*`.

| Feature | File:Line | Method | Path | Body | Issue |
| ------- | --------- | ------ | ---- | ---- | ----- |
| `billing-subscriptions` | hooks.ts:50 | GET | `/protected/billing/subscriptions` | — | BROKEN-TIER |
| `billing-subscriptions` | hooks.ts:61 | GET | `/protected/billing/subscriptions/:id` | — | BROKEN-TIER |
| `billing-subscriptions` | hooks.ts:75 | DELETE | `/protected/billing/subscriptions/:id` | `{ immediate, reason }` | BROKEN-TIER + METHOD (should be POST `/admin/billing/subscriptions/:id/cancel`) |
| `billing-subscriptions` | hooks.ts:90 | PUT | `/protected/billing/subscriptions/:id` | `{ planSlug }` | BROKEN-TIER + METHOD + BODY (should be POST `/protected/billing/subscriptions/change-plan` with `{ newPlanId, billingInterval }`) |
| `billing-subscriptions` | hooks.ts:163 | POST | `/protected/billing/trial/extend` | `{ subscriptionId, additionalDays }` | BROKEN-TIER (admin equivalent may not exist — verify) |
| `billing-subscriptions` | hooks.ts:195 | GET | `/protected/billing/payments` | — | BROKEN-TIER |
| `billing-payments` | hooks.ts:35 | GET | `/protected/billing/payments` | — | BROKEN-TIER |
| `billing-payments` | hooks.ts:46 | GET | `/protected/billing/payments/:id` | — | BROKEN-TIER |
| `billing-payments` | hooks.ts:60 | POST | `/protected/billing/payments/:id/refund` | `{ amount?, reason }` | BROKEN-TIER |
| `billing-invoices` | hooks.ts:35 | GET | `/protected/billing/invoices` | — | BROKEN-TIER |
| `billing-invoices` | hooks.ts:46 | GET | `/protected/billing/invoices/:id` | — | BROKEN-TIER |
| `billing-invoices` | hooks.ts:56 | POST | `/protected/billing/invoices/:id/pay` | — | BROKEN-TIER |
| `billing-invoices` | hooks.ts:67 | POST | `/protected/billing/invoices/:id/void` | — | BROKEN-TIER |
| `billing-metrics` | hooks.ts:89 | GET | `/protected/billing/customers/search` | — | **REAL 404 in staging** |
| `billing-metrics` | hooks.ts:99 | GET | `/protected/billing/customers/:id/usage` | — | **REAL 404 in staging** |

**Admin "ready" features (per first audit) but with broken endpoints**: subscriptions, payments, invoices, metrics customer search/usage. Confirmed by endpoint audit.

**Admin features that are actually OK**: `billing-plans`, `billing-addons`, `billing-settings`, `billing-notification-logs`, `billing-webhook-events`, `cron-jobs`, parts of `billing-metrics` (dashboard, system-usage, approaching-limits, activity).

### 2.4 Response shapes — mostly OK

Audit found **no systemic envelope mismatch**. Hooks correctly unwrap `.data.data` (admin via fetchApi wrapper) or `.data.<key>` (web). Three endpoints flagged as `NEEDS-RUNTIME-CHECK` because they return loosely-typed data:

- `customer-addons` (typed as `PurchasedAddonsResponse`, no Zod validation)
- `metrics` + `metrics/activity` (typed as `Record<string, unknown>`)
- `metrics/approaching-limits` (transform applied — verify shape after transform)

These should be confirmed via runtime smoke but are **not blockers**.

### 2.5 Missing observability — admin cron history

Admin's `cron-jobs` panel lists jobs and lets the operator trigger them. **It does not consume `cron_run_history`** (the table the runbook §3 instructs operators to query via `hops psql`). After the cron Sentry capture shipped (`62cc7ec0d`), an alert will fire — but the operator has no admin UI to investigate; they have to SSH to the VPS and run psql. **Gap, not a break.**

### 2.6 What the first UI audits got wrong

The initial two audits (Phase 1 of this exercise) said "Admin UI ready: 8/17 surfaces". Those audits checked rendering, not endpoint correctness. The endpoint audit corrected the picture: 4 of those 8 "ready" surfaces (subscriptions table, payments refund, invoices, metrics customer dashboard) are calling broken endpoints. **"Ready" was a false positive.**

---

## 3. Four-phase remediation plan

### Phase 1 — Real-blocker UI fixes (~6h)

Fix only the calls that genuinely fail or hit 404 in staging today. Pre-condition for the smoke gate.

**Web app — `apps/web/src/`**:

- [ ] `components/billing/PlanPurchaseButton.client.tsx:207` — replace inline POST `/billing/checkout` `{ planId }` with `POST /billing/subscriptions/start-paid` `{ planSlug, billingInterval }`. Hardcode `billingInterval: 'monthly'` for now if no interval selector exists; otherwise wire to the new selector (Phase 3 below or part of this phase if simple).
- [ ] `lib/api/endpoints-protected.ts:486` (`createCheckout`) — same fix as above. This is the wrapper most callers use.
- [ ] `lib/api/endpoints-protected.ts:418` (`changePlan`) — change body field `planId` → `newPlanId`. Endpoint path is already correct.
- [ ] `components/account/SubscriptionDashboard.client.tsx:337` — remove or disable the cancel button (no user-self-cancel endpoint exists; SPEC-147 tracks the gap). UX choice: replace with "Contact support" link or hide.
- [ ] `lib/api/endpoints-protected.ts:551` (`getAddons`) — verify backend path. If `/billing/addons/my` is legacy, update to `/billing/addons`.

**Admin app — `apps/admin/src/features/`**:

- [ ] `billing-subscriptions/hooks.ts:90` (`changePlan`) — replace `PUT /protected/billing/subscriptions/:id` `{ planSlug }` with `POST /admin/billing/subscriptions/:id/change-plan` (or whatever admin tier exposes; verify in backend). Body: `{ newPlanId, billingInterval }`.
- [ ] `billing-subscriptions/hooks.ts:75` (`cancelSubscription`) — replace `DELETE /protected/billing/subscriptions/:id` with `POST /admin/billing/subscriptions/:id/cancel`. Body shape matches: `{ immediate, reason }`. **Use this commit** to validate the production fix from `ff1900a0c` works end-to-end.
- [ ] `billing-metrics/hooks.ts:89` — remove or replace the `/protected/billing/customers/search` call. **REAL 404 in staging.** Either find an admin equivalent endpoint or remove the customer search feature for now.
- [ ] `billing-metrics/hooks.ts:99` — same for `/protected/billing/customers/:id/usage`. **REAL 404.**

**Validation per fix**:

- Add a unit test that pins the new endpoint+body shape per hook.
- Confirm `pnpm typecheck`, `pnpm lint`, full test suite green per package before commit.

**Out of scope this phase**:

- Migrate the other 10 admin hooks from `/protected/*` to `/admin/*` (they work by accident via QZPay aliases — defer to Phase 3).
- Add a cycle interval selector to web pricing cards (defer to Phase 3 if needed for smoke).

### Phase 2 — Exploratory smoke (~30min, user-exec)

The user (qazuor) does a 30-minute manual walk-through against staging. Goal: surface anything the static audit missed. Output: a punch list of unanticipated UI gaps.

**Steps**:

1. Sign in to `https://staging.hospeda.com.ar` as a fresh user.
2. Walk: signup → tourist-free entitlements visible → upgrade to paid plan (monthly checkout) → return URL → subscription dashboard shows active → annual upgrade (cycle change) → cancel flow.
3. Login to `https://staging-admin.hospeda.com.ar` as admin.
4. Walk: admin billing customers list → click a customer → view subscription → cancel as admin → refund flow → invoice list → addon management → cron panel → metrics dashboard.
5. Document every gap in a free-form list (which page, what was expected, what happened).

**Decision after Phase 2**:

- If only minor gaps → proceed to Phase 3 (compliance) then Phase 4 (formal smoke).
- If major gaps → loop back to Phase 1 with the punch list.

### Phase 3 — Compliance migration (~5h)

Migrate the 10 remaining admin hooks from `/protected/billing/*` to `/admin/billing/*`. These work today but violate CLAUDE.md. Doing this cleanup AFTER Phase 1+2 (because Phase 1 already touched some of them) keeps the migration mechanical.

**Admin hooks to migrate**:

- `billing-subscriptions/hooks.ts:50, 61, 195` (list, fetch by id, fetch payments)
- `billing-subscriptions/hooks.ts:163` (`trial/extend`) — verify admin equivalent endpoint or document as feature gap.
- `billing-payments/hooks.ts:35, 46, 60` (list, fetch by id, refund)
- `billing-invoices/hooks.ts:35, 46, 56, 67` (list, fetch, pay, void)

**Each migration**: change `/protected/` → `/admin/` in the path, verify the admin endpoint returns the same response shape, no body/method changes (those were Phase 1).

**Out of scope this phase**: response shape edge cases (3 endpoints flagged as `NEEDS-RUNTIME-CHECK`). Defer to Phase 4 smoke.

### Phase 3b (optional, ~2h) — Admin cron history viewer

Add a `cron_run_history` viewer to the admin cron panel. Operator-side delivery for the Sentry alerts shipped in the previous PR.

**Steps**:

- Backend: verify the endpoint exists (if not, expose `GET /api/v1/admin/cron/history` returning the last N rows of `cron_run_history`).
- Admin: add a `CronHistoryTable` component below `CronJobsPanel`. Columns: job_name, status, started_at, finished_at, error_message (first 200 chars).
- Wire via TanStack Query with 1-minute auto-refresh.

**Defer if**: smoke shows operator is happy with `hops psql` for now. Re-prioritize if Sentry alerts start firing and they need UI triage.

### Phase 4 — Formal smoke + sign-off (~1h user-exec, then merge)

Once Phase 1 (and ideally Phase 3) are merged, the user runs the SPEC-143 formal smoke checklists:

- T-143-21: Phase 1 staging smokes
- T-143-23: Phase 1 prod smokes (billing-CORE sections only)
- T-143-37: Phase 2 staging smokes
- T-143-46: Phase 3 staging smokes

Each requires sign-off entries in `docs/billing/staging-smoke-checklist.md` and `docs/billing/prod-smoke-checklist.md` per CLAUDE.md.

After smokes green: PR #1184 merges to staging. After soak time: staging → main merge per branch workflow.

---

## 4. Phase ordering rationale

**Why not "Phase 1+3 together"**: response-shape edge cases caught in Phase 2 smoke may force Phase 1 fixes to be different. Doing 3 before 2 means we'd potentially rewrite the same hook twice.

**Why Phase 2 is user-exec**: agent cannot interact with the staging UI; the smoke checklist explicitly requires real MP sandbox + browser navigation. Agent can write code, user runs the gate.

**Why Phase 3b is optional**: cron history viewer is operator-UX. The Sentry alerts shipped previously already cover the alert pipeline; this is a "make it nicer to triage" upgrade, not a smoke blocker.

---

## 5. Decision tree

```
Start
  → Phase 1 (agent, ~6h)
    → All fixes green locally?
        no → fix, re-test
        yes → commit, push PR (new PR or push to #1184)
              → Phase 2 (user, ~30min)
                  → Major gaps?
                      yes → back to Phase 1 with punch list
                      no  → Phase 3 (agent, ~5h)
                              → Phase 3b? user choice
                              → Phase 4 (user, ~1h)
                                  → Smokes green → merge PR
```

---

## 6. Out of scope

- New refund UI (bug `bug/refund-flow-gaps` — v1 manual via MP dashboard).
- Dispute resolution UI (v1 manual per `dispute-handling-v1.md`).
- Multi-currency selectors (SPEC-150 deferred).
- Payment method management (no SPEC).
- Promo code analytics, bulk subscription ops, subscription state timeline, CSV exports — nice-to-have, post-launch.

---

## 7. Cross-references

- [`docs/billing/billing-runbooks.md`](./billing-runbooks.md) — operational runbooks.
- [`docs/billing/coverage-audit-2026.md`](./coverage-audit-2026.md) — backend coverage audit.
- [`docs/billing/sentry-alerts-runbook.md`](./sentry-alerts-runbook.md) — alert configurations.
- `.qtm/specs/SPEC-143-billing-testing-coverage/` — spec + tasks.
- `apps/admin/CLAUDE.md` — admin tier rule that Phase 3 migration enforces.
- Engram topic `bug/no-user-self-cancel-endpoint` — SPEC-147 gap.
