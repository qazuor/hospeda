---
spec-id: SPEC-262
title: Billing Promo-Code Typed Effect Engine
type: feature
complexity: high
status: draft
created: 2026-06-22
---

# SPEC-262: Billing Promo-Code Typed Effect Engine

## Part 1 — Functional Specification

### 1. Overview & Problem

**Problem.** The current promo-code system models only **one-shot discounts**: a
percentage or fixed amount, computed **once at checkout** and never re-applied.
The owner needs three promo-code use cases the engine cannot express:

1. **Free-forever** — a code that leaves a customer permanently free (no charge,
   ever, across all renewals).
2. **Trial extension** — a code that extends the trial by N days/months, and that
   must also work on an **existing** subscription, not only at signup.
3. **Multi-cycle discount** — e.g. "50% off the first 3 months": a discount that
   re-applies on each renewal for N cycles, then stops.

**Why the current engine fails these (verified in code).**

- The discount is computed exactly once. In
  `packages/service-core/src/services/billing/promo-code/promo-code.redemption.ts`,
  `applyPromoCode()` branches only on `promoCode.type === 'percentage'` (else
  treats it as `fixed`) and returns `finalAmount = Math.max(0, effectiveAmount -
  discountAmount)`. There is no logic that re-applies an effect on a renewal.
  Recurring monthly charges are driven by the MercadoPago preapproval
  (`billing_subscriptions.mp_subscription_id`) and `billing_prices.unit_amount`,
  both blind to the historical promo code.
- `HOSPEDA_FREE` (100% permanent) and `FREEMONTH` (trial extension, 30 extra
  days) exist **only as config metadata** in
  `packages/billing/src/config/promo-codes.config.ts`. The fields `isPermanent`,
  `durationCycles`, `extraTrialDays`, and `type: 'discount' | 'free_trial_extension'`
  live on the `PromoCodeDefinition` interface but are **NOT persisted** to the DB.
  The DB column `billing_promo_codes.type` (a `varchar(50)`, not a Postgres enum)
  only ever stores `'percentage'` / `'fixed'`. So **`HOSPEDA_FREE` is a latent
  bug**: it looks free (100%) but renewal logic does not honor it — after the
  first cycle MercadoPago would charge the full price.
- The user-facing `/apply` endpoint (`POST
  /api/v1/protected/billing/promo-codes/apply`) ignores the code's effect type and
  assumes every code is a money discount.
- Trial extension only works at **signup**: it is consumed exclusively in
  `apps/api/src/services/subscription-checkout.service.ts`, which calls
  `resolveFreeTrialExtensionPromo()` from `@repo/billing` (config-only) and
  translates it to `freeTrialDays` on the qzpay subscription-create input. There
  is **no path** to extend an active subscription's `billing_subscriptions.trial_end`.

**Goal.** Give a promo code a typed, **persisted** `effect` that the billing
engine honors at checkout AND on every renewal, covering all three use cases,
fixing the latent `HOSPEDA_FREE` bug, and preserving every existing one-shot
percentage/fixed code.

**Target users.** Platform admins (who create promo codes via the admin billing
surface) and end customers / hosts (who redeem them at checkout or via support).

**Success metrics.**

- A code created as "50% off, 3 cycles" charges 50% off for exactly 3 paid cycles
  and full price on the 4th, observable in `billing_promo_code_usage` /
  subscription state.
- A code created as "free forever" results in **zero** charges across at least 2
  renewal cycles in staging.
- A trial-extension code applied to an **active** subscription pushes `trial_end`
  out by the configured amount and defers the next charge accordingly.
- All pre-existing one-shot percentage/fixed codes keep producing identical
  checkout discounts (regression: no behavior change for `durationCycles = 1`).

### 2. Background & Decision

Two architectures were evaluated for delivering the three use cases.

**Option A — Treat cases 1 & 2 as subscription operations; keep the discount
engine untouched.**

- *What it does.* Model "free forever" and "trial extension" as direct
  subscription state changes (set a `comp` flag / push `trial_end`) invoked by an
  admin/support action, leaving `applyPromoCode()` as the only money-discount path.
- *Pros.* Lightest change; no renewal-time discount machinery; YAGNI-friendly when
  only cases 1 & 2 are on the table (both are state changes, not real discounts).
- *Cons.* Does **nothing** for case 3 (multi-cycle discount), which is a genuine
  recurring-discount problem. Forces a second, parallel system later for case 3,
  and keeps promo "free forever" as an out-of-band manual op rather than a code.

**Option B (CHOSEN) — Extend the promo-code engine to carry typed effects.**

- *What it does.* Persist a typed `effect` on each promo code; the engine branches
  by effect type at checkout and re-applies / decrements / skips at renewal.
- *Pros.* One engine covers all three cases. The expensive core — "re-apply an
  effect for N cycles against MercadoPago recurring" — is exactly what case 3
  requires; once it exists, **free-forever** (100% / infinite cycles) and
  **trial_extension** fall out as sibling effect types almost for free. Promo
  codes stay first-class, admin-creatable, auditable, and uniformly validated.
- *Cons.* Heaviest change; touches billing CORE (triggers SPEC-143 gates); must
  reconcile with MercadoPago recurring preapproval limitations (the main risk).

**Decision.** With **only** cases 1 & 2, Option A would be the right YAGNI call.
But case 3 is a real multi-cycle discount, and building the "re-apply for N
cycles on each MP recurring charge" machinery is unavoidable for it. Once that
machinery exists, building a *second* parallel state-change system for cases 1 & 2
would be the worse YAGNI violation. Therefore the **unified typed-effect engine
(Option B)** wins. This decision is owner-approved as the working architecture for
this spec. The 100%-forever sub-decision is now CLOSED in favor of an explicit
`comp` subscription state (see §7.3 and §14 decision 1).

### 3. The Three Use Cases (concrete)

| # | Name | Example code | Effect | At checkout | On each renewal |
|---|---|---|---|---|---|
| 1 | Free forever | `HOSPEDA_FREE` | `discount` 100%, `durationCycles = null` (OR `comp` state — OQ-1) | first charge = 0 | every charge = 0, indefinitely |
| 2 | Trial extension | `FREEMONTH` | `trial_extension`, `extraDays = 30` | push first charge by N days | n/a (one-time effect; also appliable to an existing sub) |
| 3 | Multi-cycle discount | `LANZAMIENTO50` | `discount` 50%, `durationCycles = 3` | charge −50% | charge −50% for cycles 2 and 3, then full price |

Backward-compat anchor: an existing one-shot code (`BIENVENIDO30`, 30% first
month) becomes `discount` with `durationCycles = 1` — applied once, never on
renewal. This is the default for every legacy code (see §9).

### 4. Effect Model (functional definition)

A promo code carries exactly one **effect**, one of:

- **`discount`** — parameters: `value` (number) + `valueKind` (`percentage` |
  `fixed`) + `durationCycles` (`1` = one-shot, `N` = first N paid cycles, `null` =
  forever). Free-forever is expressible here as `value = 100`, `valueKind =
  percentage`, `durationCycles = null`.
- **`trial_extension`** — parameters: `extraDays` (positive integer). Applies at
  signup (defers first charge) AND can be applied to an existing subscription to
  push out `trial_end`. (Days are the canonical unit; "months" in the owner brief
  is expressed as `extraDays = 30 * months` at creation time — see OQ-3.)
- **`comp`** (complimentary / permanently free) — OPTIONAL first-class subscription
  state, evaluated in §7.3 as an alternative to `discount` 100%/forever. Parameters:
  none beyond the marker. The spec recommends one of the two models in §7.3 and
  flags the final choice as OQ-1 for the owner.

> Invariant: every promo code has a valid `effect`. Legacy rows with no persisted
> effect are migrated (§9) to `discount` / `durationCycles = 1`, preserving today's
> behavior.

### 5. User Stories & Acceptance Criteria

#### US-1 — Admin creates a multi-cycle discount code

> As a platform admin, I want to create a code "50% off the first 3 months", so I
> can run a launch promotion that auto-stops after 3 cycles.

- **AC-1.1** Given I have `BILLING_PROMO_CODE_MANAGE`, when I create a code with
  effect `discount`, `valueKind = percentage`, `value = 50`, `durationCycles = 3`,
  then the code is persisted with that effect readable back via `GET
  /api/v1/admin/billing/promo-codes/{id}`.
- **AC-1.2** Given a `percentage` discount, when `value > 100`, then creation is
  rejected with `422 VALIDATION_ERROR` (the existing percentage≤100 refine is
  preserved).
- **AC-1.3** Given `durationCycles`, when it is `0` or negative, then creation is
  rejected `422`; `null` (forever) and any positive integer are accepted.
- **AC-1.4** Given a customer redeems this code at checkout, when the first paid
  cycle is charged, then the charged amount is `originalAmount − 50%`, and a
  `billing_promo_code_usage` row records the discount and links the subscription.
- **AC-1.5** Given the code is active on the subscription, when renewal cycles 2
  and 3 are billed, then each is charged at −50% and the remaining-cycle counter
  decrements; when cycle 4 is billed, then it is charged at full price and the
  effect is marked exhausted.

#### US-2 — Free-forever code never charges

> As a platform admin, I want a `HOSPEDA_FREE` code that leaves the customer
> permanently free, so internal/comped accounts never get billed.

- **AC-2.1** Given a code with the chosen free-forever model (§7.3), when a
  customer redeems it, then the first cycle charge is **0**.
- **AC-2.2** Given the customer reaches renewal, when each subsequent cycle would
  be billed, then the charged amount is **0**, indefinitely (verified across ≥2
  cycles).
- **AC-2.3** Given the legacy latent bug, when `HOSPEDA_FREE` is migrated, then it
  no longer reverts to full price after cycle 1 (regression test asserts cycle-2
  charge = 0).
- **AC-2.4** Given a free-forever subscription, when an admin lists/inspects it,
  then its free state is explicit and auditable (not silently a 100% discount that
  could be mistaken for expired).

#### US-3 — Trial extension on an existing subscription

> As a support admin, I want to apply a trial-extension code to a customer's
> already-active subscription, so I can grant extra free time after signup.

- **AC-3.1** Given a subscription in `trialing` status with `trial_end = T`, when a
  `trial_extension` code with `extraDays = 30` is applied, then `trial_end` becomes
  `T + 30 days` and the next charge is deferred accordingly.
- **AC-3.2** Given the same code applied at **signup**, then it behaves as today
  (translated to `freeTrialDays` on the qzpay subscription-create), with no
  regression to the existing `/start-paid` flow.
- **AC-3.3** Given the subscription has an active MercadoPago preapproval
  (`mp_subscription_id` set), when the trial is extended, then the MP-side
  next-charge date is adjusted (or the divergence is reconciled) so MP does not
  charge before the new `trial_end` — the exact MP mechanism is a design task
  (§8) and the primary risk (§10).
- **AC-3.4** Given a `trial_extension` code applied to a subscription that is NOT
  in a trial-eligible state (e.g. already `active` past trial), then the operation
  is rejected with a typed error (`VALIDATION_ERROR`) and no state changes.
- **AC-3.5** Given an annual (one-time charge, `mp_subscription_id = null`)
  subscription, when a `trial_extension` is applied, then the behavior is defined
  explicitly (apply to `trial_end` if in trial, else reject) — no silent no-op.

#### US-4 — Backward compatibility for existing codes

> As the platform, existing percentage/fixed one-shot codes must keep working
> unchanged.

- **AC-4.1** Given any pre-existing `percentage` or `fixed` code, after migration
  it is `discount` with `durationCycles = 1`, and redeeming it yields the **same**
  checkout discount and `finalAmount` as before this spec.
- **AC-4.2** Given a `durationCycles = 1` discount, when the subscription renews,
  then the renewal charge is full price (the discount does NOT re-apply).
- **AC-4.3** Given the existing `/apply` endpoint contract, when a one-shot
  discount is applied, then the response shape (`discountAmount`, `finalAmount`)
  is unchanged for clients.

#### US-5 — Admin surfaces every effect type

> As a platform admin, I want the admin promo-code form to let me pick the effect
> type and its parameters, so I can create any of the three kinds.

- **AC-5.1** Given the admin create-promo-code form, then I can select effect type
  (`discount` / `trial_extension` / `comp`-or-equivalent) and the form shows only
  the parameters valid for that type.
- **AC-5.2** Given I pick `discount`, then I can set `valueKind`, `value`, and
  `durationCycles` (with a "forever" toggle for `null`).
- **AC-5.3** Given I pick `trial_extension`, then I can set `extraDays` (or
  months, converted to days), and `value`/`durationCycles` controls are hidden.
- **AC-5.4** Given invalid combinations (e.g. `percentage` value 150, negative
  days), then the form blocks submit and the API rejects with `422`.

#### US-6 — Permission & ownership gates (unchanged)

- **AC-6.1** Given a user without `BILLING_PROMO_CODE_MANAGE`, when they create or
  edit a code, then the API returns `403 FORBIDDEN`.
- **AC-6.2** Given a user applying a code, when `customerId` is not their own
  billing customer and they lack `ACCESS_API_ADMIN`, then `403` (existing guard).

### 6. UX Considerations

- **Admin form.** Effect-type selector drives a conditional parameter panel:
  `discount` → valueKind + value + durationCycles (+ "forever" toggle);
  `trial_extension` → extra days/months; `comp` (if adopted) → no extra params.
  All copy in `@repo/i18n` (es/en/pt). Validation mirrors the Zod schema.
- **Checkout / apply feedback.** When a multi-cycle or free-forever code is
  applied, the UI states the ongoing effect explicitly (e.g. "50% off for 3
  months", "Free forever"), not just a single-cycle discount amount, so the
  customer is not surprised by later charges.
- **Support / admin subscription view.** A subscription carrying an active promo
  effect shows the effect kind and remaining cycles (or "forever" / "trial
  extended to <date>"), so support can reason about why a charge was 0 or reduced.
- **Error states.** Every rejection (invalid effect params, trial-extension on a
  non-trial sub, MP reconcile failure) surfaces a typed error with a clear
  user/admin-facing message; nothing fails silently.
- **Empty/edge.** Applying a code to an annual sub, an already-exhausted
  multi-cycle code, or an expired code each renders an explicit message.

### 7. Architecture / Effect-Engine Design (functional)

#### 7.1 Persisted effect

The effect type + parameters become **persisted** on `billing_promo_codes`. The
table already has a `config jsonb DEFAULT '{}'` column and a `type varchar(50)`
column (NOT a Postgres enum). Two viable shapes (decided in §8 as a data task):

- (i) widen the meaning of `type` to include `'trial_extension'` (and optionally
  `'comp'`) and store effect parameters (`durationCycles`, `valueKind`,
  `extraDays`) in the existing `config` jsonb; or
- (ii) add explicit typed columns (`effect_kind`, `value_kind`, `duration_cycles`,
  `extra_days`) for queryability.

Because `type` is a plain varchar (no enum migration needed to add values), option
(i) is the lighter structural change; option (ii) is more self-documenting and
indexable. The choice is a design task (§8) — but in BOTH cases the engine reads a
single resolved effect, so the rest of the design is shape-agnostic.

#### 7.2 Subscription-side effect tracking

A multi-cycle discount needs to know **how many cycles remain**. The
`billing_subscriptions` table already has `promo_code_id` (FK) and a `metadata
jsonb`. Renewal-time logic must decrement a remaining-cycle counter and stop when
it hits 0. Where that counter lives (a new `promo_effect_remaining_cycles` column
vs `metadata` jsonb vs a dedicated `billing_subscription_promo_effects` table) is a
design task (§8). The engine contract is: given a subscription about to be
charged, resolve its active promo effect, compute the charge, and update remaining
state.

#### 7.3 Free-forever: 100%-discount-forever vs explicit `comp` state (recommendation)

Two models for "permanently free":

- **Model α — `discount` 100% / `durationCycles = null`.** Reuses the discount
  path; free = the discount engine computing 0 every cycle. *Pro:* zero new state,
  one code path. *Con:* "free" is implicit; a reporting query for "active paid
  subs" must special-case 100%-discounts; risk of a future change to the discount
  path silently breaking free accounts.
- **Model β — explicit `comp` subscription state.** A subscription marked `comp`
  short-circuits billing entirely (never creates/relies on an MP preapproval
  charge). *Pro:* explicit, auditable, robust against discount-engine changes,
  clean for reporting. *Con:* a new state to thread through status logic, crons,
  and entitlement loading.

**DECISION: Model β (explicit `comp`)** for true "free forever" (owner-confirmed
2026-06-22, §14 decision 1), because the free-forever requirement is fundamentally
a *state* ("this account is never billed"), not a *price computation*, and modeling
it as state avoids the implicit-100%-discount fragility that produced the current
`HOSPEDA_FREE` latent bug in the first place. A `comp` subscription retains the
entitlements of the plan it was comped on (comp = "plan X, never charged", not
"no plan"). Multi-cycle discounts (case 3) still use the `discount` effect.

#### 7.4 Effect-engine seams (where the code branches)

- **Checkout/apply** (`promo-code.redemption.ts::applyPromoCode` and the
  `/apply` route) branch by effect kind instead of assuming a money discount.
- **Signup trial** (`subscription-checkout.service.ts`) keeps consuming
  `trial_extension` but resolves it from the **persisted** code, not only the
  `@repo/billing` config.
- **Existing-sub trial extension** (NEW operation/route) pushes `trial_end` and
  reconciles MP.
- **Renewal** — recurring charges flow through MercadoPago preapprovals +
  webhooks; the engine must intercept the per-cycle amount (or pre-adjust the
  preapproval) so the discount/skip is honored. This intercept point is the core
  design task (§8) and primary risk (§10).

### 8. Out of Scope

- **New non-billing promo use cases** (referral rewards, loyalty points,
  marketing-only codes) — only the three billing effects in §3.
- **Stacking multiple effects on one code** — each code carries exactly one
  effect. Combinability of separate codes (`combinable` column) is unchanged and
  not extended here.
- **Migrating the promo-code engine off MercadoPago** — MP remains the processor;
  this spec adapts to it.
- **A general "pause subscription" feature** — `comp` (if adopted) is permanent
  free, not a pause/resume mechanism.
- **Changing how `billing_prices.unit_amount` is defined** — the base price is
  untouched; effects modify the *charged* amount, not the catalog price.
- **Self-service code creation by hosts** — code creation stays admin-only.

## Part 2 — Technical Analysis

### 9. Data Model Changes & Migration

**Two migration carriles apply (project rule).** Structural changes (new columns /
widened semantics on `billing_promo_codes` and `billing_subscriptions`) go through
`pnpm db:generate` + `pnpm db:migrate`. Any Drizzle-invisible objects (CHECK
constraints on effect params, partial indexes, data backfills) go to
`packages/db/src/migrations/extras/` as hand-written idempotent SQL re-applied by
`pnpm db:apply-extras` (next free number is `018-*`).

**Promo-code side (`billing_promo_codes`).** Persist the effect. `type` is a
`varchar(50)` (no enum to extend). Either widen `type` + use the existing `config`
jsonb for params, or add explicit columns (`effect_kind`, `value_kind`,
`duration_cycles`, `extra_days`) — decided as task T (OQ-2). Whichever is chosen,
add CHECK/validation so impossible combinations cannot be persisted.

**Subscription side (`billing_subscriptions`).** Add remaining-cycle tracking for
multi-cycle discounts and, if Model β is adopted, the `comp` state marker. Existing
columns `promo_code_id`, `trial_end`, `metadata`, `status` (varchar, not enum) are
reused. The `status` value set may gain `comp` (varchar, so no enum migration).

**Data migration (backward-compat, AC-4 / AC-2.3).**

- Every existing `billing_promo_codes` row (all currently `percentage`/`fixed`) is
  classified as `discount` with `durationCycles = 1` — identical behavior.
- The config-only specials are reconciled into the persisted model:
  `HOSPEDA_FREE` → free-forever (Model α or β per OQ-1), **fixing the latent bug**;
  `FREEMONTH` → `trial_extension`, `extraDays = 30`; `LANZAMIENTO50` →
  `discount`/percentage 50/`durationCycles = 3`; `BIENVENIDO30` →
  `discount`/percentage 30/`durationCycles = 1`.
- Any subscriptions currently relying on a config-only special are reconciled so
  their on-renewal behavior matches the newly-persisted effect (especially
  `HOSPEDA_FREE` subs, which must charge 0 going forward).

**Backfill safety.** Backfill SQL is idempotent and re-runnable; a dry-run /
count step precedes the write, and the migration guide's manual table-backup step
applies before running against staging/prod.

### 10. MercadoPago / Renewal Risk Analysis (PRIMARY RISK)

Recurring monthly charges are MercadoPago **preapprovals**
(`billing_subscriptions.mp_subscription_id`), driven by MP's own schedule and
reported via webhooks; the project has `subscription-poll.job.ts`,
`dunning.job.ts`, and `webhook-retry.job.ts` around them. **MercadoPago
preapprovals do not natively understand "skip this cycle" or "discount the next N
cycles".** This is the core technical risk and the hardest part of the spec.

Candidate mechanisms (to be evaluated as a design task — NOT decided here):

1. **Amount-mutating preapproval updates** — adjust the preapproval's
   `transaction_amount` to the discounted figure for the discounted cycles, then
   restore it; depends on what MP allows updating on a live preapproval and the
   timing window.
2. **Cancel + recreate preapproval per effect change** — clean but heavy, risks
   gaps/double-charges and changes `mp_subscription_id`.
3. **Free-forever via no-preapproval `comp` state** — for Model β, never run an MP
   recurring charge for comped subs at all (sidesteps MP entirely for case 1).
4. **Our-side ledger + reconciliation** — let MP charge its base amount and issue a
   compensating refund/credit for the discount delta; avoids MP mutation but adds
   refund accounting and webhook reconciliation complexity.

The spec **does not pick** the MP mechanism — it is the first technical task, with
its own spike, because the choice ripples through every cycle of cases 1 and 3.
**This risk gates the whole feature** and is the reason the SPEC-143 MP staging
smoke (and prod smoke for the billing CORE) is mandatory (§12).

Secondary risks: trial-extension MP date adjustment (AC-3.3) on a live
preapproval; cron interaction (poll/dunning must not "correct" an intentionally-0
or discounted charge back to full price); and the latent `HOSPEDA_FREE` bug must
be **fixed, not preserved**, in the migration.

### 11. Effect-Engine Seams (implementation surfaces, by layer)

- **`@repo/schemas`** — extend the promo-code schemas
  (`packages/schemas/src/api/billing/promo-code.schema.ts`): the create/response
  schemas gain the effect fields; `CreatePromoCodeSchema` currently hardcodes
  `discountType: percentage|fixed` and a percentage≤100 refine — these become the
  `discount` branch of a discriminated effect. SSOT for API + admin form types.
- **`@repo/db`** — schema + migrations per §9 (structural via `db:generate`,
  extras for constraints/backfill).
- **`@repo/service-core`** — the promo-code module
  (`services/billing/promo-code/`) branches by effect:
  `promo-code.redemption.ts::applyPromoCode` no longer assumes a money discount;
  a new operation extends an existing subscription's trial; renewal-time resolution
  - remaining-cycle decrement live here (or in a billing service called by the
  renewal path). `promo-code.service.ts` (the `PromoCode` DTO / facade) and
  `promo-code.crud.ts` (`mapDbToPromoCode`) surface the persisted effect.
- **`@repo/billing`** — `promo-codes.config.ts` stops being the source of truth for
  specials; `resolveFreeTrialExtensionPromo()` either reads the persisted code or
  is retired in favor of the DB-backed effect.
- **`apps/api`** — `routes/billing/promo-codes.ts` (the `/apply` route branches by
  effect; the admin create route stops hardcoding `percentage|fixed`); a NEW route
  for "apply trial extension to existing subscription";
  `subscription-checkout.service.ts` resolves trial extension from the persisted
  code; the renewal/webhook path honors the effect; cron jobs
  (`subscription-poll`, `dunning`) must respect comped/discounted cycles.
- **`apps/admin`** — promo-code create/edit form gains the effect-type selector and
  conditional parameter panel (§6 / US-5), with i18n.

### 12. Testing Strategy

**No tests = not done.** Coverage target ≥ 90% on new engine code.

**Unit — effect engine (service-core, real DB or seeded fixtures):**

- `discount` with `durationCycles = 1` reproduces today's `finalAmount` exactly
  (regression lock for AC-4).
- `discount` with `durationCycles = 3` applies on cycles 1–3, stops on 4;
  remaining-cycle counter decrements correctly; boundary at exactly N.
- `discount` 100% / forever (or `comp`) yields 0 on cycle 1 and every renewal
  (AC-2, including the `HOSPEDA_FREE` regression that cycle-2 ≠ full price).
- `trial_extension` at signup → correct `freeTrialDays`; applied to an active
  trialing sub → `trial_end` pushed by N days; rejected on non-trial / annual subs
  with a typed error (AC-3.4 / AC-3.5).
- Effect param validation rejects impossible combos (percentage > 100, negative
  days, durationCycles ≤ 0).

**Unit — migration/backfill:** legacy rows → `discount`/`durationCycles = 1`;
specials reconciled to the right effect; idempotent re-run is a no-op.

**Integration — API:** admin create/edit for each effect type (success + `422`
on bad params + `403` without permission); `/apply` per effect; the new
existing-sub trial-extension route (success, non-trial rejection, ownership 403).

**Component — admin form:** effect-type selector toggles the right parameter panel;
client validation blocks invalid submits; i18n keys present (es/en/pt).

**SPEC-143 MercadoPago gate (MANDATORY — billing CORE change).** Per the project
rule, any PR touching the billing surface requires the relevant **staging** MP
smoke against the real MP sandbox, and because this changes the billing **CORE**
(charge computation on recurring preapprovals, trial/preapproval adjustment), the
**prod** smoke is also required as the go-live gate. Sign-offs filed in
`.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` (and
`prod-smoke-checklist.md`) and referenced in the PR. The vitest suite uses an MP
stub and cannot catch stub-vs-real divergences; the real-sandbox smoke is the gate.
Specifically exercise: a multi-cycle discount across ≥2 real renewal cycles, a
free-forever code across ≥2 cycles (zero charge), and a trial extension on a live
preapproval.

### 13. Risks & Mitigations

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| MP preapprovals can't natively skip/discount a cycle | High | High | Dedicated MP-mechanism spike (§10) before building renewal logic; pick mechanism with explicit staging proof |
| Latent `HOSPEDA_FREE` bug preserved instead of fixed | Med | High | Migration explicitly reconciles it + AC-2.3 regression test (cycle-2 = 0) |
| Crons (poll/dunning) "correct" an intentional 0/discounted charge to full | Med | High | Crons must read the active effect; integration tests assert no correction of comped/discounted cycles |
| Trial-extension MP date adjustment on a live preapproval misfires | Med | Med | Staging smoke on a real preapproval (AC-3.3); reject unsupported cases (AC-3.4/3.5) rather than guess |
| Backward-compat break for legacy one-shot codes | Low | High | `durationCycles = 1` migration + AC-4 regression locking identical `finalAmount` |
| Effect-param model lets impossible combos persist | Low | Med | Zod discriminated effect + DB CHECK (extras carril) + validation tests |
| Free-forever model (α vs β) reopened mid-build | Med | Med | Resolve OQ-1 before the data-model task; recommendation = β documented (§7.3) |

### 14. Resolved Decisions (owner-confirmed 2026-06-22)

All five open questions are CLOSED. These are now binding decisions for task
atomization, not open choices.

1. **OQ-1 — Free-forever model → RESOLVED: Model β (explicit `comp` state).** A
   subscription marked `comp` short-circuits billing and never creates/relies on an
   MP preapproval. Rationale: free-forever is a *state*, not a price computation;
   modeling it as state removes case 1 from the risky MP-recurring mechanism
   entirely (no preapproval to mutate) and kills the `HOSPEDA_FREE` latent-bug
   class. Cost (threading `comp` through `status`, crons, entitlement loading) is
   accepted. `discount` 100%/forever (Model α) is rejected. Supersedes the §7.3
   recommendation — now a decision.
2. **OQ-2 — Effect persistence → RESOLVED: explicit typed columns + CHECK.** The
   charge-governing fields (`effect_kind`, `value_kind`, `value`, `duration_cycles`,
   `extra_days`, and the subscription-side remaining-cycle counter) become explicit
   typed columns with DB CHECK constraints (extras carril). The existing
   `config` jsonb is kept ONLY for genuinely optional metadata. Rationale: billing
   core needs hard guarantees + queryability/indexability; the renewal cron reads &
   decrements the cycle counter every cycle, so it must be a typed column, not a
   jsonb dig. Rejects option (i) (all-jsonb).
3. **OQ-3 — Trial-extension unit → RESOLVED: days canonical (`extra_days`).** The
   admin form may accept months for UX and converts to days at creation; the
   persisted/source-of-truth unit is days. Rationale: MP `freeTrialDays` and
   `trial_end` are day-based; "months" is ambiguous (28–31 days, from-when) and must
   not reach the charge engine.
4. **OQ-4 — MP recurring mechanism → RESOLVED (direction + constraint; exact API
   still a spike).** Case 1 (free-forever) uses NO preapproval (consequence of OQ-1
   β) — closed. Case 3 (multi-cycle discount): PRIMARY mechanism is **mutating the
   preapproval `transaction_amount`** for the discounted cycles. **Refund/credit
   fallback is VETOED** (cobro-full + visible refund is unacceptable UX). If the §10
   spike finds MP cannot mutate the amount reliably, the team does NOT silently fall
   back to refunds — the case-3 delivery is **redesigned** and re-surfaced to the
   owner. The spike (first technical task) verifies MP preapproval update semantics
   against current MP docs; mechanisms 2 (cancel+recreate) and 4 (ledger+refund) are
   out unless explicitly re-approved.
5. **OQ-5 — Trial extension on annual subs → RESOLVED: confirmed.** Annual sub still
   in trial → extend `trial_end`, defer the one-time charge. Annual sub already
   `active` (charged) → reject with a typed error (never a silent no-op). Granting
   free time to an already-paid annual (extending `period_end`) is a DIFFERENT effect
   (`extend_period`) and is explicitly OUT OF SCOPE (follow-up if needed).

## Internal Review Notes

**Current-state facts corrected vs the briefing during code verification.**

- The config codes are `LANZAMIENTO50` and `FREEMONTH` (not `FREEMONTH_CODE`); the
  trial-extension config `type` value is `'free_trial_extension'` (not
  `trial_extension`).
- `billing_promo_codes.type` is a **`varchar(50)`**, NOT a Postgres enum — adding
  effect types needs no enum-extension migration.
- `billing_promo_codes` already has a **`config jsonb`** column, a natural home for
  effect params if columns are not added.
- `durationCycles` / `isPermanent` already exist on the **config** interface
  (`PromoCodeDefinition`) but are config-only / not persisted — the gap is
  persistence + engine honoring, not modeling them from scratch.
- The promo routes are mounted at `/api/v1/protected/billing/promo-codes` (user
  apply/validate) and `/api/v1/admin/billing/promo-codes` (admin CRUD), not a
  single generic path. The admin create route hardcodes `discountType:
  'percentage' | 'fixed'`.
- Trial extension is consumed only in
  `apps/api/src/services/subscription-checkout.service.ts` (via
  `resolveFreeTrialExtensionPromo` from `@repo/billing`, config-backed), translated
  to `freeTrialDays` at signup — `trial-expiry.ts` only expires trials, it does not
  apply promo trial extensions.
- There is no dedicated "renewal" cron; recurring charges run through MercadoPago
  preapprovals + webhooks, with `subscription-poll.job.ts` / `dunning.job.ts` /
  `webhook-retry.job.ts` around them.

**External docs.** MercadoPago preapproval update/cancel semantics must be verified
against current MP docs during the §10 spike (Context7 / MP API docs) — not assumed.
