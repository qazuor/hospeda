---
title: Commercial agreements V1 (one payer, several free verticals, private plans)
linear: HOS-2211
statusSource: linear
type: feature
areas:
  - db
  - api
  - admin
  - web
  - billing
created: 2026-11-15
smoke:
  - status-needs-smoke-staging
  - status-needs-smoke-prod
---

# Commercial agreements (V1)

> Code references were verified at `origin/staging` `96756adfc4` (after the HOS-1352 epic
> merged). Line numbers drift; symbol names are the stable anchor. Migration, extras and
> seed numbers (0225, 0226, 058-060, 0177) are the next free ones at that commit and may
> move by implementation time.
>
> This is the V1 cut decided by the owner. The full design (succession of prior
> subscriptions, automatic compensation, re-authorization) is preserved in
> [`docs/full-design-pre-v1.md`](docs/full-design-pre-v1.md) and tracked as V2 in Linear **HOS-2226**.

## Part 1: Functional Specification

### Overview & Goals

- **Goal**: let staff sell one customer a single negotiated package that covers several
  verticals (accommodation, venue, experience, partner, tourist), charged as ONE recurring
  fee through ONE MercadoPago preapproval, built from private plans that never appear in
  the public catalog.
- **V1 boundary**: an agreement only covers verticals where the customer has nothing live
  and paid. Staff clears any blocking subscription beforehand with the existing tools
  (cancellation, refund, courtesy) and compensates by hand. No subscription is replaced
  automatically, so there is no succession, no automatic compensation and no
  re-authorization in V1.
- **Motivation**: today each vertical is a separate subscription with its own preapproval
  and public plan. Commercial customers (hotel groups, complexes that also run a restaurant
  and excursions, partners) negotiate one price. The only admin-initiated precedent
  (action 6, `configurePartnerBilling` -> `startManualSubscription`) is MANUAL and
  Partner-only.
- **Success metrics**:
  - A SUPER_ADMIN builds and offers an agreement in under 10 minutes without touching code.
  - The customer authorizes once and is charged once per cycle.
  - No agreement is ever created over a live paid subscription (enforced by
    `findAgreementBlockers`; INV:8 backs it in the DB only against origin rows, "`subscription`").
  - Zero private plans leak to any public surface (guarded).
- **Target users**: SUPER_ADMIN staff (sales and billing ops); multi-vertical customers.

### Glossary

| Term | Meaning |
|---|---|
| Agreement | `agreement` row: one customer, a lifecycle, and its versions. |
| Agreement version | `agreement_version` row: immutable commercial terms (amount, cycle, grace days, lines). Only its `status` and timestamps change. |
| Line | `agreement_version_line`: one `(vertical, private plan version)` pair of a version. |
| Payer | The single `subscription` row of class `ACUERDO` (vertical NULL, no plan anchors, payment method `CARD`). It holds the preapproval (`provider_link`), payments, covered periods and receipts. |
| Child | An ordinary `PRINCIPAL` subscription, one per line, anchored to the line's private plan version, payment method `AGREEMENT`, pointing to the payer through `payer_subscription_id`. Coverage, My account, Tourist VIP and INV:8 keep working because children are PRINCIPALs. Analytics is the exception: a child emits NO billing fact; the agreement's facts come from the payer only (D23). |
| Blocking subscription | A `PRINCIPAL` of the customer in a line's vertical whose status is live (`LIVE_SUBSCRIPTION_STATUSES`, `subscription.dbschema.ts:44-51`: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED`), whatever its payment method; plus a live `COMPLEMENTO` whose add-on targets a line's vertical by SCOPE (its `addon_instance` anchors an `addon_version` with `scope_type` `VERTICAL_SUBSCRIPTION` or `LISTING` whose target is in that vertical; `USER` and `GLOBAL` never block, whatever `subscription.vertical` says, AC-1.7); plus a live tourist PRINCIPAL when a line inherits VIP (D18). Three exclusions, all on `AGREEMENT` children only: at OFFER (and preview), the children of the customer's own agreement whose payer is `CANCEL_SCHEDULED` (AC-1.7, D14); at AUTHORIZE, the children of the version being authorized, that is, children whose `payer_subscription_id` is a live payer of that same `agreement_version` (AC-3.10); at REPLACE (`at: 'OFFER'` with `replacingVersionId`), the children of a live payer of the version being replaced, which the same act abandons (AC-8.15). Nothing else is excluded. |
| Private plan | `plan` with `visibility = 'PRIVATE'`: reusable across customers, never sellable through public checkout, never ranked. |
| Signed link | `signed_action_link` row: a single-use, expiring, hashed token that lets a customer authorize without logging in. Generic, reused by HOS-2196. |

### Binding owner decisions (do not reopen)

| Id | Decision |
|---|---|
| 4a | Private plans are reusable across customers. |
| P | Partner may be card-charged inside an agreement (never through public checkout S1; `PARTNER_MANUAL_ONLY` stays for S1). |
| D1 | Architecture "payer + child PRINCIPALs" (Glossary). |
| D2 | Authorization: primary path is My account ("Agreed plan" card, "Authorize"); secondary path is a signed no-login link copied by staff. Payment is bound to the agreement's customer, never to whoever opens the link. Regenerating invalidates the previous token. The link mechanism is generic for HOS-2196. |
| D5 | Price DECREASE: new version + `changeAmount` on the live preapproval, customer email (M5: MP sends nothing), reconciliation verifies the next charge. |
| D6 | DB billing setting "partner card charging enabled", default OFF, SUPER_ADMIN-only; while OFF the wizard cannot include Partner (server enforced). HOS-2196 reuses it. |
| D8 | Permanent grant and agreement on the same vertical are blocked both ways, with typed errors. |
| D9 | Grace days live on `agreement_version` (default from billing config, editable). They govern the payer; children follow. The private plans' own grace is ignored inside an agreement. |
| D10 | MP cap RP3 (ARS 2.000.000 per charge): wizard and server block a per-charge amount above a configurable cap. |
| V1-a | An agreement can only cover verticals with NO blocking subscription and no live permanent grant. Wizard and server refuse otherwise with a typed error listing the blocking rows. Re-checked at authorization. |
| V1-b | Price increase, cycle change or composition change: staff ends the current agreement and creates a new one (sequencing in D14). |
| D14 | End and recreate (approved 2026-11-15): staff picks the end mode, SCHEDULED (S11 at the end of the paid period, with a coverage gap until the new authorization) or IMMEDIATE (S51 now, no automatic refund, staff compensates by hand). The new agreement may be OFFERED while the old payer is `CANCEL_SCHEDULED`, but it can be authorized only once the old agreement is `ENDED`. |
| D15 | Customer-requested pause on an agreement is refused (`AGREEMENT_PAUSE_NOT_AVAILABLE`), approved 2026-11-15. |
| D16 | The paid-signups freeze (HOS-1749) also blocks agreement authorization (`NEW_PAID_SIGNUPS_FROZEN`), approved 2026-11-15. The offer and its link stay valid; the customer retries once the freeze lifts. |
| D17 | (P4, approved 2026-11-15) Grace days must be shorter than the cycle length in days; wizard and server refuse otherwise. |
| D18 | (P5 + P11, approved 2026-11-15) Any double Tourist VIP payment is blocked at signing: a tourist line next to a VIP-inheriting line (inside or outside the agreement) is refused (AC-1.9), and a live tourist subscription blocks an agreement whose line inherits VIP (AC-1.7). |
| V1-c | First charge declined: the payer follows the normal S16 path to `CHARGE_DECLINED`, propagated to the children. |
| V1-d | Superseded by D19 (courtesy) and D20 (add-ons), same content, now owner-approved. |
| D19 | (P6, approved 2026-11-15) No staff courtesy on an agreement in V1, neither on the payer nor on any child: refused with `AGREEMENT_COURTESY_NOT_AVAILABLE`, and the admin hides the action for those rows. Deferred to HOS-2226. Staff workaround: a price-decrease version (D5). |
| D20 | (P7, approved 2026-11-15) No add-ons on children: purchase refused with `AGREEMENT_ADDONS_NOT_AVAILABLE`; staff puts the benefit in the private plan. P7b: an existing USER- and GLOBAL-scope add-on (P7b, GLOBAL extension approved 2026-11-15) bought through another (non-agreement) title stays alive and keeps charging, but does NOT extend to agreement verticals (only the private plan governs those). No automatic cancel. |
| D21 | (P8, approved 2026-11-15) The public signed-link page shows the customer's TRADE NAME (nombre comercial, never the first name), each line (vertical + private plan name), the amount, the cycle, the link expiry date and the button to MercadoPago. It never shows the email, tax id, staff notes or entitlement detail. A used, expired or regenerated link shows only a generic "this link is no longer valid, ask Hospeda for a new one", with no agreement data. |
| D22 | (P9, approved 2026-11-15) Dedicated email `agreement-link-used` to the account email when a signed link was consumed and the agreement is authorized (activated): date, agreement name, "if you don't recognize this, contact us". It cannot say who paid: MP returns `payer_email` empty on preapproval reads and `declared_payer_email` is never identity. Link consumption is known from `signed_action_link`. Locales es/en/pt. |
| D23 | (P10, revised 2026-11-15) Analytics events of an agreement are always the agreement's own: only the payer emits billing facts, with subscription class `ACUERDO` and `vertical` OMITTED (not null). Children emit NO billing facts at all (no activation, cancel scheduled, cancelled, grace, suspension, recovery, charge credited/rejected). Every payer fact carries two informational properties: `agreement_verticals` (the agreement's line verticals, sorted ascending and comma-joined, e.g. `accommodation,venue`) and `line_count` (integer). Consequence accepted by the owner: agreement verticals do not appear in per-vertical analytics counts; filter by class ACUERDO and `agreement_verticals` contains X. Per-vertical revenue split stays out of scope (V2); a revenue dashboard is a separate follow-up. Detail in "Analytics (D23)". |
| D24 | (approved 2026-11-16) Staff revocation S36 on an agreement payer is allowed and automatically refunds the payer's last credited charge in full (the whole multi-vertical charge), exactly as S36 does for a normal subscription (`revocation-reading.ts:24-43`: the preview shows the payment and `requestsRefund: true`); the preview shows the refund amount before staff confirms. S51 IMMEDIATE stays the no-refund termination (D14). Children are forced terminal as in AC-6.13. Detail in AC-6.16. |
| D25 | (approved 2026-11-16) Every staff act on an agreement payer or its children requires `BILLING_MANAGE_AGREEMENTS` (SUPER_ADMIN only) IN ADDITION to the act's usual permission: S36 revoke with refund (D24), staff S11 and direct cancel through ACC_8, S51 end, realign, abandon/apply, withdraw/replace, link issue/revoke, and any other admin endpoint touching an agreement. An ADMIN without it gets 403, and the admin hides those actions from users without it. Detail in AC-10.3. |
| D26 | (approved 2026-11-16) Once the customer has a live agreement tourist child (pending authorization included), a standalone purchase (S1 checkout, manual start, or a plan change through `startSuccession`) of a plan whose version `inherits_tourist_vip` is refused with 422 and the same reason and spirit as D18 at signing (`AGREEMENT_TOURIST_VIP_REDUNDANT`): the customer would pay twice for Tourist VIP, and `cancelInheritedTouristVips` never cancels an agreement child. Detail in AC-7.10. |

### User Stories & Acceptance Criteria

#### US-1: Staff builds and offers an agreement

**As a** SUPER_ADMIN, **I want** a 4-step wizard (customer, verticals, charging, review),
**so that** I can offer one negotiated price for several verticals.

- **AC-1.1** **Given** a SUPER_ADMIN, a customer with no `OFFERED` agreement, one or more
  lines whose plan versions are current PRIVATE versions of the line's vertical, no blocking
  subscription in any line's vertical, and a per-charge amount between
  `PROVIDER_AMOUNT_FLOOR_MINOR` and the configured cap, **When** the wizard is submitted,
  **Then** one `agreement` (`OFFERED`) and one `agreement_version` (`version_number = 1`,
  `OFFERED`, `change_kind = 'INITIAL'`) with its immutable lines exist, and the act is
  audited as administrative action `ACC_28`.
- **AC-1.2** **Given** an actor without `BILLING_MANAGE_AGREEMENTS`, **When** any
  `/api/v1/admin/billing/agreements*` endpoint is called, **Then** it answers 403
  `FORBIDDEN`, and the admin menu entry Billing -> Agreements is not rendered.
- **AC-1.3** **Given** a per-charge amount above the cap or below the provider floor
  (`PROVIDER_AMOUNT_FLOOR_MINOR`, ARS 15), **When** the amount field loses focus in the
  charging step, **Then** the field shows `admin-billing.agreements.wizard.amountOutOfRange`
  (floor and cap interpolated) and "Next" is disabled; **and When** the same payload reaches
  the server, **Then** 422 `VALIDATION_ERROR`, `reason: 'AGREEMENT_AMOUNT_OUT_OF_RANGE'` (the
  top-level `error.reason`, as every `reason` in this spec, "API Design").
- **AC-1.4** **Given** customer C with agreement A1 in `OFFERED`, **When** a SUPER_ADMIN
  submits a new agreement for C, **Then** the API answers 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_ALREADY_OFFERED'`, `details.existingAgreementId = A1`, and C's
  `agreement` and `agreement_version` row counts are unchanged. **Given** C with no `OFFERED`
  agreement and agreement A2 in `ACTIVE` whose payer is `ACTIVE`, `GRACE_PERIOD` or
  `SUSPENDED`, **When** a new agreement is submitted, **Then** 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_ALREADY_LIVE'`, `details.existingAgreementId = A2`, nothing written.
  **Given** A2's payer is `CANCEL_SCHEDULED`, **Then** the submission succeeds with 201 (AC-8.7,
  D14). **Given** two concurrent submissions for C that both pass the service check, **Then**
  exactly one is 201 and the other hits `uq_agreement_one_offered_per_customer` and answers the
  same 409 `AGREEMENT_ALREADY_OFFERED` (never 500).
- **AC-1.5** **Given** a vertical where the customer holds a live permanent grant, **When** a
  line for that vertical is submitted, **Then** 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT'`, `details.blocking` listing each grant as
  an `AgreementBlockingRowSchema` row with `kind: 'PERMANENT_GRANT'` (the one row shape, "API
  Design").
- **AC-1.6** **Given** `billing.partnerCardCharging.enabled = false`, **When** the wizard
  renders, **Then** Partner is not selectable; **and When** a Partner line is submitted
  anyway, **Then** 422 `VALIDATION_ERROR`, `reason: 'AGREEMENT_PARTNER_CARD_CHARGING_DISABLED'`.
- **AC-1.7** (offer-time exclusion: children of the customer's OWN agreement whose payer is
  `CANCEL_SCHEDULED` are not blocking at offer or preview, so the end-and-recreate sequence of
  D14 can re-offer the same verticals; authorize still refuses until that agreement is
  `ENDED`, AC-3.9. Authorize-time exclusion: the children of the version being authorized,
  created by an earlier press, are never blocking, AC-3.10.) **Given** a customer with a blocking subscription in a chosen vertical, **When**
  the verticals step loads, previewed or submitted, **Then** that vertical is disabled with
  the reason, and the server answers 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION'`,
  `details.blocking` listing every blocking row as an `AgreementBlockingRowSchema` row
  (`{ kind: 'SUBSCRIPTION', id, vertical, status, paymentMethod }`, "API Design"). A live tourist PRINCIPAL is also blocking when any line's plan version has
  `inherits_tourist_vip = true` (D18). A live `COMPLEMENTO` (add-on) of the customer is
  blocking by its add-on SCOPE, never by `subscription.vertical`: every `COMPLEMENTO` row
  carries the vertical of the title it was bought through, even for a USER-scope add-on
  (`purchase-addon-complement.ts:41`), so that column says nothing about what the add-on
  targets. The `COMPLEMENTO` blocks when its `addon_instance`
  (`complement_subscription_id` = the row, `addon-product.dbschema.ts:114`) anchors an
  `addon_version` (`addon_instance.addon_version_id`, `:98`) whose `scope_type`
  (`addon-catalog.dbschema.ts:71`, values `ADDON_SCOPE_TYPES`, `:27`) is
  `VERTICAL_SUBSCRIPTION` with a target subscription (`addon_instance.target_id`,
  `addon-product.dbschema.ts:106`) in a line's vertical, or `LISTING` with a target listing
  of a line's vertical (the same resolution as `placementOf`, `addon-sources.ts:106-119`), so
  no vertical add-on survives into an agreement (D20). A live `USER`- or `GLOBAL`-scope
  add-on is NEVER blocking, whatever vertical its `COMPLEMENTO` row carries (D20 P7b keeps it
  alive without extending it to agreement verticals). `details.blocking` lists such a row
  with the `COMPLEMENTO`'s id as `id` and the line `vertical` it targets.
- **AC-1.8** **Given** the charging step, **When** it opens, **Then** grace days default to
  `billing.agreementDefaults.defaultGraceDays`; **and When** grace days are not lower than the
  cycle length in days, **Then** 422 `reason: 'AGREEMENT_GRACE_NOT_BELOW_CYCLE'` (D17). The
  cycle length is the shortest possible cycle, `AGREEMENT_CYCLE_MIN_DAYS` (monthly 28, annual
  365; see "Settings"): grace days must be at most 27 for a monthly agreement and at most 364
  for an annual one; 28 (monthly) and 365 (annual) are refused.
- **AC-1.9** **Given** a tourist line and any other line whose plan version has
  `inherits_tourist_vip = true`, **When** submitted, **Then** 422
  `reason: 'AGREEMENT_TOURIST_VIP_REDUNDANT'`. **Also given** a tourist line and a live
  PRINCIPAL outside the agreement whose plan version has `inherits_tourist_vip = true`,
  **When** previewed, submitted or authorized, **Then** the same 422 with
  `details.inheritingSubscriptionId` (the customer would pay for VIP it already gets, and the
  VIP sweep would target the tourist child) (D18).

#### US-2: Staff defines reusable private plans

**As a** SUPER_ADMIN, **I want** to create a private plan "based on plan X" and edit its
keys, **so that** the agreement grants exactly what was negotiated and I can reuse it.

- **AC-2.1** **Given** a base plan version, **When** a private plan is created from it,
  **Then** a `plan` with `visibility = 'PRIVATE'`, `role = NULL` and one `plan_version`
  (`current`, `sellable`, `visibility = 'PRIVATE'`) exist, with the base entitlements and
  limits copied and the edits applied, and no `billing_option` row. Every column follows the
  "Private plan fields" table (copied, editable or fixed).
- **AC-2.2** **Given** a PRIVATE current sellable version, **When** the public catalog, the
  trial ratchet, the Tourist VIP pick, subscribe-destination, trial start, plan migration
  options, cycle price and partner setup list sellable versions, **Then** it never appears;
  **and When** `findPlanVersion({ id })` reads it by id, **Then** it IS returned.
- **AC-2.3** **Given** any plan, **When** an `UPDATE` changes `plan.visibility` or
  `plan_version.visibility`, **Then** the database raises.
- **AC-2.4** **Given** a private plan version used by customer A's agreement, **When** staff
  builds customer B's agreement, **Then** the same version can be chosen.
- **AC-2.5** **Given** a PRIVATE plan version, **When** a `billing_option` is inserted for
  it, **Then** the database raises.
- **AC-2.6** **Given** a PRIVATE plan and a PUBLIC plan of the same vertical with the same
  `rank`, both current and sellable, **Then** no unique violation.
- **AC-2.7** **Given** a base version with `trial_days = 10`, `allows_pause = true` and a
  metered entitlement with `trial_quota = 3`, **When** a private plan is created from it,
  **Then** the private version stores `trial_days = 0`, `allows_pause = false` (D15), the
  base's `grace_days` (ignored inside an agreement, D9), `rank = 0`, and the metered
  entitlement with its edited `plan_quota` and `trial_quota = 0`; a request that sends a
  different `trialDays`, `allowsPause`, `graceDays`, `rank` or `trialQuota` is rejected with
  400 (closed request schema, the fields do not exist in it).
- **AC-2.8** **Given** a private plan P whose current version V1 anchors a live child, **When**
  staff publishes a new version through `POST /private-plans/:planId/versions`, **Then** in one
  transaction V1 gets `current = false` and the new V2 is inserted `current = true`; the child
  keeps its anchor to V1; an `OFFERED` agreement version whose line names V1 stays
  authorizable; new offers can only pick V2 (`AGREEMENT_LINE_NOT_CURRENT` for V1).
- **AC-2.9** **Given** a plan with slug `hotel-group-a` in vertical `accommodation`, **When** a
  private plan with the same slug is created in that vertical, **Then** 409 `ALREADY_EXISTS`,
  `reason: 'PRIVATE_PLAN_SLUG_TAKEN'`, nothing written; the same slug in another vertical
  succeeds. **Given** `POST /private-plans/:planId/versions` on a PUBLIC plan, **Then** 404
  `NOT_FOUND` (ACC_28 never writes a public plan).
- **AC-2.10** (seventh review minor 5, concurrent publish) **Given** two staff
  `POST /private-plans/:planId/versions` calls on the same plan at once, **Then** the `plan` row
  lock serializes them: both answer 201 and exactly one version of the plan is `current`; a 23505
  on `uq_plan_version_one_current_per_plan` (unreachable under the lock) answers 409
  `reason: 'PRIVATE_PLAN_CONCURRENT_PUBLISH'`, never 500. Rule: "Versioning" under "Private plan
  fields".

#### US-3: Customer authorizes from My account

- **AC-3.1** **Given** an `OFFERED` version, **When** the customer opens
  `/{lang}/mi-cuenta/suscripcion/`, **Then** an "Agreed plan" card shows the verticals with
  their plan names, price, cycle and an "Authorize" button.
- **AC-3.2** **Given** that card, **When** "Authorize" is pressed, **Then** one payer
  (`ACUERDO`, `CARD`, `PENDING_AUTHORIZATION`) and one child per line (`PRINCIPAL`,
  `AGREEMENT`, `PENDING_AUTHORIZATION`, `succeeds_id` NULL, authorization window NULL) are
  committed together, a preapproval is created with `amount = version amount`,
  `everyMonths = 1 | 12`, reference = payer id, no `start_date` and no `free_trial`, and the
  browser is redirected to the checkout.
- **AC-3.3** **Given** two concurrent or repeated presses (either path), **Then** exactly one
  payer and one preapproval exist for the version, never two. **While** the first press's
  creation is in flight (its `PREAPPROVAL_CREATE` key is open during the provider call, step 6),
  the other press answers 409 `ALREADY_EXISTS`, `reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS'` (the
  open-key rule S1 applies, `resolve-live-commitment.ts:169`); **once** the first creation
  completed, a later press reuses the payer and returns the same checkout URL (`reused: true`).
  **Client rule (the single definition; the card and the link page both apply it):** on a 409
  `PREVIOUS_ATTEMPT_IN_PROGRESS` or `PREVIOUS_ATTEMPT_CLOSING` (AC-5.6) the island retries the
  same authorize call once after about 2 seconds; if that answers the same 409, it shows the
  "processing" state (`billing.agreements.processing.title`, the reason's line
  `billing.agreements.errors.<reason>` and a `billing.agreements.processing.retry` button that
  repeats the call), never the "blocked" state.
- **AC-3.4** **Given** a version that is no longer `OFFERED` (or any `DECREASE` version),
  **When** authorize is called with it, **Then** 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_VERSION_NOT_OFFERED'`, `details.offeredVersionId` (or `null`).
- **AC-3.5** **Given** the paid-signups freeze is on, **When** authorize is called, **Then**
  409 `NEW_PAID_SIGNUPS_FROZEN`, and the version and link stay valid for a later retry (D16).
- **AC-3.6** **Given** an agreement of another customer, **When** authorize is called,
  **Then** 404 `NOT_FOUND`.
- **AC-3.7** **Given** the customer acquired a blocking subscription (or a permanent grant)
  after the offer, **When** authorize is called on either path, **Then** 409
  `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION` (or `_HAS_PERMANENT_GRANT`) with the blocking
  list, and nothing is written.
- **AC-3.8** **Given** an agreement that is `ENDED` or `WITHDRAWN`, **When** authorize is
  called, **Then** 409 `reason: 'AGREEMENT_NOT_LIVE'`.
- **AC-3.9** **Given** the customer has another agreement whose status is not `ENDED` or
  `WITHDRAWN` (for example an `ACTIVE` one whose payer is `CANCEL_SCHEDULED`), **When**
  authorize is called on either path, **Then** 409 `reason: 'AGREEMENT_PREVIOUS_NOT_ENDED'`,
  `details.previousAgreementId`, and nothing is written, even when the verticals do not
  overlap (D14; without it AG2 would hit `uq_agreement_one_active_per_customer` at activation
  while the provider already charges).
- **AC-3.10** (B1) **Given** an `OFFERED` version whose first "Authorize" press already
  committed its payer and children (`PENDING_AUTHORIZATION`, live statuses), and no other
  blocking subscription, **When** "Authorize" is pressed again on either path (double click,
  second tab, link after My account), **Then** `findAgreementBlockers({ at: 'AUTHORIZE' })`
  does not count those children and step 4 resolves the payer: the same checkout URL once the
  first creation completed, 409 `PREVIOUS_ATTEMPT_IN_PROGRESS` while it is in flight (AC-3.3,
  AC-4.5); a re-mint after a rejected creation and a
  `CREATION_NOT_APPLIED` replacement are reached the same way. **Given** the same pending
  payer, a line whose plan version has `inherits_tourist_vip = true` and no tourist line, plus
  a genuine blocker that appeared after the first press (a live tourist PRINCIPAL of the
  customer, D18; a live PRINCIPAL in a LINE vertical cannot be the fixture, because the pending
  child already occupies `uq_subscription_commitment_origin` for that `(user, vertical)`,
  `subscription.dbschema.ts:183-187`), **Then** 409 `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION`
  listing only that tourist row (never this version's own children), and nothing is written.
- **AC-3.11** **Given** customer C with agreement A1 `ACTIVE` whose payer is `CANCEL_SCHEDULED`
  and agreement A2 `OFFERED`, **When** `GET /api/v1/protected/billing/agreements/mine` is
  called, **Then** the response parses against `AgreementsMineResponseSchema` with two entries:
  A1 (`status: 'ACTIVE'`, payer `CANCEL_SCHEDULED` with its `serviceEndsAt`, `authorize: null`)
  and A2 (`status: 'OFFERED'`, `authorize: { allowed: false, reason:
  'AGREEMENT_PREVIOUS_NOT_ENDED', previousAgreementId: A1 }`); the card renders A2's
  "Authorize" disabled with the A1 end date. After A1 is `ENDED`, A1 is no longer listed and
  A2 carries `authorize: { allowed: true }`.
- **AC-3.12** **Given** an `OFFERED` version and, after the offer, `maxChargeMinor` lowered below
  its amount, or `billing.partnerCardCharging.enabled` turned off while it has a Partner line,
  or a live PRINCIPAL outside the agreement whose plan inherits Tourist VIP next to its tourist
  line, **When** authorize is called on either path, **Then** 422 `VALIDATION_ERROR` with
  `reason` `AGREEMENT_AMOUNT_OUT_OF_RANGE`, `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED` or
  `AGREEMENT_TOURIST_VIP_REDUNDANT` respectively, nothing written and no link consumed; the
  offer stays `OFFERED` (staff withdraws or replaces it).
- **AC-3.13** **Given** any authorization of an `ACUERDO` payer (My account, signed link, or a
  creations-sweep recreation), **When** the preapproval is created, **Then** its `back_url` is
  `${HOSPEDA_SITE_URL}/{lang}/acuerdo/resultado/` with no query parameter, where `{lang}` is
  the link's `locale` on the LINK path and the customer's account locale on the SESSION and
  sweep paths (`es` when absent or unsupported); it never points to
  `/es/mi-cuenta/suscripcion/?subscription=`.
- **AC-3.14** (minor 8) **Given** a customer with a live payer, its children and a paying
  non-agreement PRINCIPAL in another vertical, **When** the existing own-subscriptions read
  (`read-own-subscriptions.ts`, `OwnSubscriptionsResponseSchema`) runs, **Then** it returns
  only the non-agreement PRINCIPAL: neither the payer (class `ACUERDO`) nor any child
  (`payment_method = 'AGREEMENT'`) appears in the generic list rendered by
  `MySubscriptions.astro`, the response still parses against the UNCHANGED schema
  (`paymentMethod: z.enum(['CARD', 'MANUAL'])`), and the payer and children are shown only
  inside the "Agreed plan" card fed by `GET .../agreements/mine`.
- **AC-3.15** (seventh review M2, dry run) **Given** an `OFFERED` agreement and a customer whose
  earlier attempt is `CHARGE_DECLINED` with its preapproval already `cancelled` (a historical row
  `findDeclinedWithProviderLinks` keeps returning), **When** `GET .../agreements/mine` or
  `POST /resolve` runs, **Then** the entry carries `authorize: { allowed: true }` and resolve
  answers `state: 'AUTHORIZABLE'`, with zero provider calls; neither ever answers
  `PREVIOUS_ATTEMPT_CLOSING`, which only the real authorize returns. Rule: "Authorize dry run"
  under "Authorization flow".
- **AC-3.16** (seventh review minor 10) **Given** an `ACTIVE` agreement whose `DECREASE` version
  is `APPLYING`, **When** `GET .../agreements/mine` is called, **Then** `version` is the `ACTIVE`
  version (the amount still charged) and `pendingVersion` is `{ amountMinor: <APPLYING amount>,
  status: 'APPLYING' }`; with no `APPLYING` version, and for every `OFFERED` entry,
  `pendingVersion` is `null`.

#### US-4: Customer authorizes from a signed link (no login)

- **AC-4.1** **Given** an `OFFERED` version, **When** staff generates a link, **Then** the
  response carries the full URL exactly once, the DB stores only the SHA-256 hash of the
  token, and `expires_at = now + billing.agreementDefaults.linkExpiryDays` (default 14). The
  URL is `/{lang}/acuerdo/#t=<token>` where `{lang}` is the `locale` staff picked when
  generating it (default: the customer's account locale, `es` when absent), stored in
  `signed_action_link.locale`.
- **AC-4.2** **Given** a valid link, **When** it is opened, **Then** the page shows exactly
  the customer's trade name (`agreement.trade_name`), one row per line (vertical + private plan
  name), the amount, the cycle, the link expiry date and "Authorize" (which leads to
  MercadoPago), and the `POST /resolve` response carries no email, tax id, `internal_notes` or
  entitlement/limit detail (D21); pressing "Authorize" creates the payer for the LINK's
  customer, whatever session the browser has (or none).
- **AC-4.3** **Given** a regenerated link, **When** the old token is used, **Then** 410
  `GONE`, `reason: 'AGREEMENT_LINK_NO_LONGER_VALID'`, `details.cause: 'REPLACED'`.
- **AC-4.4** **Given** an expired link **Then** 410 with `cause: 'EXPIRED'`; **given** an
  unknown token **Then** 404 `NOT_FOUND`.
- **AC-4.5** **Given** a link whose payer is still `PENDING_AUTHORIZATION`, **When** it is
  authorized again (from any browser, with any payer email), **Then** the same checkout URL
  is returned (no new preapproval, M3). The PUBLIC authorize response carries nothing about the
  email (no `declaredPayerEmailMasked`, no declared or provider email; D21: the public page
  never shows the email), and the page shows only "Continue to MercadoPago"; the masked
  declared email (`declaredPayerEmailMasked`, for example `j***@g***.com`, or `null` when none
  was declared) exists only in PROTECTED responses (the authorize response and the `payer` of
  `GET .../agreements/mine`, so the My account card still shows it after a reload);
  **given** that payer became `ABANDONED` or `CHARGE_DECLINED` and no other live payer of the
  version exists, **Then** 410 with `cause: 'USED'`. A consumed link resolves to the live payer
  of its version (`uq_subscription_live_payer_per_version`), not to `consumed_subscription_id`
  (which records the payer the link LAST created, reused or replaced through, and serves only
  the AC-4.8 email decision, "`signed_action_link`" notes); this keeps the link working after a
  `CREATION_NOT_APPLIED` replacement made from My account. Only a payer in `PENDING_AUTHORIZATION` on a version
  still `OFFERED` returns the checkout; a payer in any other live state answers 410 `USED`
  (AC-4.14).
- **AC-4.6** **Given** the link page, **Then** it reads no session (session-blind guard
  green), the token travels only in the URL fragment and in a POST body, API responses carry
  `Cache-Control: no-store`, and no log line contains the token.
- **AC-4.7** **Given** a version that becomes `SUPERSEDED`, `WITHDRAWN`, `ENDED` or `ACTIVE`
  through another path, **Then** its open link is revoked (`VERSION_CLOSED`) and answers 410
  with `cause: 'VERSION_CLOSED'`; a CONSUMED link of a version that activates is revoked with
  `ACTIVATED` and answers 410 `cause: 'USED'` (AC-4.15). Every answer follows the precedence of
  AC-4.14.
- **AC-4.8** **Given** a version with a consumed `signed_action_link`
  (`consumed_at IS NOT NULL`, purpose `AGREEMENT_AUTHORIZATION`), **When** the payer that
  link created (`consumed_subscription_id` = the activated payer's id) is activated (AC-5.1),
  **Then** in the activation transaction exactly one `agreement-link-used`
  email is enqueued to the customer's ACCOUNT email (dedupe key = version id), in the
  customer's locale (es/en/pt), stating the authorization date, the agreement name
  (`agreement.trade_name`) and "if you don't recognize this, contact us"; it contains no payer
  email, no token and no statement of who paid (D22). **Given** a version authorized only from
  My account (no consumed link), **Then** no `agreement-link-used` email is enqueued. **Given**
  a link consumed but the payer never activates (`ABANDONED`, `CHARGE_DECLINED` while pending),
  **Then** no `agreement-link-used` email is enqueued. **Given** link L consumed by payer P1
  and a `CREATION_NOT_APPLIED` replacement P2 (AC-4.5) made through a LINK authorize with L,
  **Then** L's `consumed_subscription_id` becomes P2 in the replacement transaction and P2's
  activation enqueues the email (the link drove the payment). **Given** the same replacement,
  or a new payer after P1 was abandoned, made from My account (SESSION) with no later LINK
  authorize, **Then** L keeps `consumed_subscription_id = P1` and the activation of that
  DIFFERENT payer enqueues no `agreement-link-used` email. **Given** L is then used for a LINK
  authorize while that different payer is still pending (AC-4.14 row 8, step 4 reuse), **Then** L
  records it ("Which payer a link records") and its activation enqueues the email.
- **AC-4.9** **Given** a `DECREASE` version, **When** a link is requested for it, **Then**
  409 `reason: 'AGREEMENT_VERSION_NOT_OFFERED'`.
- **AC-4.10** **Given** a link that answers 410 (any `cause`) or 404, **When** the page
  resolves it, **Then** it renders only the generic "this link is no longer valid, ask Hospeda
  for a new one" (`billing.agreements.link.noLongerValid`) with no trade name, line, amount or
  date, and the error body carries only `code`, `reason` and `details.cause` (D21).
- **AC-4.11** (M1, D2) **Given** link L1 consumed by payer P (still `PENDING_AUTHORIZATION`),
  **When** staff regenerates the link (L2), **Then** L1 gets `revoked_at` with
  `revoke_reason = 'REGENERATED'`, and `POST /resolve` and `POST /authorize` with L1 answer 410
  `cause: 'REPLACED'` (the revocation check runs BEFORE the AC-4.5 "consumed link keeps
  returning the checkout" rule); P and its checkout are untouched, and L2 resolves and, when
  authorized, reuses P's checkout URL (step 4) and is consumed with
  `consumed_subscription_id = P` (the reuse rule of the "`signed_action_link`" notes).
- **AC-4.12** **Given** a valid link, **When** `POST /resolve` is called, **Then** the response
  parses against the closed `AgreementLinkResolveResponseSchema` and `state` is exactly one of
  `AUTHORIZABLE` (no live payer, nothing blocks), `CHECKOUT_PENDING` (a payer of the version is
  `PENDING_AUTHORIZATION` and the version is `OFFERED`; "Authorize" returns its checkout URL)
  or `BLOCKED` (the authorize dry run refuses, "Authorize dry run" under "Authorization flow"),
  chosen by the precedence of AC-4.14 (`BLOCKED` wins over
  `CHECKOUT_PENDING`, because authorize runs steps 2 and 3 before the step 4 reuse), the
  `BLOCKED` one with a closed `blockedReason` and no blocking rows, subscription ids or
  verticals beyond the lines; the page renders "blocked" only from this `state`. A refusal that
  appears between resolve and the press is answered by `POST /authorize` with its 409/422: a
  `blockedReason` value switches the page to "blocked" with the same copy;
  `PREVIOUS_ATTEMPT_IN_PROGRESS` and `PREVIOUS_ATTEMPT_CLOSING` follow the client rule of AC-3.3
  ("processing"); `COMMITMENT_TAKEN` (step 4, a pending payer past its window) shows
  `billing.agreements.errors.COMMITMENT_TAKEN`.
- **AC-4.13** **Given** the public endpoints, **When** one IP sends an 11th `POST /resolve`
  within a minute, or a 6th `POST /authorize` with the same token within a minute, **Then**
  429 `RATE_LIMIT_EXCEEDED` with `Retry-After`; the rate-limit store holds only the SHA-256 of
  the token, never the token. **Given** a `POST /authorize` body that fails the closed body
  schema, **Then** 400 `VALIDATION_ERROR` from body validation, which runs after the per-IP
  limiter and before the per-token limiter (the keyed limiter reads the validated token).
- **AC-4.14** (M1, precedence) **Given** any token, **When** `POST /resolve` or the public
  `POST /authorize` evaluates it, **Then** exactly the FIRST matching row of this total order
  answers, and both endpoints use the same order (authorize then continues to the real checks
  where resolve answers a `state`):
  1. unknown `token_hash` -> 404 `NOT_FOUND`;
  2. `revoked_at IS NOT NULL` -> 410, `cause` from `revoke_reason`: `REGENERATED` ->
     `REPLACED`, `STAFF_REVOKED` -> `REVOKED`, `VERSION_CLOSED` -> `VERSION_CLOSED`,
     `ACTIVATED` -> `USED`;
  3. `expires_at <= now` -> 410 `EXPIRED`;
  4. consumed link and a live payer of the version in a NON-pending live state (`ACTIVE`,
     `GRACE_PERIOD`, `SUSPENDED`, `CANCEL_SCHEDULED`; `PAUSED` is unreachable in V1) -> 410
     `USED`;
  5. the version is not `OFFERED` or the agreement is not `OFFERED` -> 410 `VERSION_CLOSED`;
  6. consumed link and no live payer of the version -> 410 `USED`;
  7. the authorize dry run refuses ("Authorization flow") -> `state: 'BLOCKED'` (resolve) /
     the real 409/422 (authorize);
  8. a live payer of the version in `PENDING_AUTHORIZATION` (the version is `OFFERED` by row 5)
     -> `state: 'CHECKOUT_PENDING'` (resolve) / step 4 reuse (authorize);
  9. otherwise -> `state: 'AUTHORIZABLE'` (resolve) / step 5 (authorize).
  Rows 4 to 6 are defence in depth: on every reachable path the revocations of AC-4.7, AC-4.15
  and AC-4.16 already answer at row 2.
- **AC-4.15** (M1) **Given** a version with a consumed link L (its payer pending) and an open
  link L2, **When** the payer activates (AC-5.1), **Then** in the activation transaction L
  gets `revoke_reason = 'ACTIVATED'` and L2 gets `VERSION_CLOSED`; afterwards L answers 410
  `USED` and L2 410 `VERSION_CLOSED` on both public endpoints, and neither ever returns a
  checkout URL again. The AC-4.8 email decision reads `consumed_subscription_id`, which the
  revocation does not change. (Defence in depth: `issue` revokes every non-revoked link of the
  version, so an open and a consumed link never coexist through the API; the test SEEDS both
  rows directly. The same fixture serves AC-4.16.)
- **AC-4.16** (minor 4) **Given** a version with an open link and a consumed link (its payer
  pending; the seeded fixture of AC-4.15), **When** staff calls `DELETE /:id/payment-link`, **Then** BOTH get `revoked_at`
  with `revoke_reason = 'STAFF_REVOKED'` and answer 410 `REVOKED`; the pending payer and its
  checkout are untouched (My account can still continue to MercadoPago), as with a regenerate
  (AC-4.11). **Given** no non-revoked link, **Then** 204 and nothing written.
- **AC-4.17** (M2, dead token never reaches the provider) **Given** a token that matches any of
  AC-4.14 rows 1 to 6 (unknown, revoked, expired, consumed with a non-pending live payer,
  version or agreement not `OFFERED`, consumed with no live payer) and a declined payer of the
  customer whose preapproval is still live (the AC-5.6 fixture), **When** the public
  `POST /authorize` is called, **Then** it answers that row's 404/410, never 409
  `PREVIOUS_ATTEMPT_CLOSING`, `AGREEMENT_VERSION_NOT_OFFERED` or `AGREEMENT_NOT_LIVE`, and the
  fake records no preapproval read and no cancel, and no before-cancel notice is enqueued (the
  LINK pre-pass of "Authorization flow" runs before step 2b).
- **AC-4.18** (fifth review minor 6, payer email) **Given** the link page in the valid state,
  **Then** it shows an optional "email you'll pay with" field and nothing else about emails;
  **When** it is left blank, **Then** the public authorize body omits `payerEmail` and the payer
  is inserted with `declared_payer_email` NULL; **When** it holds `Juan@Mail.com `, **Then** the
  payer stores `juan@mail.com`; **When** it holds a malformed value, **Then** the field shows
  `billing.agreements.link.payerEmail.invalid` and the server answers 400 `VALIDATION_ERROR`; in
  no case does a public response or the page show the email back (D21). **Given** the My account
  card, **Then** it has no email field and the protected authorize body has no `payerEmail` key
  (400 if sent). Rule: "Payer email" under "Authorization flow".
- **AC-4.19** (sixth review minor 7, concurrent link issue) **Given** two staff `POST
  /:id/payment-link` calls on the same `OFFERED` version at once, **Then** the version lock
  serializes them: both answer 201, the first link is revoked `REGENERATED` and exactly one open
  link remains; **given** the version stopped being `OFFERED` before the second takes its lock,
  **Then** that call answers 409 `AGREEMENT_VERSION_NOT_OFFERED`; a 23505 on
  `uq_signed_action_link_open_agreement_version` (unreachable under the lock) answers 409
  `reason: 'AGREEMENT_LINK_CONCURRENT_ISSUE'`, never 500. Rule: "Signed link mechanism".

#### US-5: Activation and the first charge

- **AC-5.1** **Given** a pending payer, **When** the provider authorizes it through ANY of
  the three activation sites (notice, by-id read, or `activatePendingRow` from S3 or from the
  credited-pending sweep), **Then** one funnel dispatches the `ACUERDO` row to
  `activateAgreementPayer` and in ONE transaction the payer becomes `ACTIVE`, every child
  becomes `ACTIVE` (S41), the version and the agreement become `ACTIVE`, every non-revoked
  link of the version is revoked (open ones `VERSION_CLOSED`, consumed ones `ACTIVATED`,
  AC-4.15), and the agreement-confirmed notice is enqueued, plus
  `agreement-link-used` when the activated payer is the one a consumed link records (AC-4.8,
  D22). (The link that
  created the payer was already consumed at authorize, flow step 5.) All of it happens only when
  the payer is still `PENDING_AUTHORIZATION` under the locks (AC-5.7).
- **AC-5.2** **Given** the payer's authorization window expires, **Then** the payer and all
  children become `ABANDONED` (S42), the agreement stays `OFFERED`, a link CONSUMED by that
  attempt answers 410 `USED` (AC-4.14 row 6), and an open, never-consumed link of the version
  stays usable (row 9, `AUTHORIZABLE`).
- **AC-5.3** **Given** a first charge is declined (payer `PENDING_AUTHORIZATION`, or `ACTIVE`
  with no credited payment), **Then** S16 moves the payer to `CHARGE_DECLINED` and the
  children follow (S43); a coverage loss per child vertical is recorded only when the payer
  was `ACTIVE` (from `PENDING_AUTHORIZATION` there was never coverage, matching
  `decline-first-charge.service.ts:242`); an agreement that had activated becomes `ENDED`
  (`FIRST_CHARGE_DECLINED`), one still `OFFERED` stays `OFFERED`.
- **AC-5.4** **Given** the payer's first payment is credited, **Then** one
  `CoverageChangedEvent` per child vertical is emitted (their `charged` flips to true) and a
  trial in a child vertical converts through the existing listener.
- **AC-5.5** **Given** a payer still `PENDING_AUTHORIZATION` under the activation locks (AC-5.7)
  whose version is no longer `OFFERED` or whose agreement
  is no longer `OFFERED` (a defect or a race that slipped past AC-8.4/AC-8.5), **When** any of
  the three activation sites sees the provider authorize it, **Then** `activateAgreementPayer`
  does not activate: it cancels the preapproval at the provider, moves the payer to
  `ABANDONED` with the children (S42), opens the reconciliation mark
  `ACTIVACION_SOBRE_VERSION_CERRADA` (MOT:26, subject = the payer) with a Sentry alert, and
  returns a terminal outcome so no activation site retries it. Every payment already credited
  to the payer is hung on that mark (one S14 call per payment, `payment: { source: 'PAYMENT',
  id }`); the catalog entry carries `refundConfirmation: true` and `defaultProposal: 'REFUND'`,
  so the reconciliation panel proposes the refund and the mark cannot be lifted (S15) while a
  hung payment is unresolved; staff executes the refund from the mark with the existing refund
  flow, which resolves the hung payment. With no credited payment the mark holds no payment
  and staff lifts it after checking the provider.
- **AC-5.6** (M2, deferred cancel of a declined payer) **Given** an `OFFERED` agreement whose
  payer P1 went `CHARGE_DECLINED` while pending (S16) with its provider cancel `DEFERRED`
  (`decline-first-charge.service.ts:142-143`: the before-cancel notice was `NOT_YET_SENT`, so
  P1's preapproval is still live at MercadoPago), **When** the customer authorizes the same
  version again from My account or through a link that was never consumed (a regenerated one; the
  link consumed by P1 answers 410 `USED` first, AC-4.14 row 6, AC-4.17), **Then** authorize step 2b reads P1's preapproval: while it is
  not `cancelled` it sends the before-cancel notice and the cancel exactly as
  `closeDeclinedAttempts` does and answers 409 `ALREADY_EXISTS`,
  `reason: 'PREVIOUS_ATTEMPT_CLOSING'`, with no payer, child, key or link written and no new
  preapproval; **once** the read shows `cancelled`, the same call proceeds and creates P2. At no
  instant do P1 and P2 both hold a live preapproval. The same applies to a declined payer of
  ANOTHER agreement of the customer and to a declined standalone PRINCIPAL in a line vertical.
  **Given** a standalone PRINCIPAL in a line vertical that is live when step 2b runs and becomes
  `CHARGE_DECLINED` (cancel deferred) before step 3 reads the blockers, **Then** the declined
  re-read of step 3 finds it and the call answers 409 `PREVIOUS_ATTEMPT_CLOSING` with nothing
  written ("Authorization flow" step 3); the client retry (AC-3.3) reaches step 2b, which cancels it.
- **AC-5.7** (fifth review B1, activation of a payer that is no longer pending) **Given** a payer
  that two activation sites see authorized seconds apart (for example the notice and the
  credited-pending sweep), **When** both call the funnel, **Then** exactly one activation commits
  (AC-5.1) and the second, finding the payer `ACTIVE` under the locks, returns
  `{ activated: false, terminal: true }` with no write, no provider call and no mark: zero
  cancels, zero MOT:26, the version and agreement stay `ACTIVE`. **Given** a payer already
  `ABANDONED` (or `CHARGE_DECLINED`) whose version is still `OFFERED`, **When** an activation site
  sees its preapproval authorized, **Then** the same no-op: no AV3, no AG2, no propagation, no link
  revocation, no email and no fact (a live preapproval on that closed row stays H-7's case). Rule:
  "Activation funnel".
- **AC-5.8** (sixth review minor 9, charge on an abandoned payer) **Given** a payer `ABANDONED` by
  withdraw or replace (S40 variant) or by a `CREATION_NOT_APPLIED` replacement (S39 variant) whose
  provider cancel failed, **When** the provider charges it and the charge is credited, **Then**
  the post-credit crossing settlement (`settleChargeAcrossCancellation`, called at
  `record-charge-fact.service.ts:288`) hangs the payment on `COBRO_POSTERIOR_A_LA_BAJA` (MOT:2,
  subject = the payer; `refundConfirmation: true`, `defaultProposal: 'REFUND'`,
  `reconciliation-mark-reasons.ts:56`), whatever cancellation decision the payer carries; staff
  refunds it from the mark with the existing refund flow (as AC-5.5), and the mark cannot be lifted
  while the payment is unresolved. The same charge, if it is never credited, already gets MOT:2 from
  the sweep (`unregistered-charge-reason.ts:33-35`). Rule: "Class gates that must admit the payer".
- **AC-5.9** (seventh review M1, charge after an IMMEDIATE end) **Given** a payer `CANCELLED` by
  S51 whose post-commit provider cancel failed, and a new agreement of the customer authorized
  meanwhile, **When** the old preapproval charges and the charge is credited, **Then** the payment
  is credited to the OLD payer (its covered period is written on that payer, as for any credited
  charge), `classifyCancellationCrossing` answers `MARK` for the S51 decision and the payment hangs
  on `COBRO_POSTERIOR_A_LA_BAJA` (MOT:2, subject = the old payer) for a staff refund, as AC-5.8;
  the old children stay `CANCELLED`, gain no coverage and emit no `CoverageChangedEvent`, and the
  new agreement's payer and children are untouched. Rule: "Class gates that must admit the payer".

#### US-6: Lifecycle of the children follows the payer

- **AC-6.1** **When** the payer enters grace (S4), **Then** every child enters
  `GRACE_PERIOD` with the payer's grace clock (S44), with
  `grace_ends_at = grace_started_at + agreement_version.grace_days`; **when** the payer exits
  grace (S5), **then** children return to `ACTIVE` (S45).
- **AC-6.2** **When** the payer is suspended (S6 arrears, provider pause arrears, chargeback),
  **Then** children become `SUSPENDED` (S46) with a coverage loss per child vertical;
  **when** S7 reactivates it to `ACTIVE` or to `CANCEL_SCHEDULED`, **then** children move to
  the SAME target state with the same `service_ends_at` (S47).
- **AC-6.3** **When** the payer's service ends (S12 or S12 chargeback), the provider cancels,
  the payer is cancelled directly from `GRACE_PERIOD`/`SUSPENDED`, staff ends the agreement
  IMMEDIATE (S51) or the payer is revoked (S36, with the full refund of AC-6.16, D24), **Then**
  payer and children become `CANCELLED` (S49), coverage loss per vertical, agreement `ENDED`.
- **AC-6.4** **Given** a child whose status disagrees with the status the payer maps to,
  **When** the hourly `billing-agreement-consistency-check` job runs, **Then** it opens a
  reconciliation mark `HIJA_DE_ACUERDO_DESALINEADA` (MOT:25, subject = that child) and writes
  nothing else, unless the payer is terminal and the child live (AC-6.14).
- **AC-6.5** **Given** an `AGREEMENT` child, **When** anything tries to insert a
  `provider_link` for it, **Then** the database raises; no code path calls the provider for a
  child.
- **AC-6.6** **Given** payer and children `CANCEL_SCHEDULED` or in grace, **When**
  `end-scheduled-services`, `send-grace-reminders`, `read-own-declined-signups` and
  `findExpiredAuthorizationWindows` select rows, **Then** they never select a child: S12 runs
  once on the payer and propagates, exactly one grace reminder is sent, S42 runs once.
- **AC-6.7** **Given** a `CANCEL_SCHEDULED` payer whose crossing charge extends its
  `service_ends_at`, **Then** every child's `service_ends_at` moves to the same instant (S50)
  and each child's coverage `until` follows.
- **AC-6.8** **Given** a child already in the propagation's target state, **Then** it is a
  no-op. **Given** a child in any other unexpected state, **When** any payer writer
  propagates, **Then** the payer transition and the consistent children commit, the
  mismatched child is left untouched, and the mark `HIJA_DE_ACUERDO_DESALINEADA` (MOT:25,
  subject = the mismatched child) plus a Sentry alert are raised. No act is ever refused for
  drift: the customer's S11 and direct cancel, a staff S11 or direct cancel through ACC_8, and
  every notice, sweep and cron MARK; the TERMINAL staff acts (S51, S36, withdraw, replace)
  FORCE the children instead (AC-6.13); a non-terminal drift is repaired by the realign act
  (AC-6.12). The reason `AGREEMENT_CHILD_STATE_MISMATCH` is retired (no endpoint answers it).
- **AC-6.9** **Given** an `ACTIVE` agreement becomes `ENDED` while a `DECREASE` version is
  `APPLYING`, **Then** that version becomes `FAILED` (AV7, recorded as `agreement_version.failed`)
  and an open MOT:27 on the payer is lifted in the same transaction ("Lifting MOT:27"). An
  `ACTIVE` agreement never holds
  an `OFFERED` version (an `INITIAL` replace needs an `OFFERED` agreement, and
  `ck_agreement_version_kind_status` forbids an `OFFERED` `DECREASE`), so AG4 has no
  `OFFERED -> WITHDRAWN` step; a separate `OFFERED` agreement of the same customer (D14) is not
  touched.
- **AC-6.10** **Given** an agreement whose children ended `CHARGE_DECLINED`, **When** the
  customer later starts an S1 checkout in one of those verticals, **Then**
  `closeDeclinedAttempts` ignores the AGREEMENT child (no provider link, so today it would
  answer `PREVIOUS_ATTEMPT_CLOSING` forever, `start-subscription.service.ts:428-434`) and the
  checkout proceeds.
- **AC-6.11** (M2) **Given** the cron registry, **Then** `billing-agreement-consistency-check`
  is registered in `registry.ts` and in `schedules.manifest.ts` (category `billing`, schedule
  `38 * * * *`), the MP stagger guard (`apps/api/test/cron/mp-cron-stagger.guard.test.ts`) and
  the manifest sync test stay green in BOTH phases of "Agreement consistency check job"
  (Phase 2: non-exclusive, minute 38 reserved by a pending placeholder; Phase 4: `exclusive:
  true` once it reads the provider). **Given** Phase 4 and a tick while another run holds the
  lock, **Then** the tick is skipped and nothing is written. **Given** a mark it opened stays unresolved, **When** the next
  run sees the same condition, **Then** the open mark accumulates (no second mark, the
  `uq_reconciliation_mark_open_subscription_reason` index) and nothing else is written.
- **AC-6.12** (M3, realign) **Given** a payer `ACTIVE` with one child `GRACE_PERIOD` (open
  MOT:25 on it) and one child `ACTIVE`, **When** a SUPER_ADMIN calls
  `POST /api/v1/admin/billing/agreements/:id/realign-children`, **Then** in ONE transaction
  under the payer lock the drifted child is written to `mapPayerStatus(payer)` (here `ACTIVE`,
  grace columns cleared), its open MOT:25 is lifted through S15 (`liftReconciliationMark`,
  `liftedBy` = the actor), the act is audited as `ACC_28`, a `CoverageChangedEvent` is
  emitted after commit for each child whose coverage changed, no billing fact is emitted, and
  the response is 200 `{ realigned: [{ childId, from: 'GRACE_PERIOD', to: 'ACTIVE' }] }`; the
  consistent child is not written. **Given** every child already matches, **Then** 200
  `{ realigned: [] }` and nothing written. **Given** an agreement that never had a payer (an
  `OFFERED` agreement never pressed), **Then** 409 `reason: 'AGREEMENT_NO_PAYER'`. **Given** an
  `ENDED` agreement whose payer is `CANCELLED` and one child still `GRACE_PERIOD`, **Then** the
  realign resolves that payer (the payer rule of "`mapPayerStatus` and the realign act") and
  writes the child `CANCELLED` with coverage loss (AC-6.14). **Given** an actor without
  `BILLING_MANAGE_AGREEMENTS`, **Then** 403.
- **AC-6.13** (M3, terminal acts force) **Given** a payer with one child in an unexpected
  live state, **When** staff runs S51 (end IMMEDIATE) or S36 (revoke) on the agreement or its
  payer, **Then** the act is NOT refused: in its single transaction the payer becomes
  `CANCELLED`, every consistent child follows S49, the drifted live child is FORCED to
  `CANCELLED` (coverage loss recorded for its vertical), and for that child a MOT:25 is opened
  (or the open one accumulated) and lifted through S15 in the same transaction with `liftedBy`
  = the actor, so no open mark survives and the record shows what was forced. **Given** staff
  withdraws or replaces an offer whose pending payer has a child in a live state other than
  `PENDING_AUTHORIZATION`, **Then** the same rule applies with that child forced to
  `CANCELLED` and the consistent children to `ABANDONED` (S42). A child already in a terminal
  state (`CANCELLED`, `ABANDONED`, `CHARGE_DECLINED`) is left as is.
- **AC-6.14** (M5, live child under a terminal payer) **Given** a payer in a terminal status
  (`CANCELLED`, `ABANDONED` or `CHARGE_DECLINED`, typically after AG4 ended the agreement) and
  a child still in a live status (left by a MARK writer), **When** the
  `billing-agreement-consistency-check` job runs, **Then** it selects that child even though
  the payer is not live, and in one transaction (lock order of "Lock order") writes the child
  to `terminalTargetFor(payer, child)` ("`mapPayerStatus` and the realign act"), records
  `recordCoverageLossIfUncovered` for its vertical, opens (or accumulates) MOT:25 on the child
  and lifts it through S15 with `liftedBy = SYSTEM_USER_ID` (`packages/db/src/constants/index.ts:27`),
  and emits a `CoverageChangedEvent` after commit and no billing fact. **Given** the same child,
  **When** staff runs the realign act first, **Then** the realign makes the same write with
  `liftedBy` = the actor. A terminal child of a terminal payer is never selected.
- **AC-6.15** (M2, S1 after a declined agreement payer) **Given** a customer whose agreement
  payer P is `CHARGE_DECLINED` with a provider link whose preapproval is not yet cancelled
  (deferred S16 cancel), **When** the customer starts S1 (or a manual signup) in ANY single
  vertical, line vertical or not, **Then** `closeDeclinedAttempts` sees P through the widened
  `findDeclinedWithProviderLinks` ("Authorization flow" step 2b), cancels it with the
  before-cancel notice, and answers 409 `PREVIOUS_ATTEMPT_CLOSING` until a fresh read shows it
  `cancelled`; P's `CHARGE_DECLINED` children (no link) are never selected (AC-6.10).
- **AC-6.16** (D24, staff revocation refunds) **Given** a payer in a revocation origin
  (`REVOCATION_ORIGINS`, `revocation-reading.ts:19`: `ACTIVE`, `GRACE_PERIOD`,
  `CANCEL_SCHEDULED`; `PAUSED` is unreachable in V1) whose last credited payment is inside the
  existing 10-day window (`REVOCATION_WINDOW_DAYS`, `revocation-payment.ts:30`), **When** staff
  previews S36 on the payer (ACC_8, the existing admin subscription detail action, which stays
  visible for the payer to a user holding `BILLING_MANAGE_AGREEMENTS`; preview and confirm also
  require it, D25, AC-10.3), **Then** the preview (`SubscriptionRevocationPreview`) shows that
  payment with its full `amount` (the whole multi-vertical charge) as the refund and
  `requestsRefund: true`; **and When** staff confirms, **Then** in S36's single transaction the
  payer becomes `CANCELLED`, the children follow S49 (drifted live children forced, AC-6.13),
  AG4 ends the agreement with `end_reason = 'REVOKED'`, one RF1 refund of that full amount is
  recorded against the PAYER's payment (`requestRevocationRefund`, the payments hang from the
  payer), and after commit the preapproval is cancelled; the payer emits one
  `SUBSCRIPTION_CANCELLED` with `path: 'REVOKED'` and no child emits a fact (AC-11.1, AC-11.2).
  Every existing S36 refusal applies unchanged (for example `REVOCATION_WINDOW_CLOSED`, or a
  `SUSPENDED` payer with `REVOCATION_STATE_NOT_ALLOWED`; staff uses S51 there, which refunds
  nothing, D14). **Given** a child id, **Then** `AGREEMENT_CHILD_ACT_ON_PAYER` (refusal table,
  "Writers that must refuse").
- **AC-6.17** (minor 5, job check (b)) **Given** a payer `ACTIVE` with a child in vertical V and a
  live `COMPLEMENTO` whose `addon_instance` anchors a `VERTICAL_SUBSCRIPTION`-scope
  `addon_version` targeting that child (seeded directly: purchase refuses it, AC-7.3), **When**
  the `billing-agreement-consistency-check` job runs, **Then** it opens
  `ADDON_SOBRE_HIJA_DE_ACUERDO` (MOT:28, subject = the child) with a Sentry alert and writes
  nothing else (the add-on is not cancelled); a second run accumulates on the open mark; a live
  `USER`- or `GLOBAL`-scope add-on of the same customer opens nothing (AC-7.8).
- **AC-6.18** (D26 versus D18 race, job check (e)) **Given** a customer with a live `AGREEMENT`
  child in vertical `tourist` and a live non-agreement `PRINCIPAL` whose plan version has
  `inherits_tourist_vip = true` (seeded directly: S1 of the VIP plan and authorize of the
  agreement take no common lock, so both can commit), **When** the
  `billing-agreement-consistency-check` job runs, **Then** it opens
  `VIP_TURISTA_DUPLICADO_POR_ACUERDO` (MOT:29, subject = that `PRINCIPAL`) with a Sentry alert and
  writes nothing else; a second run accumulates on the open mark; the same customer without the
  VIP-inheriting `PRINCIPAL` opens nothing.

#### US-7: Customer limits and cancellation

- **AC-7.1** **Given** a payer `ACTIVE`, **When** the customer presses "Cancel agreement"
  (mandatory, consumer law), **Then** the payer becomes `CANCEL_SCHEDULED` with
  `service_ends_at` = the end of the paid period computed from the version terms, every
  child `CANCEL_SCHEDULED` with the same instant (S48); at that date all become `CANCELLED`
  and the agreement `ENDED`. **Given** a payer in `GRACE_PERIOD` or `SUSPENDED`, **When** the
  customer cancels, **Then** the existing route sends it to direct cancel
  (`apps/api/src/routes/billing-subscription/cancellation.ts:143-146`): payer and children
  become `CANCELLED` now (S49) and the agreement `ENDED`. The cancellation preview shows the
  matching outcome (scheduled date, or "ends now"). The card shows "Cancel agreement" for a payer
  `ACTIVE`, `GRACE_PERIOD` or `SUSPENDED` (UX).
- **AC-7.2** **Given** a child id, **When** cancel (S11 or direct), its preview, the
  pending-attempt cancel or revoke (S36) targets it directly, **Then** 409 `ALREADY_EXISTS`,
  `reason: 'AGREEMENT_CHILD_ACT_ON_PAYER'`, `details.payerSubscriptionId` (the same act runs on
  the payer). Every other act on a child answers its row of the refusal table ("Writers that
  must refuse an AGREEMENT child or the payer"), and nothing is written in any case.
- **AC-7.3** **Given** a live child, **When** the customer redeems a promo code or a trial
  extension code in its vertical, or requests a plan change on the child or on the payer,
  **Then** 409 `reason: 'AGREEMENT_MANAGED'`; **when** a `VERTICAL_SUBSCRIPTION`- or
  `LISTING`-scope add-on purchase resolves to that vertical (`resolvePurchaseTitle`), **Then**
  409 `reason: 'AGREEMENT_ADDONS_NOT_AVAILABLE'` and no `addon_instance` or provider call is
  made (D20).
- **AC-7.4** **Given** a payer or a child, **When** staff requests a temporary courtesy or its
  preview, **Then** 409 `reason: 'AGREEMENT_COURTESY_NOT_AVAILABLE'`, nothing written, and the
  admin subscription detail of a payer or a child renders no courtesy action (D19). **Given** a
  payer or a child, **When** staff or the customer requests a pause, or S35 forfeits a courtesy
  on it, **Then** 409 `reason: 'AGREEMENT_PAUSE_NOT_AVAILABLE'` (D15).
- **AC-7.5** **Given** a live child in a vertical (live = `LIVE_SUBSCRIPTION_STATUSES`, the same
  set that makes S1 answer `VERTICAL_IN_AGREEMENT`, AC-7.6), **When** the plans page island
  resolves the pricing situation, **Then** it receives `{ situation: 'AGREEMENT', agreementId,
  agreementState }` (the child's agreement) and renders no checkout button: with
  `agreementState: 'PENDING_AUTHORIZATION'` (the child is `PENDING_AUTHORIZATION`) it renders
  "Pending authorization of your agreement" (`billing.agreements.pricingSituation.pending`),
  never "Included in your agreed plan"; with `agreementState: 'INCLUDED'` (any other live child
  status: `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED`, `CANCEL_SCHEDULED`) it renders "Included in
  your agreed plan" (`billing.agreements.pricingSituation.included`).
- **AC-7.6** **Given** a live child in a vertical, **When** S1 checkout is started there,
  **Then** 409 `reason: 'VERTICAL_IN_AGREEMENT'`.
- **AC-7.7** **Given** a customer with a live child in vertical V and a paying non-agreement
  PRINCIPAL in vertical W, **When** a USER-scope add-on compatible with V and W is purchased,
  **Then** `resolvePurchaseTitle` skips V and resolves the title in W; **given** no
  non-agreement compatible vertical has a title and at least one compatible vertical was
  skipped because it has a live agreement child, **Then** 409 `AGREEMENT_ADDONS_NOT_AVAILABLE`
  (not `NO_VALID_TITLE`); **given** no vertical was skipped and none has a title, **Then** the
  existing `NO_VALID_TITLE` (D20).
- **AC-7.8** **Given** a live USER-scope add-on bought through a non-agreement title before
  the agreement, **When** the agreement activates and later charges, **Then** the add-on stays
  `ACTIVE` and keeps charging on its own preapproval, no add-on is cancelled automatically, the
  consistency check opens no mark for it, and the effective set of every agreement vertical is
  the private plan's alone (the add-on does not extend it) (D20 P7b). The same holds for a
  `GLOBAL`-scope add-on (D20 GLOBAL extension).
- **AC-7.9** (minor 12) **Given** a payer `ACTIVE`, **When** staff cancels it through the
  admin subscription detail (ACC_8, `BILLING_CANCEL_SUBSCRIPTION` plus `BILLING_MANAGE_AGREEMENTS`
  per D25, AC-10.3; the existing S11 with `authority.as = 'ADMIN'`), **Then** the same preconditions as the customer's S11 apply (only
  from `ACTIVE`; no drift pre-check, rule 1 MARKs), payer and children become
  `CANCEL_SCHEDULED` with the same `service_ends_at` (S48), the decision is recorded with actor
  type `admin`, and at S12 the agreement ends with `end_reason = 'STAFF_CANCELLED'`. **Given**
  that payer has no credited covered period yet (activated before its first credit), **Then**
  `service_ends_at = now` (`computeS11ServiceEnd` basis `NOW`, `s11-service-end.ts:46-58`) and
  the next `end-scheduled-services` run ends it (S12). **Given** a payer in `GRACE_PERIOD` or
  `SUSPENDED`, **When** staff cancels it through ACC_8, **Then** direct cancel runs (S49 now)
  and the agreement ends `STAFF_CANCELLED` (actor `admin`,
  `cancel-direct-subscription.service.ts:264`). Staff's own path for ending an agreement is
  still `endAgreement` (AC-8.8); ACC_8 on the payer is equivalent, not a second semantics.
- **AC-7.10** (D26) **Given** a customer with a live `AGREEMENT` child in vertical `tourist`
  (any status in `LIVE_SUBSCRIPTION_STATUSES`), **When** they start an S1 checkout or a manual
  signup for a plan version with `inherits_tourist_vip = true` in another vertical, **Then** 422
  `VALIDATION_ERROR`, `reason: 'AGREEMENT_TOURIST_VIP_REDUNDANT'`, no row, key or provider call,
  and the web shows `billing.agreements.blocked.AGREEMENT_TOURIST_VIP_REDUNDANT`; a plan version
  without the flag proceeds. **Given** the same customer with a standalone accommodation
  `PRINCIPAL`, **When** they upgrade it (`requestPlanChange` -> `startSuccession`) to a version with
  `inherits_tourist_vip = true`, **Then** the same 422 `AGREEMENT_TOURIST_VIP_REDUNDANT` and no
  successor row. **Given** an S37 plan migration whose target version inherits VIP, **Then** a
  cohort subscription whose customer has a live `AGREEMENT` tourist child is `EXCLUDED` with
  `excludedReason: 'AGREEMENT_TOURIST_VIP_REDUNDANT'` in the preview and in the launch's
  `excluded` list. **Given** the symmetric case, an agreement child in a title-emitting
  status (`ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`) whose private version inherits VIP and a
  standalone tourist purchase, **Then** the existing `assertTouristVipPurchaseAllowed` refuses it
  (409 `TOURIST_VIP_INHERITED`), with no new code. Rule: the S1 bullet of "Writers that must refuse
  an AGREEMENT child or the payer".

#### US-8: Staff changes the price or the package

- **AC-8.1** **Given** an `ACTIVE` agreement, **When** staff publishes a version with a LOWER
  amount and the same cycle and lines, **Then** it is inserted as `APPLYING`, `changeAmount`
  is sent and confirmed by a fresh read, the payer's `agreement_version_id` moves to it (old
  `SUPERSEDED`, new `ACTIVE`), the price-decrease email is enqueued, and the expected-amount
  reconciliation checks the next charge against the new amount. **While** the version is
  `APPLYING`, the reconciliation's expected amount is the `APPLYING` version's amount, so the
  amount-mutation retry (`amount-comparison.ts:54-78`) never reverts the decrease and re-sends
  the NEW amount only over the `ACTIVE` version's amount (the single amount-retry rule, "After
  `FAILED`" under "Version changes and ending", AC-8.19); the decision is recorded with
  transition `S52`.
- **AC-8.2** **Given** the payer is not `ACTIVE`, or a version is already `APPLYING`, **When**
  a decrease is published, **Then** 409 `AGREEMENT_PAYER_NOT_ACTIVE` /
  `AGREEMENT_VERSION_CHANGE_IN_PROGRESS` and nothing is written.
- **AC-8.3** **Given** an `ACTIVE` agreement, **When** staff publishes a version with a higher
  amount, another cycle or other lines, **Then** 409
  `reason: 'AGREEMENT_CHANGE_REQUIRES_NEW_AGREEMENT'` and nothing is written.
- **AC-8.4** **Given** an `OFFERED` (never activated) agreement, **When** staff publishes a new
  version, **Then** it replaces the pending offer (old `WITHDRAWN`, link revoked), with
  `change_kind = 'INITIAL'`, after running exactly the validations of `POST /` (AC-8.15).
- **AC-8.5** **Given** an `OFFERED` version, **When** staff withdraws it, **Then** it becomes
  `WITHDRAWN`, its link is revoked, and an agreement that never activated becomes
  `WITHDRAWN`.
- **AC-8.6** **Given** the `OFFERED` version has a live payer (`PENDING_AUTHORIZATION`),
  **When** staff withdraws or replaces it, **Then**, in its unlocked pre-read and before any
  provider call, the act reads the payer's LATEST `PREAPPROVAL_CREATE` key (subject = payer,
  ordered by `created_at DESC, key DESC`, as `mintKeyAfterRejectedCreation` does at
  `subscription.model.ts:209-233`; a payer can hold several keys, because each retry after a
  rejected creation mints a new one) and branches in this order:
  1. **given** that latest key is not completed (`completed_at IS NULL`: the creation is still
     in flight), **Then** 409 `reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS'` and nothing is written
     or sent (same check as `cancel-pending-attempt.service.ts:48-50`); staff retries later;
  2. **given** the payer has no `provider_link` AND that latest key is completed with a
     `result` that parses as `RejectedCreationResultSchema` (`outcome: 'REJECTED_BY_PROVIDER'`)
     or `ThrottledCreationResultSchema` (`outcome: 'THROTTLED_BY_PROVIDER'`)
     (`resolve-live-commitment.ts:27-36`), **Then** in ONE transaction the payer and children
     become `ABANDONED` (S42) and the version closes (AV6, plus AG3 on withdraw), with NO
     provider call and no cancellation decision: the provider refused the creation before
     processing it, so nothing exists at MercadoPago. A rejected or throttled creation never
     frees its key: `start-subscription.service.ts:248-262` calls
     `recordCreationRejected` (`subscription.model.ts:191-206`), which COMPLETES the key with
     that result, and `resolve-live-commitment.ts:193-204` reads it back as `RECREATE`; the payer
     row and its key are inserted in one transaction, so a payer with "no link and no key" does
     not exist. This differs on purpose from S40, which answers `PREVIOUS_ATTEMPT_IN_PROGRESS`
     for this case (`cancel-pending-attempt.service.ts:48-50` requires a link);
  3. **given** a `provider_link` is present (and the latest key completed), **Then** the act
     follows S40's order (`cancel-pending-attempt.service.ts:54-94,126-142`): a fresh read
     first, outside any transaction; **given** the read is anything other than `pending` or `cancelled` (for example
     `active`: the customer just authorized), **Then** 409
     `reason: 'AGREEMENT_PAYER_AUTHORIZING'` and nothing is written, so the activation
     proceeds; **given** `pending` or `cancelled`, **Then** in ONE transaction the payer and
     children become `ABANDONED` (S40 payer variant, S42), `recordProviderCancellationDecided`
     is recorded, and the version closes (AV6, plus AG3 on withdraw); after commit the
     preapproval is cancelled (`ATTEMPT_CANCELLED`);
  4. **given** any other state without a `provider_link` (for example a latest key completed
     with an applied or not-applied authorization result but no link row), **Then** 409
     `reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS'` and nothing is written or sent (fallback: the
     creations sweep resolves the attempt; staff retries later).

  The writing transaction of branches 2 and 3 re-validates what the pre-read and the read
  observed (payer `PENDING_AUTHORIZATION`, same `provider_link.provider_id` or still none, same
  latest key, version and agreement `OFFERED`) under the provider-call rule of "Lock order"; on a
  mismatch nothing is written or sent and the act answers 409 `AGREEMENT_PAYER_AUTHORIZING`.
  One exception (seventh review minor 6): when the payer is no longer live because S3 abandoned
  it meanwhile (`ABANDONED`, its children with it), the act proceeds as with no live payer: it
  closes the version (AV6, plus AG3 on withdraw) in that transaction and sends no cancel (S3
  owns its own, before-cancel kind `AUTHORIZATION_EXPIRED`).
  A cancel that fails is retried by `our-cancellation-retry`, and a
  preapproval that stays live on the closed row is caught by H-7
  (`live-preapproval-on-closed-row.ts:158-175`). A payer that is already `ACTIVE` means the
  agreement is `ACTIVE`, so AC-8.3 applies instead.
- **AC-8.7** **Given** an `ACTIVE` agreement whose payer is `CANCEL_SCHEDULED`, **When** staff
  offers a new agreement to the same customer, with the SAME or with different verticals,
  **Then** it is created `OFFERED` (the old children are not blockers at offer time,
  AC-1.7); **and When**
  the customer authorizes it before the old agreement is `ENDED`, **Then** 409
  `AGREEMENT_PREVIOUS_NOT_ENDED` (AC-3.9); after the old agreement `ENDED`, authorize succeeds
  (D14).
- **AC-8.8** **Given** an agreement, **When** staff ends it, **Then** the answer is exactly the
  row of the end-mode matrix in "Version changes and ending" (the single definition, including
  the `OFFERED` row with or without a payer: 409 `AGREEMENT_END_MODE_NOT_AVAILABLE`,
  `details.allowedModes: []`, the admin copy pointing to "Withdraw offer"); for example SCHEDULED
  from `ACTIVE` runs S11 (S48) and IMMEDIATE runs S51 (provider cancel, payer and children
  `CANCELLED`, agreement `ENDED`, no refund).
- **AC-8.9** **Given** a `DECREASE` version in `APPLYING` for longer than
  `billing.agreementDefaults.applyingStaleHours` (default 24), **When** the
  `billing-agreement-consistency-check` job runs and a fresh provider read shows the new
  amount, **Then** the old
  version becomes `SUPERSEDED`, the new one `ACTIVE` (AV5 then AV4), the payer's
  `agreement_version_id` moves to it, `agreement-price-decreased` is enqueued once and an open
  MOT:27 is lifted with `liftedBy = SYSTEM_USER_ID` ("Lifting MOT:27");
  **given** the read shows any other amount or fails, **Then** the version stays `APPLYING`,
  the mark `VERSION_DE_ACUERDO_SIN_APLICAR` (MOT:27, subject = the payer) is open with a
  Sentry alert, and nothing else is written. **Given** an `APPLYING` version younger than the
  threshold, **Then** the check ignores it.
- **AC-8.10** (DECREASE scope) **Given** an `ACTIVE` agreement, **When** staff publishes a
  version with the SAME amount, cycle and lines (whatever its `grace_days`), **Then** 422
  `VALIDATION_ERROR`, `reason: 'AGREEMENT_VERSION_NO_CHANGE'`, nothing written and no provider
  call: a grace-only change needs end-and-recreate (V1-b, D14). **Given** a LOWER amount with
  the same cycle and lines and a different `grace_days`, **Then** it is a `DECREASE` (AC-8.1)
  carrying the new `grace_days`, validated against D17 (AC-1.8); the new grace governs grace
  periods ENTERED after AV4 (a payer already in grace keeps its `grace_ends_at`).
- **AC-8.11** **Given** a payer whose first charge was credited while it was still
  `PENDING_AUTHORIZATION` (credited-pending activation, so the charge's `created_at` precedes the
  `INITIAL` version's `activated_at`), **When** the PERIOD expected-amount comparison runs for
  that charge, **Then** it is `COMPARABLE` against the `INITIAL` version's amount (source
  `AGREEMENT_VERSION`), never `NOT_COMPARABLE` `NO_VERSION`: the `INITIAL` version's window
  opens at the compared payer's `created_at`.
- **AC-8.12** (M2, abandon) **Given** a `DECREASE` version `APPLYING` (any age), **When** a
  SUPER_ADMIN calls `POST /api/v1/admin/billing/agreements/:id/versions/:versionId/abandon`,
  **Then** the act first does a fresh provider read of the payer's preapproval, outside any
  transaction (its writing transaction re-validates per AC-8.18), and branches: **given** the read shows the `APPLYING` version's amount, **Then**
  it promotes instead (AV5 then AV4, the payer's `agreement_version_id`,
  `agreement-price-decreased` enqueued once, MOT:27 lifted) and answers 409
  `reason: 'AGREEMENT_VERSION_ALREADY_APPLIED'`; **given** the read shows the `ACTIVE`
  version's amount, **Then** in one transaction the version becomes `FAILED` (AV7) with
  `closed_at = now`, the decision is recorded as a `domain_event` of type
  `agreement_version.failed` (entity `agreement_version`, actor type `admin` and the actor id,
  `reason: 'AV7'`, `changes: [{ field: 'agreement_version.status', old: 'APPLYING', new:
  'FAILED' }]`; never `subscription.amount_mutation_decided`, "Version changes and ending"),
  any open MOT:27 on the payer is lifted through S15 with
  `liftedBy` = the actor, the act is audited as `ACC_28`, and the answer is 200 `{ versionId,
  status: 'FAILED' }`; **given** the read shows any third amount, **Then** the same `FAILED`
  write, event, MOT:27 lift, audit and 200, plus `DIVERGENCIA_DE_MONTO` (MOT:5, subject = the
  payer) opened in the same transaction: the expected amount reverts to the `ACTIVE` version's and
  staff reconciles the provider amount from that mark (sixth review M3);
  **given** the read fails, **Then** 503 and nothing written. **Given** a version that is not
  `APPLYING`, **Then** 409 `AGREEMENT_VERSION_NOT_APPLYING`. **After** `FAILED`, the expected
  amount (both `AUTHORIZATION` and `PERIOD` for charges created after `closed_at`) is the
  `ACTIVE` version's amount again; a charge created inside the closed `APPLYING` interval stays
  `NOT_COMPARABLE` `VERSION_APPLYING`; and the amount-mutation retry
  (`amount-comparison.ts:54-78`) never sends `changeAmount` on the strength of an `S52`
  decision whose version is `FAILED` (it reports the divergence instead). **Given** that
  abandon, **When** the reconciliation sweep next compares the payer's amount, **Then** it does
  not fail (`findLatest` returns the `S52` decision with its `agreementVersionId`, never an
  unknown reason) and the fake records zero `changeAmount` calls.
- **AC-8.13** (M2, provider refusal at publish) **Given** an `ACTIVE` agreement and a valid
  decrease, **When** the provider rejects `changeAmount` with a definitive refusal (a
  `PaymentProviderError` that is not a timeout, network error or 5xx), **Then** the version
  row (inserted `APPLYING` with the `S52` decision) moves to `FAILED` (AV7) in a second
  transaction, the payer's `agreement_version_id` and the `ACTIVE` version are unchanged, no
  email is enqueued, and the answer is 422 `VALIDATION_ERROR`,
  `reason: 'AGREEMENT_PROVIDER_REJECTED_AMOUNT'`, `details.versionId`; the retry rule of
  AC-8.12 keeps the reconciliation from re-sending it.
- **AC-8.14** (M2, minor 6, uncertain decrease) **Given** an `ACTIVE` agreement and a valid
  decrease, **When** the `changeAmount` outcome is unknown (timeout, network error, 5xx, or a
  fresh read that does not yet show the new amount), **Then** the answer is exactly 202
  `{ versionId, changeKind: 'DECREASE', applied: false, status: 'APPLYING' }`, the version
  stays `APPLYING` with the mark `VERSION_DE_ACUERDO_SIN_APLICAR` (MOT:27) open, and it is
  resolved later by `POST .../apply`, by `POST .../abandon` (AC-8.12) or by the stale check
  (AC-8.9); the endpoint never answers 503 for an uncertain decrease. A confirmed decrease
  answers 201 `{ versionId, changeKind: 'DECREASE', applied: true, status: 'ACTIVE' }`; a
  replacing INITIAL answers 201 `{ versionId, changeKind: 'INITIAL', applied: true, status:
  'OFFERED' }`.
- **AC-8.15** (M4, replace validations) **Given** an `OFFERED` agreement, **When** staff
  replaces its offer through `POST /:id/versions`, **Then** the new terms run exactly the
  checks of `POST /` with `findAgreementBlockers({ at: 'OFFER', replacingVersionId })`, under
  the agreement lock and BEFORE any provider call or write: 422 `AGREEMENT_NO_LINES`,
  `AGREEMENT_LINE_NOT_PRIVATE`, `AGREEMENT_LINE_NOT_CURRENT`,
  `AGREEMENT_AMOUNT_OUT_OF_RANGE` (floor and cap), `AGREEMENT_GRACE_NOT_BELOW_CYCLE` (D17),
  `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED` (D6), `AGREEMENT_TOURIST_VIP_REDUNDANT` (D18,
  inside and outside the agreement); 409 `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION` (with
  `details.blocking`) and `AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT` (D8). The children of a live
  payer of the version being replaced (`replacingVersionId`) are not blockers (they are
  abandoned by the same act, AC-8.6); every other row is. `AGREEMENT_ALREADY_OFFERED` and
  `AGREEMENT_ALREADY_LIVE` do not apply (same agreement). On any refusal the old offer, its
  payer and its links are untouched.
- **AC-8.16** (minor 6, DECREASE validations) **Given** an `ACTIVE` agreement, **When** staff
  publishes a version classified as `DECREASE` ("Version changes and ending"), **Then** before
  any write or provider call it checks exactly: amount between `PROVIDER_AMOUNT_FLOOR_MINOR` and
  `billing.agreementDefaults.maxChargeMinor` (422 `AGREEMENT_AMOUNT_OUT_OF_RANGE`), grace below
  the cycle (422 `AGREEMENT_GRACE_NOT_BELOW_CYCLE`, D17), and the line set equal to the
  `ACTIVE` version's (else 409 `AGREEMENT_CHANGE_REQUIRES_NEW_AGREEMENT`). It does NOT re-check
  `AGREEMENT_LINE_NOT_CURRENT`, `AGREEMENT_LINE_NOT_PRIVATE`, the Partner setting,
  `AGREEMENT_TOURIST_VIP_REDUNDANT` or the blockers on the unchanged lines: a decrease keeps
  its lines (AC-2.8, AC-9.2). **Given** the Partner setting OFF and a retired plan version on a
  line, **Then** a valid decrease still succeeds.
- **AC-8.17** (minor 5, apply refusals) **Given** an `APPLYING` version, **When** staff calls
  `POST .../versions/:versionId/apply` and the payer is not `ACTIVE`, **Then** 409
  `reason: 'AGREEMENT_PAYER_NOT_ACTIVE'`, nothing written and no provider call; **given** the
  payer is `ACTIVE`, the fresh read shows the old amount and the re-sent `changeAmount` is
  definitively refused (as in AC-8.13), **Then** the version becomes `FAILED` (AV7, recorded as
  `agreement_version.failed`), an open MOT:27 is lifted with `liftedBy` = the actor, and the
  answer is 422 `VALIDATION_ERROR`, `reason: 'AGREEMENT_PROVIDER_REJECTED_AMOUNT'`,
  `details.versionId`; **given** the read shows the new amount, **Then** it promotes (AV5, AV4,
  payer `agreement_version_id`, email once, MOT:27 lifted with `liftedBy` = the actor) and
  answers 200 `{ versionId, status: 'ACTIVE' }`; **given** the read shows any third amount (neither
  the old nor the new) and the body carries no `confirmResendOverAmountMinor`, **Then** 409
  `reason: 'AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED'`, `details.providerAmountMinor`, nothing written,
  no `changeAmount` sent, MOT:27 stays open; **given** staff confirms by calling `apply` again with
  `confirmResendOverAmountMinor` equal to the amount the fresh read shows, **Then** it re-sends
  `changeAmount` with the `APPLYING` amount, reads again and takes the branches above (promote,
  refusal -> AV7, or still unknown -> 200 `APPLYING`); a confirmation that no longer matches the
  read answers the same 409 with nothing sent (sixth review M3).
- **AC-8.18** (fifth review M1, decrease racing abandon or AG4) **Given** a published decrease
  whose `APPLYING` row committed and whose `changeAmount` is in flight, **When** a concurrent
  `abandon` (old-amount read) fails the version before the publish's post-provider transaction,
  and the provider then shows the NEW amount, **Then** that transaction re-takes the locks, makes
  no version write, opens `DIVERGENCIA_DE_MONTO` (MOT:5, subject = the payer) and answers 409
  `reason: 'AGREEMENT_VERSION_NOT_APPLYING'`; the version stays `FAILED`, no email is enqueued,
  and the amount retry never re-sends (AC-8.12). **When** instead AG4 ended the agreement (payer
  `CANCELLED`, version `FAILED`) before that transaction, **Then** 409
  `AGREEMENT_VERSION_NOT_APPLYING` with no write and no mark. The same holds for the
  definitive-refusal and the unknown-outcome transactions (no `FAILED` write, no MOT:27 opened),
  for `apply` and `abandon`, which act only on a version still `APPLYING` under an `ACTIVE`
  agreement, and for the consistency job's check (c) (AC-8.9), whose transaction after the
  provider read re-validates the same two conditions and, on a mismatch, writes nothing for that
  payer this run (an `abandon` that failed the version between the job's read and its
  transaction leaves the version `FAILED`, no AV4, no email). Rule: "Post-provider re-validation"
  under "Version changes and ending"; the provider-call and zero-row rules in "Lock order".
- **AC-8.19** (seventh review M3, automatic retry while `APPLYING`) **Given** an `ACTIVE` agreement
  with an `S52` decision inside the 3-day window whose version is `APPLYING`, **When** the
  reconciliation amount comparison reads the preapproval and it shows the `ACTIVE` version's
  (old) amount, **Then** it re-sends `changeAmount` with the `APPLYING` amount; **when** it shows
  any third amount, **Then** it sends nothing and returns the `DIVERGENCIA_DE_MONTO` finding
  (MOT:5 on the payer opened, or accumulated on the open one), and MOT:27 keeps its own rules
  (the fake records zero `changeAmount` calls). Rule: "After `FAILED`" under "Version changes and
  ending".

#### US-9: Permanent grants and the Partner setting

- **AC-9.1** **Given** a live child in a vertical, **When** S13 grants a permanent grant
  covering that vertical, **Then** 409 `reason: 'PERMANENT_GRANT_VERTICAL_IN_AGREEMENT'` and
  nothing is written.
- **AC-9.2** **Given** a live agreement with a Partner line and the setting turned OFF,
  **Then** the agreement keeps running (a decrease keeps its lines); a new agreement with
  Partner is refused (AC-1.6).
- **AC-9.3** **Given** an ADMIN (who holds `BILLING_SETTINGS_WRITE`,
  `rolePermissions.seed.ts:758-759`) or any actor without `BILLING_MANAGE_AGREEMENTS`,
  **When** writing `billing.partnerCardCharging` or `billing.agreementDefaults`, **Then** 403.
- **AC-9.4** (seventh review minor 3, S13 versus authorize) **Given** S13 granting vertical V and
  an authorize whose version has a line in V running at once for the same customer, **Then** both
  take the customer's `users` row `FOR NO KEY UPDATE` first ("Lock order"), so exactly one wins: either
  the grant commits and authorize answers 409 `AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT`, or the
  payer and children commit and S13 answers 409 `PERMANENT_GRANT_VERTICAL_IN_AGREEMENT`. **Given** a
  live permanent grant and a live child in the same vertical anyway (seeded), **When** the
  reconciliation sweep runs, **Then** the existing grant fan-out check opens (or accumulates)
  `FAN_OUT_DE_GRANT_INCOMPLETO` (MOT:10) on the child and writes nothing else.

#### US-10: Admin visibility

- **AC-10.1** **Given** payer rows exist, **When** the admin subscription list loads,
  **Then** it renders them (class `ACUERDO`, vertical empty) and children show "via
  agreement" with a link to the agreement, built from the new
  `agreementId: z.string().uuid().nullable()` of `AdminSubscriptionListItemSchema`
  (`subscription-admin.schema.ts:32-56`, inherited by `AdminSubscriptionDetailSchema`, `:70`):
  for the payer its version's agreement, for a child its payer's agreement, `null` otherwise.
- **AC-10.2** **Given** an agreement, **When** its detail loads, **Then** it shows versions,
  lines, payer, children and the link state (never the token). The payer shown (detail `payer`
  and list `payerStatus`) is the one the realign act resolves (live payer of any version, else
  the newest by `created_at DESC, id DESC`, "`mapPayerStatus` and the realign act"), and
  `children` lists only that payer's children; an agreement whose versions had several payers
  shows no history sub-list (older payers stay reachable in the admin subscription list through
  `agreementId`, AC-10.1).
- **AC-10.3** (D25, agreement staff gate) **Given** an actor holding an act's usual permission but
  not `BILLING_MANAGE_AGREEMENTS` (an ADMIN), **When** it calls any admin write endpoint or preview
  whose subject resolves to a payer, a child, a payment of a payer, or a reconciliation mark whose
  subject is a payer or a child (S36 preview and confirm, ACC_8 cancel and its preview, pending
  attempt cancel, courtesy, pause, plan change, refund, mark lift; the
  `/api/v1/admin/billing/agreements*` endpoints are already route-gated, AC-1.2), **Then** it
  answers 403 `FORBIDDEN`, `reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'` (the existing admin reason,
  `apps/api/src/routes/billing-subscription/admin/cancellation.ts:30,42`), no `details`, nothing
  written and no provider call. Order per `apps/api/docs/error-contract.md` ("The order is the
  contract", lines 10-19): 401, 403 route permission, 400 shape, then 404 for an unknown id, and
  only then this gate, as the FIRST business rule (step 6, "403-gate"), before any other refusal
  of the act (the refusal table, S36's window, courtesy and pause refusals). **Given** an unknown
  id, **Then** 404 as today; **given** a non-agreement row, **Then** the act runs unchanged;
  **given** a SUPER_ADMIN, **Then** the act runs. Read endpoints (admin subscription list and
  detail, mark listings) are not gated. **Given** the admin subscription detail of a payer or
  child, **When** the user lacks the permission, **Then** it renders no write action for that row.
  Rule: "Permissions and administrative action".

#### US-11: Agreement revenue in analytics (D23)

- **AC-11.1** **Given** a payer, **When** it activates, a charge is credited, a charge is
  rejected, it enters grace (`GRACE_STARTED`), it is suspended for arrears
  (`SUSPENDED_FOR_ARREARS`), it recovers from grace or suspension (`RECOVERED`, including S7
  to `CANCEL_SCHEDULED`, which emits `RECOVERED` and no `CANCEL_SCHEDULED`, as for a PRINCIPAL
  today, `reactivate-suspended.service.ts:413-427`), it becomes `CANCEL_SCHEDULED` through S11
  (customer, staff via ACC_8, or `endAgreement` SCHEDULED: the only `CANCEL_SCHEDULED` emitter
  that can reach a payer, `cancel-active-subscription.service.ts:304-320`; the paused-cancel
  emitter is unreachable, and the S48 mirror `mirror-our-cancellation-on-active.ts` emits no
  fact today and V1 adds none) or it becomes `CANCELLED` through one of our own cancellation paths (S12
  service end, direct cancel, S36, S51), **Then** exactly one billing fact per act is emitted through `billing-fact-sink.ts` with
  `subscriptionClass: 'ACUERDO'`, `subscriptionId` = payer id, amounts in integer centavos, and
  NO `vertical` key in the fact or in the analytics `properties` (the key is absent, not
  `null` nor `undefined`); the payload parses against `BillingAnalyticsEventSchemas`. Every
  such fact carries `agreement_verticals` (the verticals of the lines of the payer's
  `agreement_version_id`, sorted ascending and comma-joined, e.g. `accommodation,venue`) and
  `line_count` (the number of those lines, an integer). The `CANCELLED` fact from an
  IMMEDIATE end (S51) carries `path: 'AGREEMENT_ENDED'`. The test drives the fact through
  `createAnalyticsFactSink` (`apps/api/src/utils/analytics/analytics-facts.ts:259`) with a
  capture spy and asserts the spy was called (the sink admits `ACUERDO`),
  `!('vertical' in properties)`, and the two agreement properties are present with the
  expected values. **Given** a provider-mirrored cancellation of the payer
  (`process-provider-notice.service.ts` or `mirror-cancelled-on-grace.ts` paths), **Then** no
  new fact is emitted for the payer (no `SUBSCRIPTION_CANCELLED` emitter exists on the mirror
  path today; V1 adds none).
- **AC-11.2** **Given** an agreement child (`PRINCIPAL`, `payment_method = 'AGREEMENT'`),
  **When** anything happens to it or to its payer (activation, `CANCEL_SCHEDULED`,
  cancellation on any path including S51/S49, grace, suspension, recovery, a charge credited
  or rejected on the payer), **Then** ZERO billing facts are emitted with the child's
  `subscriptionId` (the capture spy over the whole act records no call for it).
- **AC-11.3** **Given** any billing event, **Then** `subscription_class` is present; **given**
  `subscription_class` is `PRINCIPAL` or `COMPLEMENTO` and `vertical` is absent, **Then** the
  catalog schema rejects the payload; **given** `PRINCIPAL`/`COMPLEMENTO` with
  `agreement_verticals` or `line_count`, **Then** it rejects it; **given** `ACUERDO` with a
  `vertical`, or without `agreement_verticals` or `line_count`, **Then** it rejects it too;
  **given** `line_count` above 50 or `agreement_verticals` longer than 500 characters,
  **Then** it rejects it; **given** `billing_subscription_cancelled` with
  `path: 'AGREEMENT_ENDED'`, **Then** the catalog accepts it (the `path` enum in
  `catalog-billing.ts` and in `billing-fact-sink.ts` both list it).
- **AC-11.4** **Given** the analytics catalog, **Then** the `vertical` enum still equals
  `Object.values(VerticalEnum)` (no fake agreement value), no billing event key matches
  `FORBIDDEN_PROPERTY_KEY_REGEX`, and no billing event carries `pf_entity_id`.
- **AC-11.5** **Given** a payer, **When** it activates through any of the three activation
  sites, **Then** exactly ONE `SUBSCRIPTION_ACTIVATED` fact is emitted (class `ACUERDO`, from
  `afterAgreementActivated`) and none for its children; the propagation's post-commit emits
  no fact, and `after-activation-commit.ts` never runs for a child or the payer.
- **AC-11.6** **Given** an agreement with 3 lines, **When** the payer enters grace, **Then**
  exactly one `GRACE_STARTED` fact is emitted in total (on the payer, `line_count: 3`), and
  none for any of the 3 children.

### UX Considerations

- **Admin wizard** (Billing -> Agreements -> New, SUPER_ADMIN only; Tailwind + Shadcn,
  TanStack Form, schemas from `@repo/schemas` validated with `safeParse` in handlers):
  1. *Customer*: search users; shows live subscriptions per vertical, live grants and any
     live agreement; a required "Trade name" field stored as `agreement.trade_name`, used by
     the link page (D21) and as the agreement name in emails (D22). It starts EMPTY and is
     never prefilled from `users.display_name`: that field is often a personal name, D21
     forbids showing the first name, and the link page is reachable by anyone holding the
     token. An optional "Internal notes" field (staff only, at most 2000 characters) is stored
     as `agreement.internal_notes`.
  2. *Verticals*: per vertical, pick an existing private plan version or "based on plan X",
     which opens the existing key editor from `apps/admin/src/features/billing-plan-catalog/`.
     Partner is hidden while the setting is OFF. Verticals with a blocking subscription or a
     live permanent grant are disabled with the reason and a link to that subscription in
     the admin, so staff can cancel or refund it first.
  3. *Charging*: amount (ARS, integer pesos in the UI, stored in centavos), cycle (monthly |
     annual), grace days (prefilled), live validation against the cap and the floor.
  4. *Review*: lines, price, cycle, grace, and the final "Offer" button.
  After offering: detail page with "Copy payment link" (a locale select, es/en/pt, defaulting
  to the customer's account locale; URL shown once, with expiry),
  "Regenerate link", "Revoke link", "Withdraw offer", "Lower the price" (only when `ACTIVE`),
  "Retry applying" and "Abandon decrease" (only while a version is `APPLYING`, AC-8.12; on
  `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` "Retry applying" shows the provider amount and asks to
  confirm the re-send, AC-8.17),
  "Realign children" (only when the detail reports a child that disagrees with
  `mapPayerStatus`, AC-6.12), and "End agreement" (scheduled or immediate, D14). The admin
  subscription detail of a payer or child shows its write actions only to users holding
  `BILLING_MANAGE_AGREEMENTS` (D25, AC-10.3).
- **Customer, My account**: an "Agreed plan" card at the top of
  `/{lang}/mi-cuenta/suscripcion/` (client island; the page stays session-blind):
  OFFERED (summary, "Authorize", or the blocking list with "contact us" when AC-3.7 applies),
  OFFERED with "Authorize" disabled when `authorize.allowed` is false (the reason's copy; for
  `AGREEMENT_PREVIOUS_NOT_ENDED`, "available after <end date of the current agreement>"),
  OFFERED with a pending payer ("Continue to MercadoPago", which returns the same checkout URL,
  plus the masked declared email from `payer.declaredPayerEmailMasked` of
  `GET .../agreements/mine`; the public link page never shows it, AC-4.5), "processing" on a
  409 `PREVIOUS_ATTEMPT_IN_PROGRESS`/`_CLOSING` (client rule of AC-3.3),
  ACTIVE (verticals, price, cycle, next charge, payment status, "Cancel agreement" with the
  end date from the cancellation preview; while `pendingVersion` is set, the new price is shown
  as being applied, `billing.agreements.card.PENDING_PRICE`, AC-3.16), GRACE_PERIOD and SUSPENDED
  (the same summary with the payment problem, and "Cancel agreement", whose preview says "ends
  now", AC-7.1; consumer law requires the button in every cancellable state). The card renders one block per entry of
  `GET .../agreements/mine` (at most two: an old agreement in `CANCEL_SCHEDULED` and a new
  `OFFERED` one, AC-3.11). Children are shown inside the card, not as separate cancellable
  subscriptions.
- **Customer, signed link**: `/{lang}/acuerdo/#t=<token>` renders a static shell; a client
  island reads the fragment, removes it (`history.replaceState`), POSTs it to resolve the
  summary, and shows "Authorize". Valid state content is fixed by D21: trade name, lines
  (vertical + private plan name), amount, cycle, link expiry date, "Authorize" (to
  MercadoPago), plus the optional empty "email you'll pay with" input (AC-4.18); never an email
  shown back, tax id, staff notes or entitlement detail. States: loading,
  valid, no longer valid (one generic message for expired/replaced/used/unknown, no agreement
  data, AC-4.10), blocked (from `POST /resolve` `state: 'BLOCKED'`, or a 409/422 from
  `POST /authorize`, AC-4.12; generic "contact Hospeda" copy per `blockedReason`, no blocking
  rows), processing (AC-3.3), provider error with retry. Return page `/{lang}/acuerdo/resultado/` is a static "we
  are confirming your payment" message; it is the single return destination of every
  `ACUERDO` authorization (My account, link and sweep, AC-3.13), and strips the
  `preapproval_id` MercadoPago appends (`history.replaceState`) without reading it.
- **Plans pages**: `PlanCardCta.client.tsx` renders, for the `AGREEMENT` situation, "Pending
  authorization of your agreement" or "Included in your agreed plan" by `agreementState`
  (AC-7.5), never a checkout button.
- **Errors**: typed codes per `apps/api/docs/error-contract.md`; admin maps `reason` to i18n;
  web shows friendly copy (every key is listed in "i18n keys" under API Design). **Loading**: skeletons; Authorize disables while in flight.
  **Accessibility**: WCAG 2.1 AA. **i18n**: es, en, pt; emails in the customer's locale.

### Out of Scope

- Everything in "Deferred to V2 (HOS-2226)" below.
- Add-ons on top of an agreement (D20); staff adds the benefit to the private plan instead.
- Staff courtesy on an agreement (D19, HOS-2226).
- Customer self-service plan changes inside an agreement.
- Per-vertical revenue attribution of the payer's payments in analytics (V2). Agreement
  revenue itself IS in scope as its own class `ACUERDO` (D23).
- A revenue dashboard over the `ACUERDO` facts (separate follow-up).
- MANUAL (non-card) agreements: the payer is always `CARD`. Action 6 stays as is.
- Standalone Partner card signup: HOS-2196 (reuses the signed link and the setting).
- Emailing the offer automatically: staff sends the link by their own channel.

### Deferred to V2 (HOS-2226)

Design preserved in `docs/full-design-pre-v1.md`.

- D3: closing prior subscriptions at authorization through S17/S18/S19 succession with
  children (`admitAgreementPredecessor`, `succeeded_by_id` release, retentions, the
  chargeback successor-cutter rule).
- D4: automatic compensation (`agreement_compensation`, `applyAgreementCompensation`,
  `agreement-compensation-sweep`, promo `origin = 'AGREEMENT'`, courtesy N months).
- D7: cancelling the replaced subscriptions' add-ons.
- D11: annual compensation block until `everyMonths: 12` pause/resume is measured.
- D12: composition change as a re-authorized version.
- D13: grace instead of `CHARGE_DECLINED` on a first decline after activation.
- Re-authorization flow (`REAUTHORIZATION` version kind, `closeSupersededPayer`).
- Courtesy pauses on the payer (staff courtesy and compensation), and S35 on agreements.

## Part 2: Technical Analysis

### Architecture

- **Pattern**: a payer row carries money; child PRINCIPALs carry capabilities. One
  propagation service is the only place that maps a payer transition to its children.
- **New modules**:
  - `packages/db/src/schemas/vertical/agreement.dbschema.ts` (`agreement`,
    `agreement_version`, `agreement_version_line`), `.../signed-action-link.dbschema.ts`,
    models under `packages/db/src/models/agreement/` (incl. `agreement-sweep.reads.ts`).
  - `packages/service-core/src/services/billing/agreement/`: `agreement-offer.service.ts`,
    `agreement-blockers.ts`, `private-plan.service.ts`, `authorize-agreement.service.ts`,
    `activate-agreement-payer.ts`, `propagate-payer-transition.ts`, `authorization-terms.ts`,
    `agreement-version-change.service.ts`, `agreement-end.service.ts`,
    `agreement-consistency-check.ts`, `agreement-errors.ts`.
  - `packages/service-core/src/services/billing/subscription/activate-pending-funnel.ts`
    (the single activation funnel).
  - `packages/service-core/src/services/billing/signed-link/signed-action-link.service.ts`.
  - `packages/schemas/src/api/billing/agreement*.schema.ts`.
  - API: `apps/api/src/routes/billing-agreement/{admin,protected,public}/`;
    cron `apps/api/src/cron/jobs/billing-agreement-consistency-check.job.ts` (M2, "Agreement
    consistency check job").
  - `packages/service-core/src/services/billing/subscription/authorization-return-url.ts`
    gains `buildAgreementReturnUrl` (AC-3.13).
  - Admin: `apps/admin/src/features/billing-agreements/` + routes under Billing.
  - Web: `apps/web/src/pages/[lang]/acuerdo/index.astro`, `.../acuerdo/resultado/index.astro`,
    `apps/web/src/components/billing/agreement/AgreementLink.client.tsx`,
    `.../AgreedPlanCard.client.tsx`.
- **Package boundaries**: everything lives on the billing side. `@repo/verticals` only gains
  `ACC_28` in `authorization/administrative-actions.ts` and never imports `@repo/db` (G14
  untouched).
- **PRIVATE filtering scope**: only SELLABLE LISTINGS filter out PRIVATE versions (public
  catalog, current sellable versions, trial ratchet, VIP pick, subscribe destination, plan
  migration options, cycle price, partner setup). By-id reads never filter: a child's
  coverage resolves its anchored private version by id, and Tourist VIP inheritance reads
  `findPlanVersion({ id })` (`packages/verticals/src/effective-set/tourist-vip-inheritance.ts:36`)
  to check `inherits_tourist_vip`; filtering there would throw
  `UnresolvedCoverageSourceError` for every child.

```mermaid
sequenceDiagram
  participant S as Staff (admin)
  participant API
  participant C as Customer
  participant MP as MercadoPago
  S->>API: offer agreement (ACC_28), verticals free
  C->>API: authorize (My account or signed link)
  API->>API: re-check blockers; tx: payer PENDING + children PENDING
  API->>MP: POST /preapproval (amount, everyMonths, no start_date)
  C->>MP: checkout
  MP-->>API: authorized (webhook / read / S3 / credited-pending)
  API->>API: funnel -> activateAgreementPayer: payer + children ACTIVE (S41)
  MP-->>API: first payment credited (on the payer)
  API->>API: CoverageChangedEvent per child vertical
```

### Data Model Changes

All structural changes go in Drizzle migration **0225** (`pnpm db:generate`). The new
permission value goes in its own migration **0226** (pattern
`0223_hos1612_migrate_plan_permission.sql`: `ALTER TYPE ... ADD VALUE` cannot share a
transaction with its use). Triggers go in extras **058-060**. The role grant goes in seed
data-migration **0177** (pattern `0176-hos1612-migrate-plan-permission.ts`).

| Table | Change | Carril |
|---|---|---|
| `plan` | `visibility` + CHECKs + `uq_plan_id_visibility` | 0225 |
| `plan_version` | `visibility` + composite FK + unique + rank index change | 0225 |
| `plan`, `plan_version` | visibility immutable; `billing_option` insert refused on PRIVATE | extras 058 |
| `agreement`, `agreement_version`, `agreement_version_line` | new | 0225 |
| `agreement_version`, `agreement_version_line` | terms immutable | extras 059 |
| `signed_action_link` | new | 0225 |
| `subscription` | class `ACUERDO`, method `AGREEMENT`, `payer_subscription_id`, `agreement_version_id`, CHECKs, indexes | 0225 |
| `subscription`, `provider_link` | agreement shape triggers | extras 060 |
| `reconciliation_mark` | `ck_reconciliation_mark_reason` regenerated with MOT:25-29 (it is built from `RECONCILIATION_MARK_REASONS` through `quotedList`, `reconciliation-mark.dbschema.ts:46-48`, so `db:generate` emits the drop and re-add) | 0225 |
| `domain_event` | `DOMAIN_EVENT_TYPES` (`domain_event.dbschema.ts:68-105`) gains `agreement_version.failed` (AV7, M4), so `domain_event_event_type_check` (`:197-200`, built from the list) is regenerated | 0225 |
| `permission_enum` | `billing.manageAgreements` | 0226 |
| `role_permission` | SUPER_ADMIN grant | seed 0177 |
| `platform_settings` | keys `billing.partnerCardCharging`, `billing.agreementDefaults` (rows written by the app) | none |

**Room for V2 (not added now)**: `agreement_version.change_kind` gains `REAUTHORIZATION`;
table `agreement_compensation`; `promo_code.origin`; `COURTESY_CLOSE_REASONS` gains
`SUCEDIDA_POR_ACUERDO`; `ck_subscription_agreement_child` drops its `succeeds_id IS NULL`
clause so children can succeed predecessors. Each is an additive change on top of V1.

#### `plan` (modify; `plan-catalog.dbschema.ts`)

- `visibility varchar(16) NOT NULL DEFAULT 'PUBLIC'`; `ck_plan_visibility`:
  `visibility IN ('PUBLIC','PRIVATE')`; `ck_plan_private_has_no_role`:
  `visibility = 'PUBLIC' OR role IS NULL`.
- `uq_plan_id_visibility UNIQUE (id, visibility)`.
- Immutable: extras `058-plan-visibility-immutability.trigger.sql`, same shape as
  `045-plan-role-immutability.trigger.sql`.

#### `plan_version` (modify)

- `visibility varchar(16) NOT NULL DEFAULT 'PUBLIC'`, copied from its plan.
- `fk_plan_version_plan_visibility`: `(plan_id, visibility) -> plan(id, visibility)`.
- `uq_plan_version_id_visibility UNIQUE (id, visibility)` (target for lines).
- `uq_plan_version_sellable_current_rank` recreated with
  `WHERE sellable AND current AND visibility = 'PUBLIC'`; private versions store `rank = 0`.
- Extras 041 (`plan-catalog-immutability`) must cover `visibility`; extras 058 also rejects
  the change (tested).
- Extras 058 adds `reject_billing_option_on_private_version` (BEFORE INSERT on
  `billing_option`). With `fk_subscription_billing_option_version`, no CARD or MANUAL
  PRINCIPAL can anchor a private version.

#### Private plan fields (`private-plan.service.ts`, AC-2.1, AC-2.7 to AC-2.9)

`plan_version` requires `trial_days NOT NULL` and `allows_pause NOT NULL`, carries
`grace_days` (default 10) and `inherits_tourist_vip` (`plan-catalog.dbschema.ts:104-116`), and
a metered entitlement carries `plan_quota` and `trial_quota` together
(`plan-catalog.dbschema.ts:159-161`, `ck_plan_version_entitlement_quotas_together`). Agreements
have no trial (the trial is Hospeda's state machine and children never run it) and no pause
(D15), so:

| Column | Rule | Value |
|---|---|---|
| `plan.vertical` | from the request; must equal the base version's vertical (else 422 `PRIVATE_PLAN_BASE_VERTICAL_MISMATCH`) | |
| `plan.slug` | editable, required; unique per vertical (`uq_plan_vertical_slug`, `plan-catalog.dbschema.ts:62`); 23505 -> 409 `PRIVATE_PLAN_SLUG_TAKEN` | |
| `plan.name` | editable, required (shown on the link page, D21) | |
| `plan.description` | copied from the base plan, editable | |
| `plan.pricing_order` | fixed | `0` |
| `plan.role` | fixed | `NULL` (`ck_plan_private_has_no_role`) |
| `plan.visibility`, `plan_version.visibility` | fixed | `PRIVATE` |
| `plan_version.rank` | fixed | `0` (outside the rank index) |
| `plan_version.sellable` | fixed | `true` (sellable means "selectable by the wizard"; public listings filter PRIVATE) |
| `plan_version.current` | fixed | `true` (previous current flipped, below) |
| `plan_version.trial_days` | fixed | `0` |
| `plan_version.allows_pause` | fixed | `false` |
| `plan_version.grace_days` | copied from the base version, not editable | ignored inside an agreement (D9: `agreement_version.grace_days` governs) |
| `plan_version.inherits_tourist_vip` | copied from the base version, editable | |
| `plan_version_entitlement.key`, `.plan_quota` | copied from the base version, editable (add, remove, change the quota); keys validated against `catalog_key` (G3) | |
| `plan_version_entitlement.trial_quota` | fixed | `0` for a metered entitlement, `NULL` for a boolean one |
| `plan_version_limit.key`, `.value` | copied from the base version, editable | |

- **Base version**: any version (current or not) of a plan with `role IS NULL` in the same
  vertical, PUBLIC or PRIVATE. A trial, pre-trial or floor plan is refused (422
  `PRIVATE_PLAN_BASE_HAS_ROLE`): a trial plan's entitlements are derived, never stored
  (`plan-publication.service.ts:145-147`). Unknown base id -> 404.
- **Request schemas are closed** (`z.strictObject`): `trialDays`, `allowsPause`, `graceDays`,
  `rank`, `sellable` and `trialQuota` are not accepted (400), so the fixed values cannot be
  overridden.
- **Versioning**: `POST /private-plans/:planId/versions` (`{ basePlanVersionId?, entitlements,
  limits, inheritsTouristVip }`; without a base it starts from the plan's current version)
  follows `publishPlanVersion` (`plan-publication.service.ts:110-130`): in ONE transaction,
  first `SELECT ... FROM plan WHERE id = :planId FOR UPDATE` (seventh review minor 5: two
  concurrent publishes serialize on it, AC-2.10; a residual 23505 on
  `uq_plan_version_one_current_per_plan`, `plan-catalog.dbschema.ts:128`, maps to 409
  `PRIVATE_PLAN_CONCURRENT_PUBLISH`), then
  `UPDATE plan_version SET current = false WHERE plan_id = :planId AND current`, then insert
  the new version `current = true` with its entitlements and limits
  (`uq_plan_version_one_current_per_plan` allows one current per plan). It does NOT call
  `publishPlanVersion` (action 18's writer, gated by `requirePlanPublisher`,
  `plan-publication.service.ts:49`; ACC_18 refuses PRIVATE, see "Permissions"); it is
  ACC_28's own writer with the same order. Children and offered lines keep the version they
  name (versions are immutable, extras 041). A PUBLIC or unknown `planId` -> 404.
- **GET `/private-plans?vertical=`** -> `{ plans: [{ planId, vertical, slug, name,
  currentVersion: { planVersionId, createdAt, inheritsTouristVip, entitlements: [{ key,
  planQuota }], limits: [{ key, value }] }, liveAgreementCount }] }` (closed schema,
  `liveAgreementCount` = agreements `OFFERED` or `ACTIVE` with a line on any version of the
  plan).
- **Errors**: 400 closed-schema violation; 404 base, plan; 409 `PRIVATE_PLAN_SLUG_TAKEN`,
  `PRIVATE_PLAN_CONCURRENT_PUBLISH` (versions only); 422
  `PRIVATE_PLAN_BASE_VERTICAL_MISMATCH`, `PRIVATE_PLAN_BASE_HAS_ROLE`, and `VALIDATION_ERROR`
  for an unknown catalog key or a negative quota/value.

#### `agreement` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_user_id` | uuid NOT NULL FK `users.id` | |
| `trade_name` | varchar(120) NOT NULL | the customer's trade name (nombre comercial), entered by staff; shown on the link page (D21) and used as the agreement name in emails (D22). No `users` column holds a trade name today (only `display_name`, `user.dbschema.ts:90`). Set at offer; V1 exposes no edit. |
| `status` | varchar(16) NOT NULL | `OFFERED`, `ACTIVE`, `ENDED`, `WITHDRAWN` |
| `end_reason` | varchar(32) NULL | `CUSTOMER_CANCELLED`, `STAFF_CANCELLED`, `ARREARS`, `CHARGEBACK`, `REVOKED`, `PROVIDER_CANCELLED`, `FIRST_CHARGE_DECLINED`, `WITHDRAWN` |
| `ended_at` | timestamptz NULL | |
| `internal_notes` | text NULL | staff only; at most 2000 characters (request Zod, `AgreementCreateRequestSchema`) |
| `created_by` | uuid NOT NULL FK `users.id` | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

- `ck_agreement_status`, `ck_agreement_end_reason` (closed lists); `ck_agreement_end_pair`:
  `(status IN ('ENDED','WITHDRAWN')) = (ended_at IS NOT NULL) AND (ended_at IS NULL) = (end_reason IS NULL)`.
- `uq_agreement_one_offered_per_customer UNIQUE (customer_user_id) WHERE status = 'OFFERED'`.
- `uq_agreement_one_active_per_customer UNIQUE (customer_user_id) WHERE status = 'ACTIVE'`.
  One ACTIVE and one OFFERED may coexist only for the end-and-recreate sequence (D14); the
  service also requires the ACTIVE one's payer to be `CANCEL_SCHEDULED` before offering.
- An abandoned or declined-while-pending attempt does not end an `OFFERED` agreement; the
  customer may authorize again (a declined payer's still-live preapproval is cancelled first,
  authorization step 2b, AC-5.6).

#### `agreement_version` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `agreement_id` | uuid NOT NULL FK | |
| `version_number` | integer NOT NULL | 1, 2, ... |
| `amount_minor` | integer NOT NULL | ARS centavos per charge (monthly price, or the annual amount) |
| `currency` | varchar(3) NOT NULL DEFAULT 'ARS' | |
| `cycle` | varchar(16) NOT NULL | `monthly` (everyMonths 1), `annual` (everyMonths 12) |
| `grace_days` | integer NOT NULL | D9 |
| `change_kind` | varchar(16) NOT NULL | `INITIAL`, `DECREASE` |
| `status` | varchar(16) NOT NULL | `OFFERED`, `APPLYING`, `ACTIVE`, `SUPERSEDED`, `WITHDRAWN`, `FAILED`, `ENDED` |
| `activated_at`, `closed_at` | timestamptz NULL | written by the AV transitions (rule under the AV table) |
| `created_by` | uuid NOT NULL FK | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

- `uq_agreement_version_number UNIQUE (agreement_id, version_number)`.
- `ck_agreement_version_kind_status`: `INITIAL` never `APPLYING`; `DECREASE` never `OFFERED`.
- `ck_agreement_version_closed_at`: `(status IN ('SUPERSEDED','WITHDRAWN','FAILED','ENDED')) =
  (closed_at IS NOT NULL)`; `ck_agreement_version_activated_at`: `(status IN
  ('ACTIVE','SUPERSEDED','ENDED')) = (activated_at IS NOT NULL)` (`SUPERSEDED` and `ENDED` are
  reached only from `ACTIVE`; `WITHDRAWN` and `FAILED` never were active). Both in 0225; they
  pin the AV timestamp rule.
- `uq_agreement_version_one_offered ... WHERE status = 'OFFERED'`,
  `uq_agreement_version_one_applying ... WHERE status = 'APPLYING'`,
  `uq_agreement_version_one_active ... WHERE status = 'ACTIVE'` (all on `agreement_id`; the last
  one is the DB half of "an `ACTIVE` agreement has exactly one `ACTIVE` version", "Lock order").
- `ck_agreement_version_amount`: `amount_minor BETWEEN 1500 AND 200000000`. These literals
  mirror `PROVIDER_AMOUNT_FLOOR_MINOR` (`promo/provider-amount-floor.ts:9`) and
  `PROVIDER_AMOUNT_CEILING_MINOR` (`:15`); a unit test asserts the migration SQL and the
  constants agree. Service code always uses the constants.
- `ck_agreement_version_currency` (`'ARS'`), `_cycle`, `_grace_days` (`>= 0`), closed lists;
  `ck_agreement_version_grace_below_cycle`: `(cycle = 'monthly' AND grace_days < 28) OR
  (cycle = 'annual' AND grace_days < 365)`, literals mirroring `AGREEMENT_CYCLE_MIN_DAYS`
  (asserted by the same SQL-versus-constants unit test as the amount bounds).
- Extras `059-agreement-version-immutability.trigger.sql`: an UPDATE may change only
  `status`, `activated_at`, `closed_at`, `updated_at`; DELETE refused.

#### `agreement_version_line` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `agreement_version_id` | uuid NOT NULL FK | |
| `vertical` | varchar(32) NOT NULL FK `verticals.id` | |
| `plan_version_id` | uuid NOT NULL | |
| `plan_visibility` | varchar(16) NOT NULL DEFAULT 'PRIVATE' | constant, exists for the FK |

- `uq_agreement_version_line_vertical UNIQUE (agreement_version_id, vertical)`.
- `fk_agreement_line_version_vertical`: `(plan_version_id, vertical) -> plan_version(id, vertical)`;
  `fk_agreement_line_version_visibility`: `(plan_version_id, plan_visibility) -> plan_version(id, visibility)`;
  `ck_agreement_line_private`: `plan_visibility = 'PRIVATE'`.
- Extras 059 refuses UPDATE and DELETE on lines.

#### `signed_action_link` (new, generic; HOS-2196 reuses it)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `purpose` | varchar(32) NOT NULL | `AGREEMENT_AUTHORIZATION` |
| `token_hash` | char(64) NOT NULL UNIQUE | hex SHA-256 of the token |
| `customer_user_id` | uuid NOT NULL FK `users.id` | the account the payment is bound to |
| `agreement_version_id` | uuid NULL FK | subject for `AGREEMENT_AUTHORIZATION` |
| `expires_at` | timestamptz NOT NULL | |
| `locale` | varchar(2) NOT NULL | `es`, `en`, `pt` (`ck_signed_action_link_locale`); staff's pick, default the customer's account locale; used in the link URL and the return URL (AC-3.13) |
| `consumed_at`, `consumed_subscription_id` | timestamptz / uuid NULL | the payer the link LAST reached through a LINK authorize (created, reused, re-minted or replaced; rule below, AC-4.8, AC-4.11); `consumed_at` keeps the first consumption |
| `revoked_at`, `revoke_reason` | timestamptz / varchar(16) NULL | `REGENERATED`, `VERSION_CLOSED`, `STAFF_REVOKED`, `ACTIVATED` (a consumed link of a version that activated, AC-4.15) |
| `created_by`, `created_at` | | |

- `ck_signed_action_link_purpose`; `ck_signed_action_link_agreement_subject`;
  `ck_signed_action_link_consumed_pair`, `_revoked_pair`.
- `uq_signed_action_link_open_agreement_version UNIQUE (agreement_version_id) WHERE purpose = 'AGREEMENT_AUTHORIZATION' AND revoked_at IS NULL AND consumed_at IS NULL`.
- Token: 32 random bytes (`randomBytes`), base64url. Only the hash is stored; no secret, so
  **no new env var**.
- "Single use" (fifth review minor 1): a link is consumed by its first LINK authorize and never
  inserts a fresh payer afterwards (step 5 is reachable only for an unconsumed link, AC-4.14
  row 6). A consumed link resolves to the version's live payer while it is
  `PENDING_AUTHORIZATION` (row 8: reuse, re-mint or replacement, each recorded by the rule below),
  whichever path created that payer; it answers 410 `USED` once the version has no live payer
  (row 6) or its live payer is past pending (row 4). AC-4.5 and AC-4.8 follow this.
- **Regenerate (M1, D2).** `issue` revokes with `REGENERATED` EVERY link of the version whose
  `revoked_at IS NULL`: the open one AND every consumed one (its payer pending or already
  abandoned), not only the open one. Without it a consumed link whose payer is still pending
  would keep returning the checkout after a regeneration, against D2.
- **Resolve order (M1).** `resolve` (and the public authorize) evaluate the nine-row total
  order of AC-4.14 and stop at the first hit: 404 unknown; 410 revoked (`REGENERATED` ->
  `REPLACED`, `STAFF_REVOKED` -> `REVOKED`, `VERSION_CLOSED` -> `VERSION_CLOSED`, `ACTIVATED`
  -> `USED`); 410 `EXPIRED`; 410 `USED` for a consumed link whose version has a payer in a
  NON-pending live state (the earlier text matched "any live payer" through
  `uq_subscription_live_payer_per_version`, which includes `ACTIVE`,
  `subscription.dbschema.ts:44-51`, so a consumed link kept resolving after activation); 410
  `VERSION_CLOSED` when the version or the agreement is not `OFFERED`; 410 `USED` for a
  consumed link with no live payer; `BLOCKED`; `CHECKOUT_PENDING` (payer
  `PENDING_AUTHORIZATION`); `AUTHORIZABLE`. The closed `cause` set is
  `REPLACED | EXPIRED | USED | VERSION_CLOSED | REVOKED`.
- **Revocation at activation (M1).** `activateAgreementPayer` revokes, in its transaction,
  every link of the version whose `revoked_at IS NULL`: open links with `VERSION_CLOSED`,
  consumed links with `ACTIVATED` (AC-4.15). Staff revoke (`DELETE /:id/payment-link`,
  `STAFF_REVOKED`) likewise revokes every non-revoked link of the offered version, open and
  consumed (AC-4.16), like `issue` does with `REGENERATED`.
- **Which payer a link records (M3; the single rule, referenced elsewhere).** Every LINK
  authorize that ends at a payer writes, in its step 4/5 transaction, the link's
  `consumed_subscription_id` = that payer: the inserted payer (step 5), the reused payer
  (step 4 reuse; an OPEN link is consumed then, recording the reused payer, and `consumed_at`
  is set), the same payer after a re-mint, or the NEW payer of a `CREATION_NOT_APPLIED`
  replacement. `consumed_at` is set only when NULL. A SESSION authorize never touches a link,
  so a My-account replacement leaves the link on the old payer. Chosen over a second column
  (for example `last_subscription_id`): the column is read only by the AC-4.8 email decision,
  and `ck_signed_action_link_consumed_pair` stays satisfied.
- Reuse versus a changed payer email: `resolveLiveCommitmentReuse`
  (`resolve-live-commitment.ts:131-150`) answers `REPLACE` on a changed email. Agreements use
  their own `resolveAgreementPayerReuse` (check order in authorization step 4: in-flight key and
  expired window refuse first): while the payer is pending with an applied
  creation, any authorize call (session or link, any email) returns the stored checkout URL
  (the protected response adds the masked declared email; the public one carries no email,
  AC-4.5); a rejected creation is re-minted on the same payer, as S1
  does with `RECREATE`. Replacing from a second browser would cancel a checkout someone may
  be completing.
- `CREATION_NOT_APPLIED` (the provider created a preapproval whose fields differ from the
  request, so a `provider_link` exists but there is no checkout URL;
  `start-subscription.service.ts:282-300`, `resolve-live-commitment.ts:190-192`): the next
  authorize call REPLACES the payer, mirroring S1's S39. A re-mint on the same row is not
  possible: `uq_provider_link_subscription` (`provider-link.dbschema.ts:25`) makes the link
  1:1 with the subscription and the link has no close column, and S1 itself abandons the
  whole row on `REPLACE` (`start-subscription.service.ts:372`, `replacePendingAttempt`;
  `ATTEMPT_REPLACED` in `before-cancel-notice-kinds.ts`). In ONE transaction: abandon the old
  payer and its children (S39 payer variant, S42) with `recordProviderCancellationDecided`
  (`S39`), then insert a new payer and children and a new `PREAPPROVAL_CREATE` key (on the
  LINK path the link records the new payer, rule above). The
  partial uniques allow it because they cover only LIVE rows and the old rows are written
  `ABANDONED` first in the same transaction (`uq_subscription_live_payer_per_version`, INV:8).
  After commit, cancel the divergent preapproval (`cancelOurAuthorization`, kind
  `ATTEMPT_REPLACED`); a failed cancel is retried by `our-cancellation-retry` and H-7, as in
  S39. Then run the provider phase for the new payer. Chosen over UPDATE-ing the link's
  `provider_id`: that would need a new model method that rewrites an identity column the rest
  of billing treats as immutable, and it would leave the abandoned preapproval with no row to
  hang its cancellation decision on.

#### `subscription` (modify; `subscription.dbschema.ts`)

- `SUBSCRIPTION_CLASSES` gains `ACUERDO` (`:33`); `SUBSCRIPTION_PAYMENT_METHODS` gains
  `AGREEMENT` (`:21`).
- New columns: `payer_subscription_id uuid NULL` FK self; `agreement_version_id uuid NULL` FK
  (on the payer; it moves only on a DECREASE).
- CHECK changes:
  - `identity_not_null` (`:149-152`): `class = 'LAPIDA' OR (user_id IS NOT NULL AND payment_method IS NOT NULL AND (vertical IS NOT NULL OR class = 'ACUERDO'))`.
  - `principal_anchor` (`:153-156`): `class <> 'PRINCIPAL' OR (plan_version_id IS NOT NULL AND (billing_option_id IS NOT NULL OR payment_method = 'AGREEMENT'))`.
  - New `ck_subscription_agreement_child`: `(payment_method = 'AGREEMENT') = (payer_subscription_id IS NOT NULL)`
    and `payment_method <> 'AGREEMENT' OR (class = 'PRINCIPAL' AND billing_option_id IS NULL AND succeeds_id IS NULL AND succeeded_by_id IS NULL AND authorization_window_ends_at IS NULL)`.
    V1 children never take part in a succession and carry no window (the payer does).
  - New `ck_subscription_payer_shape`: `class <> 'ACUERDO' OR (vertical IS NULL AND plan_version_id IS NULL AND billing_option_id IS NULL AND payment_method = 'CARD' AND payer_subscription_id IS NULL AND succeeds_id IS NULL AND succeeded_by_id IS NULL)`.
  - New `ck_subscription_agreement_version_owner`: `(class = 'ACUERDO') = (agreement_version_id IS NOT NULL)`.
- Indexes: `idx_subscription_payer`; `uq_subscription_live_payer_per_version UNIQUE (agreement_version_id) WHERE class = 'ACUERDO' AND status IN (<LIVE>)`.
- INV:8 indexes unchanged (`:183-192`). A child (succeeds_id NULL) occupies
  `uq_subscription_commitment_origin` for `(user, vertical)` (`:183-187`, filtered
  `succeeds_id IS NULL`), so a child and another live ORIGIN PRINCIPAL in the same vertical cannot
  coexist, and a 23505 there maps to `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION`. V1-a is only
  PARTLY DB-backed: a live successor PRINCIPAL (succeeds_id NOT NULL, never cleared) sits in
  `uq_subscription_commitment_successor` (`:188-192`) instead, so the DB admits it next to a
  child. The enforcing check is `findAgreementBlockers` (any live PRINCIPAL whatever its
  `succeeds_id`, at offer and at authorize step 3), and after activation S1's
  `VERTICAL_IN_AGREEMENT` and the succession-admission refusal keep a successor from starting
  (refusal table).
- Extras `060-subscription-agreement-shape.trigger.sql`: on `subscription` with method
  `AGREEMENT`, the payer exists, is `ACUERDO`, same `user_id`, and the child's version is
  PRIVATE; a non-AGREEMENT PRINCIPAL never anchors a PRIVATE version; BEFORE INSERT on
  `provider_link` refuses an AGREEMENT subscription (AC-6.5).

#### Money on the payer, coverage per child

`subscription-sources.ts:99-164`: a SUBSCRIPTION source's `until` depends on the row's own
status and `service_ends_at` (`untilOf`, `:58-81`); `charged` is
`hasCreditedPayment(row.id)`. Payments, `covered_period` and receipts hang from the payer.
Change: `charged = hasCreditedPayment(row.payerSubscriptionId ?? row.id)`; `until` stays per
child (kept in sync by propagation).

#### Settings (no migration; `platform_settings`)

Two keys in `PlatformSettingsKeySchema` and the upsert union in
`platform-settings.service.ts`, read with `BILLING_SETTINGS_VIEW` and written with
`BILLING_MANAGE_AGREEMENTS` (new cases in `requiredWritePermission`, `:90`). ADMIN holds
`BILLING_SETTINGS_WRITE` (`rolePermissions.seed.ts:758-759`), so that permission is not
enough for D6's SUPER_ADMIN-only rule (AC-9.3).

- `billing.partnerCardCharging`: `{ enabled: boolean }`, absent = `false`.
- `billing.agreementDefaults`: `{ defaultGraceDays: int >= 0 (10), maxChargeMinor: int PROVIDER_AMOUNT_FLOOR_MINOR..PROVIDER_AMOUNT_CEILING_MINOR (default the ceiling), linkExpiryDays: int 1..60 (14), applyingStaleHours: int 1..168 (24) }` (Zod imports the constants; `applyingStaleHours` drives AC-8.9).
- **Cycle-length constants (D17, AC-1.8).** `AGREEMENT_CYCLE_MIN_DAYS = { monthly: 28, annual:
  365 } as const` in `@repo/schemas` (next to the agreement schemas), the SHORTEST possible
  length of each cycle (February; a non-leap year), so "grace shorter than the cycle" holds for
  every real period. Rule: `grace_days < AGREEMENT_CYCLE_MIN_DAYS[cycle]` (monthly at most 27,
  annual at most 364). The wizard, the create and version schemas and `publishAgreementVersion`
  read this one constant; `defaultGraceDays` is not checked against it (it is a default the
  wizard prefills, and the submit validates).

#### Reconciliation mark reasons (MOT:25-29)

The catalog is closed and named in Spanish (`RECONCILIATION_MARK_REASONS`,
`reconciliation-mark-reasons.ts:2-27`, last entry `IMPORTE_COBRADO_DE_MAS` = MOT:24), so the
agreement reasons follow that language. They are appended in order (the catalog is "ordered by
catalog number") with entries in `RECONCILIATION_MARK_REASON_CATALOG` (`:44-99`). Every mark is
opened through S14 `openReconciliationMark`
(`reconciliation/open-reconciliation-mark.service.ts:76`) with `subject: { kind:
'SUBSCRIPTION', subscriptionId }`; none uses `addon_instance_id`
(`ck_reconciliation_mark_instance_only_for_order` keeps it for MOT:23 only).

| MOT | Reason | Subject `subscription_id` | `refundConfirmation` | `defaultProposal` | Opened by |
|---|---|---|---|---|---|
| 25 | `HIJA_DE_ACUERDO_DESALINEADA` | the mismatched CHILD (one mark per child) | `false` | `NONE` | propagation (rule 1) and the consistency job (AC-6.4, AC-6.8); lifted by the realign act (AC-6.12) or opened-and-lifted by a terminal staff act that forces the child (AC-6.13) or by the job forcing a live child of a terminal payer (AC-6.14, `liftedBy = SYSTEM_USER_ID`) |
| 26 | `ACTIVACION_SOBRE_VERSION_CERRADA` | the PAYER | `true` | `REFUND` | `activateAgreementPayer` closed-version guard; every credited payment of the payer is hung on it (AC-5.5) |
| 27 | `VERSION_DE_ACUERDO_SIN_APLICAR` | the PAYER | `false` | `NONE` | a `DECREASE` whose outcome is unknown at publish (AC-8.14), and the consistency job for a stale `APPLYING` version (AC-8.9); lifted on every exit from `APPLYING` ("Lifting MOT:27") |
| 28 | `ADDON_SOBRE_HIJA_DE_ACUERDO` | the CHILD whose vertical the add-on targets | `false` | `NONE` | the consistency job, when a live `VERTICAL_SUBSCRIPTION`/`LISTING` add-on targets a child vertical (D20) |
| 29 | `VIP_TURISTA_DUPLICADO_POR_ACUERDO` | the non-agreement `PRINCIPAL` whose plan version inherits VIP | `false` | `NONE` | the consistency job's check (e), when the D26 refusal and the D18 authorize check raced (AC-6.18); no existing reason fits (`COBRO_DUPLICADO`, MOT:20, is one charge credited twice) |

API reasons stay English like every error reason; only the marks are Spanish. The earlier
reason `AGREEMENT_CHILD_STATE_MISMATCH` is retired (no act refuses for drift, AC-6.8, AC-6.13).

Everything that must move with the catalog (frozen counts recounted, never a new guard):

- `packages/db/test/reconciliation-mark-reasons.test.ts:8-13` (`toHaveLength(24)` and the
  contiguous `1..24` -> 29), `:16-22` (refund confirmations `[1, 2, 3, 7, 12, 15, 20, 23, 24]`
  gain `26`; the title "nine" -> "ten"), `:36-41` (defaults `{ REFUND: 8, NONE: 14, NO_REFUND:
  1, REFUND_DIFFERENCE: 1 }` -> `{ REFUND: 9, NONE: 18, NO_REFUND: 1, REFUND_DIFFERENCE: 1 }`).
- The `@repo/schemas` copy `RECONCILIATION_MARK_REASON_VALUES`
  (`api/billing/reconciliation-mark-vocabulary.ts:5-30`), held equal by
  `packages/db/test/reconciliation-mark-vocabulary-parity.test.ts`.
- Compile-enforced records keyed by the reason: the admin labels
  (`apps/admin/src/features/billing-reconciliation/reconciliation-labels.ts:14`, plus the
  `admin-billing.reconciliationMarks.reasons.*` keys in `packages/i18n` es/en/pt) and the
  summary copy (`packages/notifications/src/templates/billing/reconciliation-summary-enrichment.ts:96`).
- `packages/db/test/integration/reconciliation-mark-from-empty.test.ts:114` (CHECK literals
  equal the list; passes once 0225 regenerates the CHECK) and
  `packages/service-core/test/services/billing/reconciliation/actionable-marks.test.ts:9`
  (`it.each` over the reasons, picks up the new ones).
- The "MOT:1–MOT:24" docblocks (`reconciliation-mark.dbschema.ts:19`,
  `reconciliation-mark-reasons.ts:1,29,32,40,44`, `reconciliation-mark-vocabulary.ts:31`) ->
  "MOT:1–MOT:29".
- `scripts/check-reconciliation-mark-discipline.ts` (G-R1-F) reads the catalog from its AST and
  requires catalog literals at every S14 call: the new call sites pass the literals.
- `04-catalogos.md` gains MOT:25-29.

**Migrations needed**: 0225, 0226, extras 058-060, seed 0177. `b3-schema-from-empty.test.ts`
builds from empty with all of them; `check-catalog-sql` (G18) stays green.

### State machines

#### Agreement

| Id | From | To | Trigger |
|---|---|---|---|
| AG1 | (none) | OFFERED | staff offers (ACC_28) |
| AG2 | OFFERED | ACTIVE | its version's payer activated |
| AG3 | OFFERED | WITHDRAWN | staff withdraws before any activation (a live pending payer is abandoned first, AC-8.6) |
| AG4 | ACTIVE | ENDED | the payer of the `ACTIVE` version reaches `CANCELLED` or `CHARGE_DECLINED` (`end_reason` from the cause); run only by the propagation (rule 8 of "Propagation design"). Same transaction (the writer took the agreement lock first, "Lock order"): the `APPLYING` version, if any -> `FAILED` (AV7, recorded `agreement_version.failed`; an open MOT:27 lifted, "Lifting MOT:27"), active version -> `ENDED` (AV8), any non-revoked link revoked `VERSION_CLOSED` (AC-6.9). No `OFFERED` version can exist under an `ACTIVE` agreement (`ck_agreement_version_kind_status`), so AG4 has no withdraw step. |

AG2 never meets another `ACTIVE` agreement of the same customer: authorize refuses while any
other agreement is not `ENDED`/`WITHDRAWN` (AC-3.9), so `uq_agreement_one_active_per_customer`
cannot raise at activation.

`end_reason` derivation (AG4 and AG3 must always write one, `ck_agreement_end_pair`):

| Payer transition that ends the agreement | `end_reason` |
|---|---|
| S12 after a customer S11 or customer cancel decision | `CUSTOMER_CANCELLED` |
| S12 after a staff S11 (`endAgreement` SCHEDULED, or an S11 a staff member performed on the payer through ACC_8, AC-7.9) | `STAFF_CANCELLED` |
| S12 after S7 -> `CANCEL_SCHEDULED` on a `cancelled` read, or after a scheduled end with no decision of ours | `PROVIDER_CANCELLED` |
| S12 chargeback | `CHARGEBACK` |
| Customer direct cancel from `GRACE_PERIOD`/`SUSPENDED` (`authority.as = 'OWNER'`) | `CUSTOMER_CANCELLED` |
| Staff direct cancel through ACC_8 (`authority.as = 'ADMIN'`, `cancel-direct-subscription.service.ts:264`, AC-7.9) | `STAFF_CANCELLED` |
| S51 | `STAFF_CANCELLED` |
| S36 | `REVOKED` |
| Provider cancel mirror while the payer is `SUSPENDED` for arrears | `ARREARS` |
| Provider cancel mirror otherwise | `PROVIDER_CANCELLED` |
| S16 after activation | `FIRST_CHARGE_DECLINED` |
| AG3 (withdraw) | `WITHDRAWN` |

S12 reads the payer's latest cancellation decision through
`reconciliationInventoryModel.findCancellationDecision`
(`reconciliation-inventory.model.ts:264-286`). Today it returns only
`{ eventId, transition, decidedAt }` (`CancellationDecision`, `:60-66`), so it must also select
and return `actorType` (`domain_event.actor_type`, `domain_event.dbschema.ts:175`, values
`owner | admin | job | provider`, `:112`). Mapping: `owner` -> `CUSTOMER_CANCELLED`; `admin` ->
`STAFF_CANCELLED`; no decision, `job` or `provider` -> `PROVIDER_CANCELLED`. S11 already records
`actor.type = authority.as === 'OWNER' ? 'owner' : 'admin'`
(`cancel-active-subscription.service.ts:268`), so an S11 performed by staff through ACC_8
(`administrative-actions.ts:84-87`, `BILLING_CANCEL_SUBSCRIPTION`) counts as `STAFF_CANCELLED`.
The other callers of `findCancellationDecision` (`live-preapproval-on-closed-row.ts:190,249`,
`reconciliation-sweep.service.ts:252`, `period-charges-comparison.ts:203`,
`cancellation-crossing-charge.ts:112`) ignore the new field.

#### Agreement version

| Id | From | To | Trigger |
|---|---|---|---|
| AV1 | (none) | OFFERED | staff publishes an INITIAL version |
| AV2 | (none) | APPLYING | staff publishes a DECREASE |
| AV3 | OFFERED | ACTIVE | its payer activated |
| AV4 | APPLYING | ACTIVE | `changeAmount` confirmed by a fresh read (at publish, through `POST .../apply`, through `POST .../abandon` when its read shows the new amount, AC-8.12, or by the stale-`APPLYING` check, AC-8.9) |
| AV5 | ACTIVE | SUPERSEDED | a DECREASE of the agreement becomes ACTIVE |
| AV6 | OFFERED | WITHDRAWN | staff withdraws or a newer INITIAL replaces it (never AG4: an `ACTIVE` agreement holds no `OFFERED` version) |
| AV7 | APPLYING | FAILED | the provider definitively refused `changeAmount` at publish (AC-8.13), staff abandons after a fresh read shows the OLD or a third amount (`POST .../abandon`, AC-8.12), or AG4 |
| AV8 | ACTIVE | ENDED | AG4 |

Timestamps (the single rule): every transition into a closed status (AV5 `SUPERSEDED`, AV6
`WITHDRAWN`, AV7 `FAILED`, AV8 `ENDED`) sets `closed_at = now`, and AV3 and AV4 set
`activated_at = now`; `ck_agreement_version_closed_at` and `ck_agreement_version_activated_at`
enforce it. AV5 and AV4 of one decrease use the SAME `now`, so the old version's `[.., closed_at)`
and the new one's `[activated_at, ..)` PERIOD windows ("Class gates", `expected-amount.ts`) are
contiguous and a charge after AV4 matches exactly one version.

Write order: the version partial uniques are not deferrable, so every write that retires one
row and promotes another updates the OLD row first. On a decrease: AV5 (old `ACTIVE` ->
`SUPERSEDED`) then AV4 (new `APPLYING` -> `ACTIVE`), then the payer's
`agreement_version_id`. On a replacing INITIAL: AV6 (old `OFFERED` -> `WITHDRAWN`) then AV1.
AG4 only closes rows, so its order is free. Any of these guarded writes that affects 0 rows
aborts the whole transaction ("Lock order").

#### Subscription: child transitions

Each is the propagated image of an existing payer transition and keeps that transition's
trigger class for `check-clock-transitions-never-grant`. Renumbered for V1 (no succession
rows).

| Id | Child from | Child to | Payer transition |
|---|---|---|---|
| S41 | PENDING_AUTHORIZATION | ACTIVE | activation (S2, S3 active read, credited-pending) |
| S42 | PENDING_AUTHORIZATION | ABANDONED | window expiry (S3), pending cancel (S40 payer variant, incl. withdraw/replace), activation over a closed version (AC-5.5) |
| S43 | PENDING_AUTHORIZATION, ACTIVE | CHARGE_DECLINED | S16 first charge declined (origins stay these two: S16 itself leaves only those payer states; a child in another live state is MARKED, and later written to `CHARGE_DECLINED` by the job or the realign act, AC-6.14, a `REALIGNS_CHILDREN` write, not an S43 propagation) |
| S44 | ACTIVE | GRACE_PERIOD | S4 (same grace clock) |
| S45 | GRACE_PERIOD | ACTIVE | S5 |
| S46 | ACTIVE, GRACE_PERIOD | SUSPENDED | S6 arrears, provider pause arrears, chargeback suspension |
| S47 | SUSPENDED | ACTIVE or CANCEL_SCHEDULED | S7 (`REACTIVATED { target }`; `service_ends_at` copied when the target is `CANCEL_SCHEDULED`) |
| S48 | ACTIVE | CANCEL_SCHEDULED | S11 (only from `ACTIVE`, `cancel-active-subscription.service.ts:223`), mirror of our cancellation on an active read (same `service_ends_at`) |
| S49 | any live | CANCELLED | S12, S12 chargeback, direct cancel (from `GRACE_PERIOD`/`SUSPENDED`), S36 revoke, S51 immediate end, provider cancel mirrors |
| S50 | CANCEL_SCHEDULED | CANCEL_SCHEDULED (`service_ends_at` moved) | crossing-charge extension (`SERVICE_END_MOVED`) |

New payer transitions (agreement-only, added to `04-catalogos.md` and
`transition-tables.json`):

| Id | Payer from | Payer to | Trigger |
|---|---|---|---|
| S51 | ACTIVE, GRACE_PERIOD, SUSPENDED, CANCEL_SCHEDULED | CANCELLED | staff ends an agreement IMMEDIATE (ACC_28): never refused for child drift (drifted live children are forced to `CANCELLED`, AC-6.13), the write with a recorded cancellation decision, then the provider cancel (S40/S36 pattern; `S51` joins `SALVEDAD_4_TRANSITIONS` in `provider-cancellation-decision.ts:23` so `our-cancellation-retry` retries it, and `BEFORE_CANCEL_KIND_BY_TRANSITION` (`our-cancellation-retry.ts:44-76`, typed `Record<ProviderCancellationTransition, ...>`, so it does not compile without it) gains `S51: 'DIRECT_CANCELLATION'`, the kind the first attempt uses); a charge credited after it hangs on MOT:2 (AC-5.9, crossing bullet of "Class gates"); no refund, no refund source read. Children follow S49. |
| S52 | ACTIVE (amount field only) | ACTIVE | agreement price decrease: the amount-mutation decision id for `recordAmountMutationDecided`. Both closed lists gain `'S52'`: the runtime `TRANSITIONS` tuple behind `z.enum(TRANSITIONS)` (`amount-mutation-decision.ts:17,20`) and the input type (`:42`); changing only the type would make the Zod parse reject `S52` at runtime. The decision's `changes` carry `{ field: 'agreement_version_id', new: <APPLYING version id> }`, so the amount retry can tell that its version later became `FAILED` (AC-8.12); the reader that returns it is specified in "Version changes and ending" (M4). Full path: `packages/service-core/src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decision.ts` (its port, `amount-mutation-decisions.port.ts`, and `amount-comparison.ts` sit in the same folder). |

Why S51 and not S36 or direct cancel: direct cancel only leaves `SUSPENDED`/`GRACE_PERIOD`
(`cancel-direct-subscription.service.ts:232`); S36 is the only `ACTIVE -> CANCELLED` today, but
it is action 8 "revocation", principal-only (`revocation-reading.ts:102`), does not leave
`SUSPENDED` (`REVOCATION_ORIGINS`, `:19`) and carries a refund preview and refund source
(`:8`, `:24-30`). The owner decided staff compensates by hand, so reusing S36 would either
refund automatically or need a "no refund" flag inside a revocation; a dedicated, small
agreement transition is clearer and keeps S36 unchanged. S36 itself stays available on the
payer as the REFUNDING revocation (D24, AC-6.16); S51 is the no-refund end.

The payer is never `PAUSED` in V1 (no courtesy, no customer pause, provider pause arrears
goes to `SUSPENDED`), so there are no pause rows. Rows go to `spec-consolidada/04-catalogos.md`
(plus an "Acuerdo comercial" section with AG and AV) and `scripts/guards/transition-tables.json`.

### Propagation design

`propagatePayerTransition` in `.../billing/agreement/propagate-payer-transition.ts`:

```ts
/** A payer transition that children must mirror (closed union). */
export type PayerTransition =
    | { readonly kind: 'ACTIVATED' }
    | { readonly kind: 'ABANDONED' }
    | { readonly kind: 'CHARGE_DECLINED'; readonly scopeLock: AgreementScopeLock }
    | { readonly kind: 'GRACE_ENTERED'; readonly graceStartedAt: Date; readonly graceEndsAt: Date }
    | { readonly kind: 'GRACE_EXITED' }
    | { readonly kind: 'SUSPENDED'; readonly cause: 'ARREARS' | 'CHARGEBACK' }
    | { readonly kind: 'REACTIVATED'; readonly target: 'ACTIVE' | 'CANCEL_SCHEDULED'; readonly serviceEndsAt: Date | null }
    | { readonly kind: 'CANCEL_SCHEDULED'; readonly serviceEndsAt: Date }
    | { readonly kind: 'SERVICE_END_MOVED'; readonly serviceEndsAt: Date }
    | { readonly kind: 'CANCELLED'; readonly cause: AgreementEndReason; readonly scopeLock: AgreementScopeLock };

/**
 * Proof that the transaction holds the agreement-scope lock ("Lock order"). Branded with a
 * module-private unique symbol, so only `lockAgreementScopeForPayer` (payer-first writers) and
 * `lockAgreementScope({ tx, agreementId })` (agreement-first acts) can produce one.
 */
declare const agreementScopeLockBrand: unique symbol; // module-private, never exported
export type AgreementScopeLock = { readonly [agreementScopeLockBrand]: true; readonly agreementId: string };

/**
 * Mirrors a payer transition onto every child inside the payer writer's transaction.
 * Locks children FOR UPDATE in id order, writes guarded UPDATEs, records coverage loss per
 * child vertical for off-transitions, is the ONLY runner of AG4 (rule 8), and returns the
 * verticals whose coverage changed so the caller emits CoverageChangedEvent after commit.
 */
export async function propagatePayerTransition(input: {
    readonly tx: DrizzleClient;
    readonly payerSubscriptionId: string;
    readonly transition: PayerTransition;
    readonly now: Date;
    /** MARK for every writer; FORCE only for the terminal staff acts (rule 1, AC-6.13). */
    readonly onMismatch: 'MARK' | 'FORCE';
    /** Required with FORCE; passed by every staff writer. Lifts MOT:25 and MOT:27 and is AG4's
     *  AV7 actor; absent -> SYSTEM_USER_ID (rule 8). */
    readonly actorId?: string;
}): Promise<{
    readonly changedVerticals: readonly Vertical[];
    readonly childIds: readonly string[];
    readonly mismatchedChildIds: readonly string[];
    /** Children written to CANCELLED by FORCE (always empty with MARK). */
    readonly forcedChildIds: readonly string[];
}>;
```

Rules:

1. The payer writer locks the payer (in the global order of "Lock order"), writes it, then
   calls the propagation in the same `tx`.
   Per child: already in the target state (and, for `CANCEL_SCHEDULED`, `REACTIVATED` to
   `CANCEL_SCHEDULED` and `SERVICE_END_MOVED`, already carrying the target `service_ends_at`)
   -> no-op; in an expected source state (table above) -> guarded UPDATE
   (`WHERE status = <expected>`); anything else -> the child is skipped, its id is returned in
   `mismatchedChildIds`, and the writer opens the mark `HIJA_DE_ACUERDO_DESALINEADA` (MOT:25,
   subject = that child) and a Sentry alert in the same transaction (AC-6.8). A guarded UPDATE
   that affects zero rows (impossible under the `FOR UPDATE` lock, but handled) is the same
   case: the child joins `mismatchedChildIds` and is MARKED; it never throws. The propagation never aborts: an abort after
   an irreversible provider effect (S51 or the withdraw/replace cancel) would leave the
   preapproval cancelled and the payer live with no `end_reason`; on provider-driven writers it
   would make the notice or sweep retry forever; and on the customer's S11 or direct cancel it
   would block a legally mandatory act on internal drift. No act is refused for drift either
   (M3: a refusal had no repair path and blocked the only exits from a stuck agreement).
   Instead, the TERMINAL staff acts (S51, S36 on a payer, withdraw, replace) call the
   propagation with `onMismatch: 'FORCE'`: a drifted child in a live state is written to
   `CANCELLED` in the same transaction (coverage loss for its vertical), and MOT:25 is opened
   (or accumulated) and lifted through S15 (`liftReconciliationMark`,
   `reconciliation/lift-reconciliation-mark.service.ts:27`, which takes a `tx`) with
   `liftedBy` = the staff actor (AC-6.13); a drifted child already terminal is left as is.
   Every other writer MARKs. A non-terminal drift is repaired by the realign act (AC-6.12).
   Payer and children commit together.

   | Writer | Drift handling |
   |---|---|
   | S51, S36 on the payer, withdraw, replace (staff, terminal) | FORCE (live drifted child -> `CANCELLED`, mark opened and lifted) |
   | Customer S11 and direct cancel; staff S11 and direct cancel through ACC_8 (AC-7.9) | MARK |
   | Notices, sweeps, crons (S2, S3, S4-S7, S12, S16, mirrors, crossing charge) | MARK |
   | Realign act (AC-6.12) | writes every drifted child to `mapPayerStatus(payer)`, lifts its MOT:25 |

   `onMismatch` becomes `'MARK' | 'FORCE'` in the signature above (`FORCE` accepted only with
   a `CANCELLED` or `ABANDONED` transition; any other combination is a programming error the
   unit tests pin).
2. `recordCoverageLossIfUncovered` (`coverage/coverage-loss.ts:34-69`) runs once per child
   vertical, never for the payer. Existing call sites that pass `subscription.vertical ?? ''`
   use a shared `recordCoverageLossForRow` that skips `ACUERDO`.
3. Post-commit: one `CoverageChangedEvent` per changed vertical through `coverageNotices`;
   the daily `listing-coverage-reconciler` catches any lost event.
4. The mapping is an exhaustive `switch` (`never` default), unit tested against S41-S50
   (S51 maps to `CANCELLED`, S49).
5. **Selectors never pick a child.** Every class-filtered selector is listed in the
   `selectors` inventory of `check-agreement-propagation-coverage` with a decision (closed
   list after the sites). Required decisions:
   - `end-scheduled-services.service.ts:91-104`: admit `ACUERDO`, exclude children.
   - `send-grace-reminders.service.ts:52` + `grace-reminder-notice.ts:81-87`: admit payer
     (one email listing the verticals), exclude children.
   - `read-own-declined-signups.ts:105-107`: exclude children; the query inner-joins
     `planVersions` and `plans` (`:105-106`), which drops the payer, so add a LEFT JOIN branch
     for `ACUERDO` labelled with the agreement's verticals.
   - `subscription.model.ts:288-303` (`findExpiredAuthorizationWindows`, PRINCIPAL +
     PENDING + window `<= now`): admit `ACUERDO`, exclude `AGREEMENT`; children also carry a
     NULL window (CHECK above).
   - `credited-pending.reads.ts:24-44` (inner join `provider_link`, `class = 'PRINCIPAL'`,
     `<> MANUAL`, `exists(payment SUCCEEDED)`): admit `ACUERDO`, method `= 'CARD'`.
   - `apply-due-scheduled-changes.service.ts:141,165,204`, `apply-scheduled-change.service.ts:61,83,110`,
     `addon-orphanhood.ts:208`, `complement-selection.ts:77,124,168,212`, `pause-quota.ts:31`,
     `plan-migration-launch.service.ts:128`, `plan-migration-s37-guards.ts:70`,
     `scheduled-downgrade-addon-notice.ts:48`: exclude children.
   - `plan-publication.anchored-customers.ts:21`, `stats-plan-summary.ts:32`: count children;
     exclude payer.
   - `late-payment-conditions.ts:126,157` (`hasOtherLivePrincipal`): already returns `false`
     for a NULL vertical (`:148`), so the payer is excluded with no change; children count as
     live principals of their vertical (`PER_USER_VERTICAL_READ`).
   - `reconciliation-zero-call.model.ts:183`: unreachable for the payer because the query
     filters `isNotNull(subscriptions.vertical)` at `:128`; no change, inventoried
     `EXCLUDES_PAYER_BY_VERTICAL`.
   - `reconciliation-inventory.model.ts:170` (`inArray` PRINCIPAL/COMPLEMENTO, inner join
     `provider_link`): admit `ACUERDO`; children never appear (no link).
   - `subscription.model.ts:434-449` (`findDeclinedWithProviderLinks`, used by
     `closeDeclinedAttempts`): `ADMITS_PAYER` and `EXCLUDES_CHILDREN`, with the widened query of
     "Authorization flow" step 2b (AC-6.10, AC-6.15).
   - `subscription.model.ts:425` (`abandonReplacedPendingAuthorization`, S39/S40): today
     `class = 'PRINCIPAL'`; the payer variant `abandonPendingAgreementPayer` writes the
     `ACUERDO` row and propagates S42; a child is never abandoned alone.
   - `subscription.model.ts:483` (`findLiveCommitment`): returns the AGREEMENT child as the
     live commitment; S1 refuses it with `VERTICAL_IN_AGREEMENT` before anything else (see
     refusals).
   - `tourist-vip.model.ts:71` (non-tourist PRINCIPALs that may inherit VIP): count children
     (an agreement line may inherit VIP). `:98`, `:115` (cancellable tourist PRINCIPALs):
     exclude children. `apps/api/src/routes/billing-subscription/tourist-vip-inheritance.ts:89`
     (`eq(subscriptions.class, 'PRINCIPAL')` in the suspended non-tourist query; the
     same-named file under `packages/verticals` is shorter and is not this site): `PER_USER_VERTICAL_READ`, children count.
   - `read-own-manual-installments.ts:61`, `manual-payment.model.ts:27,88`: `MANUAL` only;
     neither payer (`CARD`) nor child (`AGREEMENT`) can match; inventoried.
   - `reconciliation-pause-gift.model.ts:45` (customer pauses), `end-due-pauses.service.ts:36`
     (`PAUSED`): unreachable, no agreement row is ever paused in V1; inventoried.
   - `decline-first-charge.service.ts:225`, `succession-closer.service.ts:76`,
     `reevaluate-succession-predecessors.service.ts:51`, `successor-cut-writes.ts:97`,
     `process-provider-notice.service.ts:423`: succession selectors keyed on `succeeds_id`;
     unreachable for agreements (children and payer carry `succeeds_id` NULL by CHECK), so no
     change; `reevaluate-succession-predecessors.service.ts:51` also joins on a predecessor,
     which an agreement row never has.
   - `complement-s11-rule.ts:121,151`, `complement-pause-s32.ts:75`,
     `complement-resume-s33.ts:65`: add-on rules; the payer is skipped at the call sites (see
     class gates) and children hold no add-on (D20); S32/S33 already return `null` for a
     non-PRINCIPAL; inventoried.
   - `grant-fan-out-check.ts:142`: a PRINCIPAL source with a grant diverges; children never
     hold a permanent grant (D8), the payer has no vertical; inventoried. Unchanged on purpose: its
     query (`reconciliation-zero-call.model.ts:108-162`) selects a live child under a live grant
     anchor of its vertical, so MOT:10 `FAN_OUT_DE_GRANT_INCOMPLETO` is the safety net for a D8
     race (AC-9.4); the consistency job adds no check for it.
   - `mirror-our-cancellation-on-active.ts:160`: already calls the S11 rule only for
     `PRINCIPAL`, so the payer passes; it must admit `ACUERDO` at its own class gate and
     propagate `CANCEL_SCHEDULED`.
   - `after-activation-commit.ts:54`: PRINCIPAL with vertical only; the payer goes through
     `afterAgreementActivated` instead (funnel).
   - `credit-payment.service.ts:329` (charge fact for PRINCIPAL): admit `ACUERDO` and emit the
     payer's `CHARGE_CREDITED` with class `ACUERDO`, no vertical, the version's cycle, no
     `planVersionId`, and `agreementVerticals`/`lineCount` (D23); children never reach it
     (payments hang from the payer).
   - `plan-migration-cohort.ts:68`, `plan-migration-options.service.ts:40`,
     `plan-migration-upcoming-notice.ts:93`: exclude children (PRIVATE versions never migrate,
     and the cohort's inner join on `billing_option` already drops children).
   - `revocation-reading.ts:102`: S36 admits `ACUERDO` (revocation of the payer) and refuses a
     child (`AGREEMENT_CHILD_ACT_ON_PAYER`).
   - `cancel-pending-attempt.service.ts:44,100`: payer variant plus child refusal (see
     refusals).
   - `service-end-s12-chargeback.ts:180`: payer branch (see "Cancellation and service end").
   Decisions: `EXCLUDES_CHILDREN`, `ADMITS_PAYER`, `PER_USER_VERTICAL_READ`,
   `EXCLUDES_PAYER_BY_VERTICAL`, `UNREACHABLE_IN_V1` (with the reason). The guard matches
   `eq(subscriptions.class, ...)`, `inArray(subscriptions.class, ...)` and JS gates
   `class === / !== 'PRINCIPAL'`. Blind spot (header): a class compared through a variable or
   helper.
6. **Non-status fields.** `cancellation-crossing-charge.ts:140-170` computes the extension
   only for PRINCIPAL/COMPLEMENTO (`ACUERDO` falls to `OUT_OF_SCOPE`, `:127,130`) and
   `writeCrossingExtensionOnPrincipal` (`:297-315`) updates only PRINCIPAL. Both admit
   `ACUERDO` (terms from the version) and propagate `SERVICE_END_MOVED`.
7. The consistency job (`billing-agreement-consistency-check`, below) uses its own selector
   (`agreement-sweep.reads.ts`: live payers joined to children, live children whose payer is
   terminal (AC-6.14), plus `APPLYING` versions); the
   reconciliation inventory never sees children. It has no separate retry: "retry" means the
   next hourly run, which re-evaluates every open condition; a still-open mark accumulates
   (S14 `ACCUMULATED`) instead of duplicating.
8. **AG4 has one owner (fifth review minor 5).** AG4 runs only inside `propagatePayerTransition`,
   which every payer writer calls exactly once; no writer (S12, S16, direct cancel, S36, S51, the
   mirrors) runs AG4 itself. It runs when the transition is `CANCELLED` (`end_reason` = its
   `cause`) or `CHARGE_DECLINED` (`FIRST_CHARGE_DECLINED`) AND, under the agreement lock the
   writer already took ("Lock order"), `agreement.status = 'ACTIVE'` and the payer's
   `agreement_version_id` is that agreement's `ACTIVE` version. So `ABANDONED` (incl. the AC-5.5
   guard) never runs it, and S16 from `PENDING_AUTHORIZATION` does not either (the agreement is
   still `OFFERED`, AC-5.3). Its steps are the AG4 row of the agreement state machine.
   **The lock is a compile-time requirement (seventh review minor 2).** The two transitions that
   may run AG4, `CANCELLED` and `CHARGE_DECLINED`, carry a `scopeLock: AgreementScopeLock`
   (signature above), so a payer writer that never called `lockAgreementScopeForPayer` (or, for
   the agreement-first acts, `lockAgreementScope`) has no value to pass and does not compile. The
   propagation asserts `scopeLock.agreementId` equals the payer's agreement (a mismatch is a
   programming error, thrown before any write).

#### `mapPayerStatus` and the realign act (M3)

`mapPayerStatus(payer)` in `propagate-payer-transition.ts` is a pure, exhaustive function over
`SUBSCRIPTION_STATUSES` (`subscription.dbschema.ts:22-32`; `never` default) returning the
child's expected status and the child columns that must equal the payer's. It is the single
definition used by the consistency job (AC-6.4), the realign act (AC-6.12) and the unit tests
of the S41-S50 mapping.

| Payer status | Child status | `service_ends_at` | `grace_started_at` / `grace_ends_at` |
|---|---|---|---|
| `PENDING_AUTHORIZATION` | `PENDING_AUTHORIZATION` | not compared | not compared |
| `ACTIVE` | `ACTIVE` | not compared | not compared |
| `GRACE_PERIOD` | `GRACE_PERIOD` | not compared | equal to the payer's (S44) |
| `SUSPENDED` | `SUSPENDED` | not compared | not compared |
| `CANCEL_SCHEDULED` | `CANCEL_SCHEDULED` | equal to the payer's (S47, S48 and S50 all copy it; after a crossing-charge extension the payer's moved value is the expected one) | not compared |
| `CANCELLED` | `CANCELLED` | not compared (terminal) | not compared |
| `ABANDONED` | `ABANDONED` | not compared | not compared |
| `CHARGE_DECLINED` | `CHARGE_DECLINED` | not compared | not compared |
| `PAUSED` | unreachable in V1 (no agreement pause, D15, D19): the job opens MOT:25 on every child and the realign act refuses with 409 `AGREEMENT_PAYER_STATE_UNSUPPORTED` | | |

A child "disagrees" when its status differs, or when a compared column differs (so a missed
S50 is caught). "Not compared" columns are left to the transition that writes them (S5 clears
the grace pair, `exit-grace.service.ts:91-92`); the realign act copies the payer's value for
every compared column and, on a status change, writes the same columns the propagated
transition would (for example `ACTIVE` from `GRACE_PERIOD` clears the grace pair).

**Terminal payer (M5).** Under a terminal payer (`CANCELLED`, `ABANDONED`, `CHARGE_DECLINED`)
ANY terminal child status agrees (AC-6.13 forces `CANCELLED` under an `ABANDONED` payer and
leaves already-terminal children as they are), and only a LIVE child disagrees. Its target is
`terminalTargetFor(payer, child)`: the payer's status, except a child that is not
`PENDING_AUTHORIZATION` under an `ABANDONED` payer goes to `CANCELLED` (`ABANDONED` only ever
follows `PENDING_AUTHORIZATION`, the AC-6.13 rule). This write is a `REALIGNS_CHILDREN` write
(job or realign act), not a propagated transition, so S43 and S49 keep their origin lists.

**Realign act** (`realignAgreementChildren({ agreementId, actor })` in
`agreement-consistency-check.ts`; `POST /api/v1/admin/billing/agreements/:id/realign-children`,
`BILLING_MANAGE_AGREEMENTS`, an `ACC_28` sub-act, audited). The payer is resolved over EVERY
version of the agreement (M5): the live payer of any of its versions (at most one exists, since
a new payer is inserted only after the previous one is no longer live), else the most recent
payer of any version, ordered by `subscription.created_at DESC, id DESC`; none -> 409
`AGREEMENT_NO_PAYER` (the agreement never had a payer). So an `ENDED` agreement resolves its
terminal payer and its stuck live children are repairable. In ONE transaction, locked in the
global order ("Lock order": agreement, payer, then children `FOR UPDATE` in id order): each
disagreeing child is written to `mapPayerStatus(payer)` (or `terminalTargetFor`, above) with a
guarded UPDATE on its read status; a child that loses coverage gets
`recordCoverageLossIfUncovered` for its vertical; its open MOT:25 (if any) is lifted through
S15 with `liftedBy` = the actor. After commit, one `CoverageChangedEvent` per changed vertical;
no billing fact (children emit none, D23). It never calls the provider and never writes the
payer. It is a writer in the `check-agreement-propagation-coverage` inventory (decision
`REALIGNS_CHILDREN`).

#### Agreement consistency check job (M2)

`agreement-consistency-check.ts` (service-core) holds the logic; the runner is a new cron job.

- **Name** `billing-agreement-consistency-check`: billing jobs carry the `billing-` or
  `subscription-` prefix in `apps/api/src/cron/schedules.manifest.ts` (for example
  `billing-reconciliation-sweep`, `billing-creations-sweep`), kebab-case, and the job file is
  named after it (`apps/api/src/cron/jobs/billing-agreement-consistency-check.job.ts`).
- **Schedule** `38 * * * *` (hourly). Once it calls the provider (the stale-`APPLYING` read,
  check (c), Phase 4) the MP stagger guard (`apps/api/src/cron/mp-cron-stagger.ts:18-39`, run by
  `apps/api/test/cron/mp-cron-stagger.guard.test.ts`) requires `exclusive: true` and a minute
  no other MP-calling job owns; minute 38 is free (the MP callers use 1, 4, 6, 7, 9, 10, 11,
  12, 14, 16, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 33, 34, 36, 37, 39, 41, 42, 44, 46, 47,
  49, 51, 52, 54, 56, 57, 59; 0 is reserved). The guard also refuses `exclusive: true` on a job
  it does not detect as MP-calling (`findMpCronViolations`, `mp-cron-stagger.ts:27-28`; detection
  = the job file imports `utils/payment-provider` or calls `getPaymentProvider(`, guard test
  `:40-45`), so the flag follows the provider call:
  - **Phase 2** (checks (a), (b), (d), no provider): the job is registered WITHOUT `exclusive`,
    and minute 38 is reserved by an entry in the guard test's `PENDING_MP_CRON_SCHEDULES`
    (`:23`). That entry uses a placeholder name, `billing-agreement-consistency-check-provider`
    with schedule `38 * * * *`: a pending entry whose name is a registered job is dropped
    (`mp-cron-stagger.ts:32`; guard test `:84-86`), so the job's own name would reserve nothing.
  - **Phase 4** (check (c) added): the job file calls `getPaymentProvider()` for check (c)'s
    read (so source scanning detects it; no `MP_CALLING_JOBS_INDIRECT` entry, guard test `:16`),
    gains `exclusive: true`, and the placeholder pending entry is removed in the same PR.
- **Manifest entry** (`CronScheduleEntry`, `schedules.manifest.ts:28-39`): `{ name:
  'billing-agreement-consistency-check', displayName: 'Control de consistencia de acuerdos',
  category: 'billing', schedule: '38 * * * *', description: 'Compare agreement children with
  their payer, promote or mark stale APPLYING versions, and mark add-ons on agreement
  verticals (HOS-2211).' }`, plus the handler in `apps/api/src/cron/registry.ts`
  (`test/cron/schedules-manifest.test.ts` keeps both in sync).
- **Lock**: from Phase 4, `exclusive: true`, the pattern of `billing-creations-sweep.job.ts:13`;
  the runner takes the cron session lock only for an exclusive job (`if (job.exclusive)`,
  `withCronLock`, `apps/api/src/cron/run-cron-job.ts:111-118`), so an overlapping tick is
  skipped. In Phase 2 (non-exclusive) two overlapping runs are harmless: the row locks below
  serialize them and a repeated mark accumulates. Inside a run, each payer is processed in its own transaction
  that takes the locks in the global order ("Lock order": agreement and versions first when it
  writes a version, check (c), or forces a child, check (d); otherwise payer then children
  `FOR UPDATE` in id order), so the job never races a payer writer. Check (c) reads the provider
  BEFORE that transaction and re-validates in it (provider-call rule of "Lock order", AC-8.18);
  on a mismatch it skips the payer this run.
- **Per run**: (a) child row versus `mapPayerStatus(payer)` for a LIVE payer -> MOT:25 per
  mismatched child (no write to the child; staff repairs with the realign act, AC-6.12); (d) a
  live child of a TERMINAL payer -> forced to `terminalTargetFor` with MOT:25 opened and lifted
  by `SYSTEM_USER_ID` and coverage loss (AC-6.14; the only child write the job makes, because no
  later payer transition will ever move that child); (b) live
  `VERTICAL_SUBSCRIPTION`/`LISTING` add-on on a child vertical -> MOT:28; (c) `APPLYING` older
  than `applyingStaleHours` -> AC-8.9 (promote or MOT:27); (e) a customer with a live
  `AGREEMENT` child in vertical `tourist` AND a live non-agreement `PRINCIPAL` whose plan version
  `inherits_tourist_vip` -> MOT:29 on that `PRINCIPAL` (AC-6.18; read-only, no write to either
  row); (a), (b), (d) and (e) ship in Phase 2,
  (c) in Phase 4 with the decrease.
  `dryRun` writes nothing and calls no provider, like the other billing jobs.
- **Budget**: `timeoutMs: 120_000` (tens of agreements, at most 5 children each).
- Listed with the other billing crons in the root `CLAUDE.md` "Crons" block (Phase 7).

#### Activation funnel (keep and fix 1)

Three sites activate a pending row today:

- the notice path, `notice/complement-authorized.ts:28-40` (`activateAuthorizedPending`,
  throws for any class but PRINCIPAL/COMPLEMENTO);
- the by-id read path, `subscription/activate-subscription.service.ts:41`;
- `activatePendingRow` in `expire-authorization-windows.service.ts:74-88`, called from S3 on an
  `active` read (`:263-275`) and from `activateCreditedPendingAuthorizations` (`:115-123`).
  It calls `activatePendingWithSignupNotice` + `afterSubscriptionActivated`.

All three call ONE funnel, `activatePending({ subscriptionId, now }, ports)` in
`subscription/activate-pending-funnel.ts`, which reads the class and dispatches: `ACUERDO` ->
`activateAgreementPayer`; `PRINCIPAL`/`COMPLEMENTO` -> today's code. A child is never
activated directly (refused). `activation-after-commit.guard.test.ts`
(`packages/service-core/test/services/billing/subscription/`) is extended so every activation
site must go through the funnel and `afterAgreementActivated` is a registered after-commit.

`activateAgreementPayer` (one tx): lock agreement, version, payer, children, links ("Lock
order"; the funnel reads the class WITHOUT a lock before dispatching, so no activation site
holds the payer lock when it starts). **Pending check first (fifth review B1, AC-5.7).** The
three sites read unlocked and rely on a guarded write to lose a race (`activatePendingRow`
returns `skipped` on `if (!wrote)`, `expire-authorization-windows.service.ts:86`; the notice
loop's `if (!changed) continue`, `process-provider-notice.service.ts:351`; the by-id read checks
the status before its provider read, `activate-subscription.service.ts:65`), so a second caller
can arrive after the first committed. Immediately after taking the locks, if the payer is not
`PENDING_AUTHORIZATION`, return the resolved no-op `{ activated: false, terminal: true }`: no
write, no provider call, no mark, no email, no after-commit. Only then is the closed-version
guard evaluated, and everything after it (the payer's guarded UPDATE `WHERE status =
'PENDING_AUTHORIZATION'`, AV3, AG2, the propagation, the link revocation, the emails, the facts)
runs only when that UPDATE wrote the row; zero rows (impossible under the lock, handled) is the
same no-op. **Closed-version guard
(AC-5.5):** if the version is not `OFFERED` or the agreement is not `OFFERED`, do not
activate. Same structure as S40: in the funnel's transaction move the payer and children to
`ABANDONED` (S40 payer variant, S42), record `recordProviderCancellationDecided`, and open
`ACTIVACION_SOBRE_VERSION_CERRADA` (MOT:26, subject = the payer, each credited payment hung)
with a Sentry alert; after commit cancel the
preapproval (`ATTEMPT_CANCELLED`). Return `{ activated: false, terminal: true }`. The row is no
longer `PENDING_AUTHORIZATION` whatever the cancel's outcome, so the S3 and credited-pending
sweeps stop selecting it (`expire-authorization-windows.service.ts:115-123,273-280`); a
cancel that fails is retried by `our-cancellation-retry`, and a live preapproval on the closed
row is H-7's case (a) (`live-preapproval-on-closed-row.ts:158-175`: a recorded decision ->
`retryOurCancellation`). On the notice path, today `if (!changed) continue`
(`process-provider-notice.service.ts:351`) would retry three times and answer `ERROR`, and the
provider would resend forever; a `terminal` result sets `resolved = true` and `break`s, so
the notice is acked. Otherwise: `activatePendingAuthorization` on the payer; propagate `ACTIVATED`
(S41); version AV3; agreement AG2; revoke every non-revoked link of the version (open ->
`VERSION_CLOSED`, consumed -> `ACTIVATED`, AC-4.15); enqueue
`agreement-confirmed`, and `agreement-link-used` only when the version has a consumed
`signed_action_link` whose `consumed_subscription_id` is the activated payer (AC-4.8, D22;
dedupe key = version id; a payer reached only through My account does not trigger it, a
LINK-driven replacement does, per the "Which payer a link records" rule). Post-commit
`afterAgreementActivated`: coverage events per child vertical and the payer's single
`SUBSCRIPTION_ACTIVATED` fact (class `ACUERDO`, no vertical, `agreementVerticals` and
`lineCount` from the version's lines) (D23). No fact is emitted for any child: the
`ACTIVATED` propagation's post-commit emits none, and `after-activation-commit.ts` (the
PRINCIPAL path) never sees a child or the payer (AC-11.5). Then `cancelInheritedTouristVips` (never cancels an
AGREEMENT child; with AC-1.7 and AC-1.9 there is no live tourist PRINCIPAL to cancel).

#### First charge and first credit

- Decline: `record-charge-fact.service.ts:316-336` calls `enterGraceOnRejectedCharge`, then
  `declineFirstCharge` on `NO_CREDITED_PAYMENT`. `decline-first-charge.service.ts:100` gates on
  `class !== 'PRINCIPAL'`: admit `ACUERDO` (PENDING or ACTIVE, no credited payment) and
  propagate `CHARGE_DECLINED` (S43). Coverage loss per child vertical only when the source
  was `ACTIVE` (same rule as `:242`). `enter-grace.service.ts:88` admits `ACUERDO` (its
  credited-payment guard at `:95-99` is unchanged, so a payer without a credit is not graced).
- Credit: `credit-payment.service.ts:109-115` (`firstPayment` PRINCIPAL only),
  `:305-318` (coverage event PRINCIPAL with a vertical) and `record-charge-fact.service.ts:346-353`
  (`isFirstCharge`) gain an `ACUERDO` branch: on the first credit of a LIVE payer emit one
  `CoverageChangedEvent` per child vertical (none for a terminal payer, AC-5.9) (`trial-conversion.ts:28` converts only a
  `charged === true` source); none for the payer.

#### Cancellation and service end (keep and fix 3, 4)

- `readS11ServiceEndFacts` (`s11-service-end.ts:98`) throws
  `S11_ANCHORED_BILLING_OPTION_MISSING` without `planVersionId` and `billingOptionId`
  (`:113-119`). Callers: `cancel-active-subscription.service.ts:232`,
  `cancel-paused-subscription-support.ts:239`, `cancellation-preview.ts:100` (and `:124` through
  `resolvePausedCancellationEnd`), `cancellation-crossing-charge.ts:141`. Add an `ACUERDO`
  branch at the top: `readAgreementServiceEndFacts` reads the active version
  (`everyMonths` from the cycle, amount) and the payer's latest credited covered period; the
  end is the paid period end (no courtesy in V1). `computeS11ServiceEnd` is reused unchanged.
  The paused-cancel path refuses `ACUERDO` (unreachable in V1; tested).
- `service-end-s12.ts`: `lockDueRow` returns `NOT_APPLICABLE` when `row.class !== expectedClass`
  (`:144`), and the principal path passes `expectedClass: 'PRINCIPAL'` (`:188`) and throws on
  a NULL vertical (`:189-191`). Add `serviceEndS12ForPayer` with `expectedClass: 'ACUERDO'`:
  cancels the payer, skips the vertical-level coverage loss, propagates `CANCELLED`
  (`CUSTOMER_CANCELLED` / `STAFF_CANCELLED` from the cancellation record), which runs AG4
  (propagation rule 8). Same for
  `service-end-s12-chargeback.ts` (`CHARGEBACK`). `end-scheduled-services` dispatches by class.
- S7 (`reactivate-suspended.service.ts:199`): the destination switch (`:210-218`) can pick
  `CANCEL_SCHEDULED` on a `cancelled` read and computes `service_ends_at` (`:296-327`). Admit
  `ACUERDO` and propagate `REACTIVATED { target, serviceEndsAt }` (S47).
- **Add-on S11 rule (blocker).** `cancelComplementsByS11Rule` throws unless the row is a
  `CANCEL_SCHEDULED` PRINCIPAL with user and vertical (`complement-s11-rule.ts:119-128`). It is
  called from S11 (`cancel-active-subscription.service.ts:253`, inside the cancellation
  transaction, so the throw would roll back the legally mandatory customer cancel) and from S7
  toward `CANCEL_SCHEDULED` (`reactivate-suspended.service.ts:338-346`). Both call sites skip
  it when `class = 'ACUERDO'` (V1 children hold no add-on, D20, and the payer has no vertical);
  `decided` is then `[]`. `mirror-our-cancellation-on-active.ts:160` already gates on
  `PRINCIPAL`. `selectComplementTargets` throws for a non-PRINCIPAL
  (`complement-selection.ts:73-80`); its only cancellation caller,
  `cancellation-preview.ts:190`, already runs it only when the row has a vertical (`:178`),
  so the payer's preview skips it; inventoried. The preview's earlier
  `findOrphanhoodCandidates` call (`cancellation-preview.ts:164`) accepts a NULL vertical
  (`addon-orphanhood.ts:71`) but reaches the customer's add-ons by owner; it is skipped for
  `ACUERDO` so the payer's preview lists no add-on of an unrelated subscription.
- Customer cancel from `GRACE_PERIOD`/`SUSPENDED` goes to direct cancel
  (`apps/api/src/routes/billing-subscription/cancellation.ts:143-146`), which admits `ACUERDO`
  and propagates `CANCELLED` (S49). There is no S11 from `GRACE_PERIOD`.

#### Payer writers that must call the propagation

| Area | Writer | Transition |
|---|---|---|
| Activation | the funnel (above) | ACTIVATED |
| Window expiry | `expire-authorization-windows.service.ts:266,329,349`; `subscription.model.ts:350-360` (`abandonPendingAuthorization`, S3) | ABANDONED |
| Pending cancel | `cancel-pending-attempt.service.ts:44,100` + `subscription.model.ts:415-430` (`abandonReplacedPendingAuthorization`, S39/S40): payer variant `abandonPendingAgreementPayer`, also used by withdraw/replace (AC-8.6) and the closed-version guard (AC-5.5) | ABANDONED |
| First charge declined | `decline-first-charge.service.ts:100,199,243` | CHARGE_DECLINED |
| Grace | `enter-grace.service.ts:88,136`; `exit-grace.service.ts:90,217` | GRACE_ENTERED / GRACE_EXITED |
| Arrears | `suspend-for-arrears.service.ts:167`; `arrears-suspension-write.ts:68,85`; `notice/provider-pause-arrears.ts:47,97` | SUSPENDED(ARREARS) |
| Chargeback | `suspend-for-chargeback.service.ts:123`; `suspend-for-chargeback-write.ts:64,86` | SUSPENDED(CHARGEBACK) |
| Reactivation | `reactivate-suspended.service.ts:199,246` | REACTIVATED |
| Scheduled cancel | `cancel-active-subscription.service.ts:158,208`; `notice/mirror-our-cancellation-on-active.ts:155` | CANCEL_SCHEDULED |
| Crossing charge | `cancellation-crossing-charge.ts:127-170,297-315` | SERVICE_END_MOVED |
| Direct cancel | `cancel-direct-subscription.service.ts:161,221,280` (from `SUSPENDED`/`GRACE_PERIOD` only, `:232`) | CANCELLED |
| Immediate end | new `agreement-end.service.ts` (S51, `onMismatch: 'FORCE'`) | CANCELLED(STAFF_CANCELLED) |
| Realign | new `realignAgreementChildren` (AC-6.12) and the job's check (d) (AC-6.14); write children only, never the payer | children to `mapPayerStatus(payer)` / `terminalTargetFor` |
| Service end | `end-scheduled-services.service.ts:101`; `service-end-s12.ts`; `service-end-s12-chargeback.ts` | CANCELLED |
| Provider cancel mirrors | `notice/process-provider-notice.service.ts:408,432`; `notice/mirror-cancelled-on-grace.ts:87,126` | CANCELLED |
| Revocation | `revoke-subscription.service.ts:145,327` (S36, `onMismatch: 'FORCE'`) | CANCELLED(REVOKED) |

#### Lock order (one global order, minor 3)

Every transaction that touches agreement rows takes its row locks (`FOR UPDATE`) in ONE order
and skips the levels it does not need: **customer `users` row -> agreement -> its versions (id
order) -> payer -> children (id order) -> links (id order)**. Only authorize (first explicit lock of its
transaction) and S13 (first explicit lock of `runS13InTransaction`, `permanent-grant-s13.ts:178`, before
its subscription locks at `:106`) take the `users` row: it serializes the D8 check of each against
the other's write (seventh review minor 3, AC-9.4). They take it `SELECT ... FOR NO KEY UPDATE`,
never `FOR UPDATE`: two `NO KEY UPDATE` locks conflict, so the acts serialize, while the `KEY
SHARE` lock an FK insert takes on the referenced user (for example
`permanent_grant.beneficiary_user_id`, `permanent-grant.dbschema.ts:27-29`) does not conflict
with it. "Explicit" matters for S13: the grant insert (`permanent-grant.service.ts:91-118`)
already holds `KEY SHARE` on the customer before `runS13InTransaction` runs, and the S13 preview
(`permanent-grant-preview.ts:110,235`) runs the same transaction and takes the same lock. That
`KEY SHARE` does not block authorize's `NO KEY UPDATE`, and S13's own `NO KEY UPDATE` still
queues behind it, so AC-9.4's serialization holds. Users of the rest: activation, AG4 (inside the propagation its
payer writer calls, rule 8),
DECREASE publish, `apply`, `abandon`, withdraw, replace, `endAgreement` (S51), realign, the
consistency job's (c) and (d), link `issue`/`revoke` (agreement -> version -> links, "Signed link
mechanism") and authorize (steps 1 to 5, "Authorization flow"). A writer
that never writes an agreement or version row (S4, S5, S6, the chargeback suspension, S7, S11,
the crossing charge, provider pause arrears) takes only payer -> children, a suffix of the
order, and needs no change. Existing payer writers that CAN run AG4 lock the payer first in
shared code today (`lockDueRow`, `service-end-s12.ts:124-136`, used by S12; direct cancel at
`cancel-direct-subscription.service.ts:210`; also S16, S36 and the provider cancel mirrors).
Their `ACUERDO` branch complies by calling `lockAgreementScopeForPayer({ tx, payerSubscriptionId
})` BEFORE that lock: it reads the payer's `agreement_version_id` without a lock, then locks
the agreement and all its versions, and only then lets the shared code lock the payer (a second
`FOR UPDATE` on a row the transaction already holds is a no-op). Every version writer holds the
agreement lock, so the versions cannot move under it. A deadlock that slips through (Postgres
`40P01`) aborts one transaction, which its caller already retries (notice resend, next cron
tick, a staff retry); an integration test runs activation, S51 and AG4-through-S12 concurrently
on one agreement and asserts no `40P01`.

**Provider calls and locks (sixth review M1; the single rule).** No row lock is ever held across a
provider read or call. Every flow that reads or calls the provider before writing (withdraw and
replace, AC-8.6; the DECREASE publish's post-provider transactions, `apply` and `abandon`,
AC-8.18; the job's check (c); authorize step 2b) runs: (1) an unlocked pre-read that records the
exact preconditions it relies on; (2) the provider read or call, outside any transaction; (3) ONE
transaction that takes its locks in the order above and RE-VALIDATES those preconditions, as
applicable: payer status, the payer's `provider_link.provider_id` (or its absence), the payer's
latest `PREAPPROVAL_CREATE` key and its `completed_at`, the version status, the agreement status;
(4) on a mismatch it writes nothing and answers its own refusal: withdraw/replace 409
`AGREEMENT_PAYER_AUTHORIZING` (except a payer S3 abandoned meanwhile, AC-8.6); publish, `apply`, `abandon` 409 `AGREEMENT_VERSION_NOT_APPLYING`
(plus the AC-8.18 MOT:5 case); the job skips that payer until the next run; authorize per its
step 3 re-checks. Writes that must be atomic (S42 with `recordProviderCancellationDecided` and
AV6, plus AG3 on withdraw; AV5 with AV4 and the payer's `agreement_version_id`; AV7 with the
MOT:27 lift) all happen in that one guarded transaction. This mirrors S40: unlocked reads and
the provider read (`cancel-pending-attempt.service.ts:37-63`), then a locked re-check of status
and `providerId` (`:66-76`) whose mismatch is `CONFLICT` and a refusal (`:94`). A provider
CANCEL stays write-then-cancel: it runs after the guarded transaction commits.

**Zero-row writes abort (sixth review M2; the single rule).** Inside these transactions, a
guarded UPDATE of an agreement, version or payer row (`WHERE status = <read status>`) that
affects 0 rows throws and rolls the WHOLE transaction back (never a partial state, in particular
never AV5 without AV4), and the flow answers as on a re-validation mismatch. Two exceptions keep
their own rule: child UPDATEs inside the propagation MARK and never abort (propagation rule 1),
and the funnel's payer UPDATE treats 0 rows as the resolved no-op (AC-5.7). Invariant: an
`ACTIVE` agreement has exactly one `ACTIVE` version: at most one by
`uq_agreement_version_one_active` (0225), at least one because AG2 commits with AV3, AV5 never
commits without AV4, and AG4 leaves `ACTIVE` together with AV8.

#### Writers that must refuse an AGREEMENT child or the payer

**Refusal table (the single act x target -> reason map; every refusal is 409 `ALREADY_EXISTS`
and writes nothing).** `AGREEMENT_CHILD_ACT_ON_PAYER` (with `details.payerSubscriptionId`) is
answered only where the SAME act runs on the payer; an act that a binding decision refuses for
the whole agreement answers that decision's reason on the child and on the payer alike. A staff
act checks the D25 gate (AC-10.3) before this table.

| Act | Child id | Payer id | Keyed by a covered vertical |
|---|---|---|---|
| Cancel (S11, direct), cancellation preview, pending-attempt cancel | `AGREEMENT_CHILD_ACT_ON_PAYER` | runs (payer branch) | n/a |
| Revoke S36 (staff, ACC_8) | `AGREEMENT_CHILD_ACT_ON_PAYER` | runs, with refund (D24, AC-6.16) | n/a |
| Pause (customer or staff), S35 courtesy forfeit | `AGREEMENT_PAUSE_NOT_AVAILABLE` (D15) | `AGREEMENT_PAUSE_NOT_AVAILABLE` | n/a |
| Temporary courtesy and its preview | `AGREEMENT_COURTESY_NOT_AVAILABLE` (D19) | `AGREEMENT_COURTESY_NOT_AVAILABLE` | n/a |
| Plan change (`request-plan-change.service.ts`, keyed by subscription id) | `AGREEMENT_MANAGED` | `AGREEMENT_MANAGED` | n/a |
| Promo code, trial extension code (keyed by vertical) | n/a | n/a | `AGREEMENT_MANAGED` |
| Add-on purchase (`VERTICAL_SUBSCRIPTION`/`LISTING` target, or USER scope with only agreement verticals, AC-7.7) | n/a | n/a | `AGREEMENT_ADDONS_NOT_AVAILABLE` (D20) |
| S1 checkout (and the `resolveLiveCommitmentReuse` backstop right after `resolve-live-commitment.ts:163`, audit row), succession admission (`admit-succession-predecessor.ts:82`, unreachable behind S1) | n/a | n/a | `VERTICAL_IN_AGREEMENT` |
| Permanent grant S13 and its preview | n/a | n/a | `PERMANENT_GRANT_VERTICAL_IN_AGREEMENT` (D8) |

Sites:

- Cancel, preview, revoke on a child (`cancel-active-subscription.service.ts:208`,
  `cancel-direct-subscription.service.ts:221`, `cancellation-preview.ts:82`,
  `revoke-subscription.service.ts`, `revocation-reading.ts:102`).
- Pending cancel (`cancel-pending-attempt.service.ts:44`, today `commitmentTaken()` for any
  non-PRINCIPAL): a child id answers per the table; a payer id runs the payer
  variant in S40's order: fresh read (`active` -> refused, the activation proceeds), then one
  transaction with `abandonPendingAgreementPayer` (S42) and `recordProviderCancellationDecided`
  (`S40`), then the provider cancel, retried by the sweep if it fails.
  The customer may cancel their own pending payer from My account.
- `pause-policy.ts:74-77`: refuses children and `ACUERDO` before its `NOT_PRINCIPAL` answer at
  `:74` (table).
- `grant-temporary-courtesy.service.ts:120` and `temporary-courtesy-preview.ts:138`: refuse
  `ACUERDO` and children (table); the admin subscription detail hides the courtesy action for
  both.
- `forfeit-courtesy-pause.service.ts` (S35, coverage loss at `:165-171`): refuses `ACUERDO` and
  children (table).
- `request-plan-change.service.ts`: refuses a child and the payer; `admit-succession-predecessor.ts:82`:
  refuses a child (table).
- `promo/redeem-discount-eligibility.ts:101`, `redeem-trial-extension-code.service.ts`: refuse
  when the vertical has a live child (table).
- `addon/purchase-addon-eligibility.ts` (D20): an explicit refusal in `resolvePurchaseTitle`
  (`:117`), right after the target resolves (`if ('reason' in target) return target;`, `:135`):
  - target with a vertical (`LISTING`, `VERTICAL_SUBSCRIPTION`) where the owner has a live
    AGREEMENT child -> `{ reason: 'AGREEMENT_ADDONS_NOT_AVAILABLE' }` (new value of
    `PurchaseAddonRefusalReason`, mapped to 409);
  - USER scope (`target.vertical === null`, the loop over `compatibleVerticals` at `:136-143`):
    skip every vertical with a live AGREEMENT child; if no non-agreement vertical has a title
    and at least one vertical was skipped because it has an agreement child, answer
    `AGREEMENT_ADDONS_NOT_AVAILABLE` instead of `NO_VALID_TITLE` (AC-7.7); with nothing
    skipped, `NO_VALID_TITLE` stays.
  Why an explicit refusal and not the generic `NO_VALID_TITLE`: `hasTitle` (`:25-62`) asks
  `creditedPaymentsFromLedger.hasCreditedPayment({ subscriptionId: child.id })`
  (`payment/payment-ledger.ts:31-44`), which reads `payments.subscription_id = child.id`; the
  agreement's payments hang from the PAYER, so the ledger cannot follow a child to its payer and
  a paying agreement would look "unpaid". Without the refusal the customer would get a
  misleading `NO_VALID_TITLE`, and if `hasTitle` were ever taught to follow the payer, children
  would silently start buying add-ons.
- `coverage/addon-sources.ts:100-105` (`placementOf`, D20 P7b): a `USER` or `GLOBAL` add-on is
  placed in every compatible vertical today; it returns `null` for a vertical where the owner
  has a live AGREEMENT child, so only the private plan governs that vertical. The add-on itself
  is untouched and keeps charging (no automatic cancel); its other verticals are unchanged.
  The child's activation already emits `CoverageChangedEvent`, which invalidates the effective
  set.
  **Add-on orphanhood is unreachable by construction**, so V1 does not run A5 per child:
  `runOrphanhood` returns `[]` for the payer (`addon-instance-a5.ts:323`, non-PRINCIPAL), and a
  child can never hold an add-on because (a) purchase refuses it, and (b) a live `COMPLEMENTO`
  of the customer in a line's vertical is a blocker at offer and authorize (AC-1.7), so no
  add-on predates the child. Chosen over running
  A5 per child because A5 is the cancel side of a purchase V1 forbids; running it would add
  a fan-out with no reachable input. The consistency check asserts "no live
  `VERTICAL_SUBSCRIPTION`- or `LISTING`-scope add-on targets a child or a listing of a child's
  vertical" and opens `ADDON_SOBRE_HIJA_DE_ACUERDO` (MOT:28, subject = the child) if one ever
  appears. `USER`- and `GLOBAL`-scope add-ons are
  excluded from that predicate: they are owner-wide, D20 P7b keeps a pre-existing one alive on
  purpose, and `placementOf` already keeps it out of agreement verticals.
- S1 (`start-subscription.service.ts`): right after `assertNewPaidSignupsOpen` and BEFORE
  `closeDeclinedAttempts` (`:336`), read the live commitment; when it is an AGREEMENT child,
  throw `VERTICAL_IN_AGREEMENT`. It must run before `resolveLiveCommitmentReuse`, whose first
  check throws `COMMITMENT_TAKEN` for any non-pending commitment
  (`resolve-live-commitment.ts:163`) and would hide the typed reason.
  **D26 (AC-7.10; the single rule).** A new `assertNoAgreementTouristLineForVipPlan({ userId,
  inheritsTouristVip })`, next to `assertTouristVipPurchaseAllowed`
  (`start-subscription.service.ts:166-182`), runs right after it in S1 (`:325-329`), in the
  manual start (`start-manual-subscription.service.ts:72-76`) and in the plan change's
  `startSuccession` (`start-succession.service.ts:76-80`, reached from `requestPlanChange`,
  `request-plan-change.service.ts:29,293`; it reads the same `readBillingChoice`, `:73`): when the chosen plan version
  inherits VIP and the user has an `AGREEMENT` child in vertical `tourist` in
  `LIVE_SUBSCRIPTION_STATUSES`, it throws 422 `VALIDATION_ERROR`, reason
  `AGREEMENT_TOURIST_VIP_REDUNDANT` (no `details`). The flag comes from `readBillingChoice`
  (`:133-163`), whose select over the already joined `planVersions` (`:142-149`) gains
  `inheritsTouristVip`. The symmetric case (a VIP-inheriting child, then a tourist purchase) is
  already refused by `assertTouristVipPurchaseAllowed` through the inheritance port, whose title
  rows (`tourist-vip.model.ts:53-82`) include a child in `TITLE_EMITTING_STATUSES` (`:14`).
- `grant/permanent-grant-s13.ts` (lock `:100-115`) and `permanent-grant-preview.ts`: refuse when
  an AGREEMENT child is live in a granted vertical; S13 reads it after locking the customer's
  `users` row ("Lock order", AC-9.4).
- `tourist-vip.model.ts:135`, `cancel-inherited-tourist-vip.service.ts`: never cancel a child.
- Plan migration cohorts and options: PRIVATE versions never migrate; children excluded.
  **D26 for S37 (AC-7.10):** when the target version inherits VIP, a cohort row whose customer
  has an `AGREEMENT` child in vertical `tourist` in `LIVE_SUBSCRIPTION_STATUSES` is excluded.
  `readPlanMigrationCohort` (`plan-migration-cohort.ts:40-79`) gains a
  `hasAgreementTouristChild` `EXISTS` next to `alreadyInMigration` (`:56-62`); the two
  exclusion classifiers (`plan-migration-preview.service.ts:49-54`,
  `plan-migration-launch.service.ts:154-159`) add `'AGREEMENT_TOURIST_VIP_REDUNDANT'` after
  `ALREADY_IN_MIGRATION`, read against the target version's `inherits_tourist_vip`; the value
  joins both `excludedReason` enums (`plan-migration-admin.schema.ts:54,92`) and the admin
  exclusion labels (`admin-pages.json:1511`, es/en/pt).

#### Class gates that must admit the payer

- Reconciliation: `grace-expiry-check.ts:122,314`, `lost-rejection-check.ts:27`,
  `provider-pause-check.ts:24`, `pending-first-charge-check.ts:20`, `next-charge-sync.ts:23`,
  `comparisons/expected-amount.ts`: for `ACUERDO`, by purpose. `AUTHORIZATION` (the live
  preapproval amount): the `APPLYING` version's `amount_minor` when one exists, else the
  `ACTIVE` version's. `PERIOD` (a charge, called with `{ kind: 'PERIOD', chargeCreatedAt }` from
  `credited-charge-amount.ts:28`): the version that was effective at `chargeCreatedAt`
  (`effective_from <= t` and (`closed_at IS NULL` or `t < closed_at`)), mirroring how the
  PRINCIPAL branch picks a scheduled change by `effectiveAt` (`expected-amount.ts:209-213`).
  `effective_from` is computed, not stored: for the `INITIAL` version it is the `created_at`
  of the payer being compared (the charge belongs to that payer, and with credited-pending the
  first charge is created BEFORE the activation, so `activated_at` would always answer
  `NO_VERSION`, AC-8.11); for a `DECREASE` version it is its `activated_at` (AV4), and the
  `APPLYING` interval before it is the `VERSION_APPLYING` case below;
  `NOT_COMPARABLE` when `t` falls while a version of the agreement was `APPLYING` (the provider
  may have charged either amount), or when no version matches. The `NOT_COMPARABLE` reason
  union (`expected-amount.ts:30`, today `'NOT_PRINCIPAL' | 'NO_ANCHOR'`) gains
  `'VERSION_APPLYING'` (the first case) and `'NO_VERSION'` (the second), and the `COMPARABLE`
  `source` union (`:28`) gains `'AGREEMENT_VERSION'`. Without it the amount
  comparison's retry (`amount-comparison.ts:54-78`, inside the 3-day window after a recorded
  decision) would call `changeAmount` back to the OLD amount and revert the decrease.
  `recordAmountMutationDecided` accepts only `'S30' | 'S37' | 'S10'`, twice: the runtime
  tuple `TRANSITIONS` parsed by `z.enum(TRANSITIONS)` (`amount-mutation-decision.ts:17,20`) and
  the input type (`:42`); both gain `'S52'`.
- Add-on S11 rule call sites (`cancel-active-subscription.service.ts:253`,
  `reactivate-suspended.service.ts:338-346`): skip for `ACUERDO` (see "Cancellation and service
  end").
- Crossing settlement after a credit (AC-5.8): `classifyCancellationCrossing`
  (`cancellation-crossing-rule.ts:32-65`) returns `NONE` for an `ABANDONED` row today (default,
  `:62-63`), so a credited charge on an abandoned payer would hang on no mark (the sweep only
  compares the amount of a credited payment, `period-charges-comparison.ts:180-193`). It returns
  `MARK` for `class = 'ACUERDO'` and status `ABANDONED` whatever the decision, and the MARK path
  (`cancellation-crossing-charge.ts:222-224`, which today needs a decision and maps its
  transition) uses `COBRO_POSTERIOR_A_LA_BAJA` for that row. Other classes are unchanged.
  **S51 (seventh review M1, AC-5.9).** A `CANCELLED` row whose decision is `S51` returns `NONE`
  today (`:45-56`). `S51` joins `CROSSING_MARK_TRANSITIONS_ON_CANCELLED` (`:4`), the
  `CrossingMarkTransition` type (`:9`), the `crossingMarkReason` record (`:15-24`, `S51:
  'COBRO_POSTERIOR_A_LA_BAJA'`, like S23/S24) and the `includeGrace` record of
  `crossingMarkDetail` (`:92-98`, `S51: false`). No frozen length covers the constant; the
  `it.each` lists of `cancellation-crossing-rule.test.ts` (`:28`, `:106-112`) gain `S51`. The
  credit itself is unchanged: `credit-payment.service.ts:169-178` writes the covered period on the
  payer (the money record) and never on a child; the children stay `CANCELLED`, which emits no
  coverage source (`untilOf`, `subscription-sources.ts:60-82`), and the `ACUERDO` first-credit
  coverage branch ("First charge and first credit") emits child events only for a live payer.
- `creation-sweep.model.ts:139,146` (inner join on `billing_option`): use the terms resolver.
  When the creations sweep recreates (`creations-sweep.service.ts:238-250`), today it builds
  the `reason` from vertical and plan slug and passes `ports.returnUrl` (the session result
  screen). For `ACUERDO` the terms resolver supplies the `reason`, the return URL, and a skip:
  if the version is no longer `OFFERED`, the sweep does not recreate and abandons the payer
  instead (S42, same as AC-5.5). The return URL for an `ACUERDO` row is ALWAYS
  `buildAgreementReturnUrl` (`${siteUrl}/{lang}/acuerdo/resultado/`, flow step 7), whether the
  payer came from My account or from a link: that page is a static, session-blind "we are
  confirming your payment" that serves both, so the sweep never needs to know the origin. On
  the sweep path `{lang}` is the customer's account locale (flow step 7). No `created_via`
  column is added.
- Notices: `renewal-notice.ts:142` (annual PLAZO:13 notice lists the verticals),
  `send-renewal-notices.service.ts:97`.
- `facts/billing-fact-sink.ts:11`: `subscriptionClass` gains `'ACUERDO'` and `Common`
  (`:7-14`) becomes a union where `vertical` is required for `PRINCIPAL`/`COMPLEMENTO` and
  absent for `ACUERDO` (which carries `agreementVerticals` and `lineCount` instead);
  `SUBSCRIPTION_CANCELLED.path` (`:101-107`) gains `AGREEMENT_ENDED`; only the payer emits,
  children emit no fact at all (D23, "Analytics (D23)"). The API sink
  `apps/api/src/utils/analytics/analytics-facts.ts` changes with it (admits `ACUERDO`, omits
  `vertical`, writes the two agreement properties).
- Admin: `subscription-admin.schema.ts:18,53` gains `ACUERDO` and `AGREEMENT` (today one
  unknown class breaks the whole list).
- Suspension notices (a gate, not only an enum): `readArrearsSuspensionNoticeContent`
  throws on a NULL vertical (`arrears-suspension-notice.ts:138-139`). It runs BEFORE the write
  in S6 (`suspend-for-arrears.service.ts:196`) and, through
  `readChargebackSuspensionNoticeContent` (`chargeback-suspension-notice.ts:8,40`), before the
  chargeback suspension (`suspend-for-chargeback.service.ts:146`). Unfixed, a chargeback would
  never suspend the payer while the children stay covered. For `ACUERDO` it builds per-line
  content: one entry per child with its vertical and its own `touristVipLost`, and
  `ChargebackSuspensionNoticeContentSchema` (`vertical: string`) gains a `lines` variant for
  the payer. The per-line one-time add-on list (today the query at
  `arrears-suspension-notice.ts:156-169`, by owner and `vertical = ANY(compatible_verticals)`)
  excludes `USER`- and `GLOBAL`-scope add-ons for an agreement line: they do not apply to
  agreement verticals (D20 P7b) and the payer's suspension does not touch them, so listing
  them as "lost" would be false.
- Duplicated enums (all `paymentMethod`, see the inventory): `subscription-self-cancel.schema.ts:36`
  (`OwnSubscriptionsResponseSchema`) does NOT change (minor 8, AC-3.14): the generic
  own-subscriptions list keeps excluding both agreement rows. `read-own-subscriptions.ts`
  already drops them (`eq(subscriptions.class, 'PRINCIPAL')` at `:75` drops the payer, and the
  INNER join on `billing_option` at `:65-70` drops every child, which has no option); V1 keeps
  that join INNER and adds an explicit `ne(subscriptions.paymentMethod, 'AGREEMENT')` so the
  exclusion does not depend on the join. The payer and children are shown only in the
  "Agreed plan" card (`GET .../agreements/mine`); `:99,107,115,122,132`
  (the cancellation preview) keep `CARD | MANUAL` (only the `CARD` payer is previewed, a child
  is refused first) but their `vertical: z.string()` becomes nullable with an `agreementId`
  for the payer's preview; `arrears-suspension-notice.ts:31,115` keep `CARD | MANUAL` (only the
  `CARD` payer is suspended). `packages/analytics/src/catalog-billing.ts:15` gains
  `ACUERDO`, `common` gains `agreement_verticals` and `line_count`, and
  `billing_subscription_cancelled.path` (`:125-132`) gains `AGREEMENT_ENDED` (D23,
  "Analytics (D23)").

#### Analytics (D23)

An agreement's analytics events are always the agreement's own: only the payer emits billing
facts, as class `ACUERDO` with `vertical` OMITTED, and children emit none (D23, revised
2026-11-15). Context: analytics is migrating PostHog to Umami (HOS-2119, in progress, not
merged at this spec's commit); the catalog in `packages/analytics` is the contract for both
providers, and the Umami mapper drops `null`/`undefined` properties, which is why `vertical`
is OMITTED and never sent as `null`.

- **Emitters (service-core).** `BillingFact` (`facts/billing-fact-sink.ts:7-14`):
  `subscriptionClass` gains `'ACUERDO'`; `Common` becomes
  `{ subscriptionClass: 'PRINCIPAL' | 'COMPLEMENTO'; vertical: Vertical; agreementVerticals?: never; lineCount?: never } | { subscriptionClass: 'ACUERDO'; vertical?: never; agreementVerticals: readonly Vertical[]; lineCount: number }`.
  `agreementVerticals` and `lineCount` come from the lines of the payer's
  `agreement_version_id` (`uq_agreement_version_line_vertical` makes the verticals distinct),
  read by the payer writer inside its transaction and handed to the post-commit, so a version
  change between commit and emission cannot skew them.
  - The payer emits: `SUBSCRIPTION_ACTIVATED` (in `afterAgreementActivated`; the version's
    amount and cycle; no `planVersionId`, no `billingOptionId`), `CHARGE_CREDITED`
    (`credit-payment.service.ts:327-355`), `CHARGE_REJECTED`
    (`record-charge-fact.service.ts:362-372`), `GRACE_STARTED`, `SUSPENDED_FOR_ARREARS`,
    `RECOVERED`, `CANCEL_SCHEDULED` (S11 payer path) and
    `SUBSCRIPTION_CANCELLED` (S12 payer branch with `path: 'SERVICE_END'`, direct cancel with
    `DIRECT_FROM_GRACE`/`DIRECT_FROM_SUSPENDED`, S36 with `REVOKED`, and S51 with the NEW
    `AGREEMENT_ENDED`). `CHECKOUT_STARTED`/`CHECKOUT_ABANDONED` are not emitted for
    agreements in V1.
  - **Every payer emitter skips a NULL vertical today**, so without a change the payer would
    emit nothing (silently). Each builds the fact only when `VerticalEnumSchema.safeParse(
    subscription.vertical)` succeeds and hard-codes `subscriptionClass: 'PRINCIPAL'`; each gains
    an `ACUERDO` branch that builds `{ subscriptionClass: 'ACUERDO', agreementVerticals,
    lineCount }` with no `vertical` key:
    - `GRACE_STARTED`: `enter-grace.service.ts:154-170` (guard `:155`, class `:163`);
    - `SUSPENDED_FOR_ARREARS`: `buildSuspendedFact` (`facts/suspended-fact.ts:15-22`), called
      from `suspend-for-arrears.service.ts:333-339` (S6; `buildSuspendedFact` has no other
      caller today); the chargeback suspension has no fact kind of its own and emits nothing,
      unchanged;
    - `RECOVERED`: `exit-grace.service.ts:301-316` (from grace) and
      `reactivate-suspended.service.ts:413-427` (S7, from suspension);
    - `CANCEL_SCHEDULED`: `cancel-active-subscription.service.ts:304-320`;
    - `SUBSCRIPTION_CANCELLED`: the emitters listed below, plus S51;
    - `SUBSCRIPTION_ACTIVATED`: `afterAgreementActivated` (new); `CHARGE_CREDITED` /
      `CHARGE_REJECTED`: the credit and charge-fact sites above.
    The MANUAL emitters (`open-manual-installment.service.ts:161`,
    `register-manual-payment.service.ts:305`) never see a payer (it is `CARD`).
  - **Children emit no fact: the mechanism.** A child's state is written only by the
    propagation (the payer writer's `childIds`), and the propagation's post-commit emits no
    fact; the per-site writers already refuse or exclude children (refusals,
    `EXCLUDES_CHILDREN` in the class-gate inventory). Because a missed gate would silently
    double count, every emitter that builds a `PRINCIPAL` fact from a subscription row ALSO
    skips agreement children explicitly: a new helper `isAgreementChild(row)` in
    `facts/` (`row.paymentMethod === 'AGREEMENT'`, equivalent to
    `row.payerSubscriptionId !== null` under `ck_subscription_agreement_child`) is added to the
    emitter's existing condition, next to `vertical.success`. Sites that need the skip (each
    hard-codes `subscriptionClass: 'PRINCIPAL'` today):
    - `after-activation-commit.ts:54-131` (`SUBSCRIPTION_ACTIVATED`);
    - `expire-authorization-windows.service.ts:348-362` and
      `cancel-pending-attempt.service.ts:100-115` (`CHECKOUT_ABANDONED`);
    - `cancel-active-subscription.service.ts:304-320` (`CANCEL_SCHEDULED`);
    - `cancel-paused-subscription.service.ts:215-240` (`CANCEL_SCHEDULED` /
      `SUBSCRIPTION_CANCELLED`);
    - `cancel-direct-subscription.service.ts:310-325`,
      `end-scheduled-services.service.ts:227-245`, `revoke-subscription.service.ts:370-384`,
      `cancel-inherited-tourist-vip.service.ts:121-135` (`SUBSCRIPTION_CANCELLED`);
    - `enter-grace.service.ts:154-170` (`GRACE_STARTED`);
    - `buildSuspendedFact` (`facts/suspended-fact.ts:15`, `SUSPENDED_FOR_ARREARS`; it takes the
      full `SelectSubscription`, so the skip lives in the builder);
    - `exit-grace.service.ts:301-316`, `reactivate-suspended.service.ts:413-427` (`RECOVERED`).
    Where the emitter's reading does not carry `paymentMethod` today, the implementer adds it
    to that reading. Sites that cannot see a child and need no skip:
    `credit-payment.service.ts:327-355` and `record-charge-fact.service.ts:362-372` (payments
    hang from the payer; a child has none), `open-manual-installment.service.ts:161` and
    `register-manual-payment.service.ts:305` (`MANUAL` only). A static guard
    (`agreement-child-emits-no-fact.guard.test.ts`, service-core) lists every
    `emitBillingFact(`/`buildSuspendedFact(` call site under `services/billing` and fails
    unless the site calls `isAgreementChild` or is in its allowlist with a reason (the four
    above, plus the two new payer-only emitters `afterAgreementActivated` and the S51 fact in
    `agreement-end.service.ts`; full list under "Guards and frozen counts"). Blind spot (header): a fact emitted through a helper that is not one of those two
    names.
  - S16 after activation is NOT a cancellation: it moves the payer to `CHARGE_DECLINED`, which
    `CHARGE_REJECTED` with `nextState: 'CHARGE_DECLINED'` already reports. Provider-mirrored
    cancellations emit nothing new in V1: no `SUBSCRIPTION_CANCELLED` emitter exists on the
    mirror path today (the only emitters are `end-scheduled-services.service.ts:227-245`,
    `cancel-direct-subscription.service.ts:310-325`, `cancel-paused-subscription.service.ts:215-240`,
    `revoke-subscription.service.ts:370-384` and `cancel-inherited-tourist-vip.service.ts:121-135`).
  - **`path` gains `AGREEMENT_ENDED`.** The enum is closed in two places that must change
    together: `BillingFact`'s `SUBSCRIPTION_CANCELLED.path` (`facts/billing-fact-sink.ts:101-107`)
    and `billing_subscription_cancelled.path` (`packages/analytics/src/catalog-billing.ts:125-132`).
    It is used by S51 for the payer only (from `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED` or
    `CANCEL_SCHEDULED`); the children cancelled by S49 in the same act emit nothing. No frozen
    count covers this enum: the catalog tests accept single values
    (`packages/analytics/test/billing-catalog.test.ts:144-158`, the HOS-1994 and B8b cases),
    so V1 adds one more `accepts the agreement-ended cancellation path` case there.
  - Amounts stay integer centavos.
- **Catalog (`packages/analytics/src/catalog-billing.ts`).**
  - `subscriptionClass` (`:15`) gains `ACUERDO`. In `common` (`:18-23`) `vertical` becomes
    `vertical.optional()`, and `common` gains `agreement_verticals:
    z.string().min(1).max(500).optional()` (500 = the Umami property value limit; the five
    verticals comma-joined are 45 characters) and `line_count:
    z.number().int().positive().max(50).optional()` (bounded, so it needs no
    `REVIEWED_UNBOUNDED_NUMBERS` entry; V1 has at most 5 lines per agreement).
  - **Shape rule, one `.superRefine` per billing event.** A shared helper
    `refineBillingClass` (module-private in `catalog-billing.ts`) is applied with
    `.superRefine(refineBillingClass)` to every billing event object that spreads `common`:
    when `subscription_class` is `PRINCIPAL`/`COMPLEMENTO`, `vertical` is required and
    `agreement_verticals`/`line_count` are forbidden; when it is `ACUERDO`, `vertical` is
    forbidden and `agreement_verticals`/`line_count` are required (AC-11.3). The same refine
    makes `billing_subscription_activated`'s `plan_version_id` and `billing_option_id`
    required for `PRINCIPAL`/`COMPLEMENTO` and forbidden for `ACUERDO` (both become
    `.optional()` in the object). They stay needed as optional ONLY because of the payer: it
    has no plan anchors (`ck_subscription_payer_shape`: `plan_version_id IS NULL AND
    billing_option_id IS NULL`); children no longer emit activation, so nothing else needs
    the relaxation. `subscription_class` stays required on every billing event. A refine is
    applied per event because spreading `common` does not carry refinements. `trialCommon`
    (`:24`) is unchanged.
  - **Why a refine and not a discriminated union, and which Zod types are allowed.**
    HOS-2119's `packages/analytics/test/umami-limits.test.ts` walks every catalog schema and
    fails on Zod types it does not know. Supported: object, enum, literal, union (including
    `z.discriminatedUnion`), array, optional, nullable, default, prefault, readonly,
    nonoptional, pipe, number, string, boolean, null, undefined; `.refine`/`.superRefine` are
    fine. FORBIDDEN in this change: `z.intersection`/`.and()`, `z.record`, `z.tuple`,
    `z.lazy`. A `.superRefine` on the object (preferred here) keeps each event a `ZodObject`
    (Zod 4, `packages/analytics/package.json`: `zod ^4.0.8`, attaches refinements as checks
    without wrapping), so `.shape` stays readable and the existing `...common` spread pattern
    is kept. The alternative, `z.discriminatedUnion('subscription_class', [ACUERDO branch,
    PRINCIPAL|COMPLEMENTO branch])` per event, is also walker-safe but doubles every event
    definition and removes `.shape`; if an implementer picks it, the parity test must read
    the vertical enum from the non-agreement branch, e.g.
    `schema.options.find((o) => o.shape.subscription_class.options.includes('PRINCIPAL')).shape.vertical.options`.
  - The `vertical` enum (`:13`) gets NO fake agreement value:
    `apps/api/test/utils/analytics/catalog-parity.test.ts:12-13` pins it to
    `Object.values(VerticalEnum)`; it reads `.shape.vertical.options`, which becomes
    `.shape.vertical.unwrap().options` once the field is optional (the refine keeps `.shape`).
- **API sink (`apps/api/src/utils/analytics/analytics-facts.ts`).** Unchanged, it would drop
  every payer fact before the catalog sees it:
  - `createAnalyticsFactSink` (`:259`) skips any fact whose `subscriptionClass !== 'PRINCIPAL'`
    (`:262-264`, logged at debug). It must admit `ACUERDO` (and keep dropping `COMPLEMENTO`,
    whose behaviour this spec does not change). It needs no child filter: children never
    reach it (the service-core emitters skip them), and a `PRINCIPAL` fact carries no
    payment method to filter on.
  - `toEvent` builds `common` (`:73-81`) with `vertical: fact.vertical` in both branches, so the
    key is PRESENT with value `undefined` for a payer. It must spread `vertical` only when the
    fact carries one, so `'vertical' in properties` is false for `ACUERDO`, and for `ACUERDO`
    write `agreement_verticals: [...fact.agreementVerticals].sort().join(',')` (sorted
    ascending here, in ONE place, whatever order the emitter read) and
    `line_count: fact.lineCount`. The plan-change branch (`:290-300`) also writes
    `vertical: fact.vertical`; the payer has no plan version and no plan-change fact is
    emitted for it in V1, so that branch stays as is.
  - `CheckoutStartedFact` (`:42-56`) hard-codes `subscriptionClass: 'PRINCIPAL' | 'COMPLEMENTO'`
    (`:47`); it stays so (no agreement checkout fact in V1), but the `Fact` union must accept
    the widened `BillingFact` from service-core.
- **Limits and privacy.** New property keys must pass `FORBIDDEN_PROPERTY_KEY_REGEX`
  (`packages/analytics/src/shared.ts:8-9`); `agreement_verticals` and `line_count` match none
  of its tokens. Billing events never carry `pf_entity_id`. `line_count` is bounded
  (`.max(50)`), so nothing goes into `REVIEWED_UNBOUNDED_NUMBERS`
  (`packages/analytics/test/umami-limits.test.ts`, added by HOS-2119; `amount_minor` already
  exists). `agreement_verticals` is bounded at 500 characters, the Umami value limit.
- **Counting (for the dashboard follow-up).** No double counting by construction: one
  agreement event yields exactly one fact, on the payer (AC-11.6). Accepted consequence
  (D23): agreement verticals do NOT appear in per-vertical analytics counts, because no fact
  carries them as `vertical`. To count agreements touching a vertical X, filter
  `subscription_class = 'ACUERDO'` and `agreement_verticals` contains X; revenue is the sum
  of charge facts over all classes, with `ACUERDO` facts carrying the whole agreement price.
- **Out of scope.** Per-vertical split of the payer's revenue (V2) and a revenue dashboard
  (separate follow-up).

#### Terms resolver

`resolveAuthorizationTerms({ subscriptionId, tx })`: PRINCIPAL -> anchored `billing_option`;
ACUERDO -> its `agreement_version` (`amount_minor`, `currency`, `cycle`, `reason`). Used by
`authorizePendingSubscription` (`start-subscription.service.ts:185-205`; the payer skips
`assertCardCheckoutVertical`), the creations sweep, `readAgreementServiceEndFacts`, and
`resolveGraceDays` (version `grace_days` for
`ACUERDO`, plan policy otherwise; `enter-grace.service.ts:112-124`).

### `paymentMethod` branch audit

The payer is `CARD`, so CARD branches reach it once its class gate admits it; children are
`AGREEMENT`, so `=== 'CARD'` branches skip them and `!== 'MANUAL'` branches would wrongly
include them.

**Counts (worktree checkout of this spec, 2026-11-15).** Command:
`rg -n "paymentMethod|payment_method" packages apps -g '*.ts' -g '!**/test/**'` -> **257**
lines. Of those, 50 are test code the glob does not exclude (`__tests__/`, `*.test.ts`,
`*.spec.ts`, `apps/e2e/`), leaving **207** production lines: **55** are not the
`subscription.payment_method` column (listing payment policies, permission names, notification
payloads, MercadoPago wire fields) and **152** are. Of the 152: **23** must branch for
`AGREEMENT`/`ACUERDO`, **2** must exclude children, **127** are unaffected (second full
review: `subscription-self-cancel.schema.ts:36` moved from B to U, AC-3.14). The earlier "59
matches" was a different, narrower search (`rg -n "paymentMethod\s*(===|!==)\s*'(CARD|MANUAL)'"
packages/service-core/src apps/api/src packages/db/src`, JS comparisons only, still 59 at this
checkout), and the "51-row table" of `docs/full-design-pre-v1.md` was a hand-picked subset of it; this inventory
replaces both. Paths below drop the `packages/service-core/src/services/billing/` prefix for
service-core billing files.

Legend: **U** unaffected (with the reason), **B** must branch for `AGREEMENT`/`ACUERDO`, **X**
must exclude (children or payer).

| Site (file:lines) | Class | Reason |
|---|---|---|
| *Not the subscription column (55 lines, all U)* | | |
| `packages/schemas/src/common/listing-policies.schema.ts:45,55,58,61,127,146`; `apps/web/src/lib/listing/listing-policies.ts:92,134,229,238,240,267,373,380`; `apps/web/src/lib/listing/listing-house-rules.ts:28,37,195,197,198,199,200`; `apps/web/src/lib/seo/listing-policies-jsonld.ts:17,66,67,68`; `apps/web/src/lib/seo/venue-jsonld.ts:72`; `apps/admin/src/features/listing/config/listingPoliciesSection.ts:85,92`; `apps/admin/src/lib/validation/rules/commonRules.ts:153`; `apps/api/src/services/ai-context/listing-policies-context.ts:30,135`; `packages/service-core/src/services/listing/base-listing.service.ts:693`; `packages/service-core/src/services/listing/listing-policies-write.ts:9,10`; `packages/service-core/src/services/accommodation/accommodation.service.ts:887`; `packages/seed/src/test-users/hostAccommodation.ts:279` (36) | U | a listing's accepted payment methods (cash, card), unrelated to billing |
| `packages/schemas/src/enums/permission.enum.ts:649-654` (6) | U | `paymentMethod.*` permission names |
| `packages/notifications/src/services/notification.service.ts:383,707`; `packages/notifications/src/types/notification.types.ts:364,742,753`; `packages/notifications/src/services/outbox/signup-declined-reason.ts:21` (6) | U | free-text payment hint / provider decline code in notification payloads |
| `packages/payments/src/provider/provider-concepts.ts:75`; `packages/payments/src/adapters/mercadopago/mercadopago-order-charge.ts:32`; `packages/payments/src/fake-server/orders-route.ts:21,77,78,79`; `packages/schemas/src/api/billing/link-preapproval.schema.ts:14` (7) | U | MercadoPago wire fields and a comment |
| *Schema and models (`packages/db`)* | | |
| `schemas/vertical/subscription.dbschema.ts:77` | U | the column itself |
| `schemas/vertical/subscription.dbschema.ts:125,126,127` | B | `ck_subscription_payment_method` is built from `SUBSCRIPTION_PAYMENT_METHODS` (`:21`), which gains `AGREEMENT` |
| `schemas/vertical/subscription.dbschema.ts:151` | B | `identity_not_null` rewritten (payer has NULL vertical) |
| `models/subscription/subscription.model.ts:267` | U | `createPendingAuthorization` inserts S1's CARD PRINCIPAL; agreements insert through their own writer |
| `models/subscription/subscription.model.ts:363,365` | U | S3 `abandonPendingAuthorization`'s MANUAL branch; the payer is CARD, a child is never abandoned alone |
| `models/subscription/credited-pending.reads.ts:29` | B | `ne(…, 'MANUAL')` -> `eq(…, 'CARD')` and admit `ACUERDO` |
| `models/subscription/manual-payment.model.ts:28,89`; `models/subscription/manual-pending-authorization.ts:24` | U | MANUAL only |
| `models/creation-sweep/creation-sweep.model.ts:146` | U | `eq CARD`: payer matches, children have no key (the `billing_option` join is a separate change) |
| `models/reconciliation-inventory/reconciliation-pause-gift.model.ts:47` | U | unreachable, no agreement pause |
| *Schemas (`packages/schemas`)* | | |
| `api/billing/subscription-admin.schema.ts:53` | B | enum gains `AGREEMENT` (one unknown value breaks the admin list) |
| `api/billing/subscription-read.schema.ts:13` | U | `z.string()` |
| `api/billing/subscription-self-cancel.schema.ts:36` | U | `OwnSubscriptionsResponseSchema` stays `CARD \| MANUAL`: the generic list excludes the payer and the children (AC-3.14) |
| `api/billing/subscription-self-cancel.schema.ts:99,107,115,122,132` | U | preview of the CARD payer only; a child is refused first (`vertical` becomes nullable separately) |
| *API (`apps/api/src`)* | | |
| `routes/billing-subscription/read-own-subscriptions.ts:52,201,233` | U | pass-through |
| `routes/billing-subscription/read-own-subscriptions.ts:276,282` | U | `isNextChargeShown` requires CARD; neither agreement row reaches it (the list excludes both, AC-3.14) |
| `routes/billing-subscription/read-own-manual-installments.ts:62`; `services/partner-billing-setup/partner-billing-setup.service.ts:188` | U | MANUAL only |
| `routes/billing-subscription/read-subscription.ts:14` | U | pass-through to a `z.string()` |
| *service-core billing* | | |
| `addon/purchase-addon-complement.ts:43`; `addon/addon-instance-a5.ts:248,255`; `addon/addon-instance-a6.ts:119,128` | U | COMPLEMENTO rows; purchase is refused on agreement verticals (D20) |
| `grant/permanent-grant-s13.ts:94`; `grant/permanent-grant-s20.ts:97`; `grant/permanent-grant-resume.ts:134` | U | S13 refuses before when a child is live, and no grant coexists with a child (D8) |
| `notice/provider-pause-arrears.ts:47,97` | B | class gate admits `ACUERDO`; `!== 'CARD'` already excludes children |
| `plan-migration/plan-migration-s37.service.ts:190,286`; `plan-migration/plan-migration-upcoming-notice.ts:71,203` | U | PRIVATE versions never migrate; children excluded by selector |
| `promo/promo-exhaustion.service.ts:56`; `promo/promo-ending-notice.ts:60,87`; `promo/send-promo-ending-notices.service.ts:52` | U | no agreement promo in V1 |
| `promo/redeem-discount-eligibility.ts:101` | B | `=== 'MANUAL'` lets `AGREEMENT` through: refuse an AGREEMENT child with `AGREEMENT_MANAGED` before it (AC-7.3) |
| `reconciliation/sweep/provider-pause-check.ts:24`; `reconciliation/sweep/grace-expiry-check.ts:122,314`; `reconciliation/sweep/lost-rejection-check.ts:27`; `reconciliation/sweep/pending-first-charge-check.ts:20`; `reconciliation/sweep/next-charge-sync.ts:23` | B | admit `ACUERDO` at the class gate (`next-charge-sync.ts:24`); the CARD test already excludes children |
| `reconciliation/sweep/next-charge-sync.ts:11` | U | a `Pick<>` type |
| `reconciliation/sweep/successor-grace-check.ts:46` | U | succession, unreachable (CHECK) |
| `subscription/admin-subscription-detail.service.ts:64,143`; `subscription/admin-subscription-list.service.ts:85,128` | U | pass-through (the enum is the change) |
| `subscription/admit-succession-predecessor.ts:82` | B | refuse an AGREEMENT child (`VERTICAL_IN_AGREEMENT`, refusal table) before the MANUAL test |
| `subscription/admit-succession-predecessor.ts:94,151` | U | unreachable once `:82` refuses |
| `subscription/arrears-suspension-notice.ts:31,45,57,89,93,100,103,109,115,142,190` | U | only the CARD payer is suspended (`:142` would throw on `AGREEMENT`, but a child is never the subject; the payer branch builds per-line content) |
| `subscription/cancel-active-subscription.service.ts:262`; `subscription/cancel-direct-subscription.service.ts:258`; `subscription/revocation-reading.ts:130`; `subscription/cancellation-preview.ts:276` | U | the CARD payer gets the provider cancel; a child is refused first |
| `subscription/cancel-paused-subscription.service.ts:134`; `subscription/resume-subscription.service.ts:107,130,153,175` | U | unreachable, no agreement pause |
| `subscription/chargeback-suspension-notice.ts:9,45`; `subscription/service-end-s12-chargeback.ts:130` | U | literal `CARD`, the payer is CARD |
| `subscription/complement-pause-s32.ts:148`; `subscription/complement-resume-s33.ts:96`; `subscription/complement-s11-rule.ts:169`; `subscription/complement-selection.ts:29,144,152,179` | U | COMPLEMENTO rows; children excluded by selector |
| `subscription/declare-manual-unpaid.service.ts:105`; `subscription/expire-manual-grace.service.ts:54`; `subscription/open-manual-installment.service.ts:79,98`; `subscription/register-late-manual-payment.service.ts:143`; `subscription/register-manual-payment.service.ts:130`; `subscription/register-unallocated-manual-payment.service.ts:98`; `subscription/start-manual-subscription.service.ts:89` | U | MANUAL only |
| `subscription/enter-grace.service.ts:88`; `subscription/exit-grace.service.ts:217`; `subscription/reactivate-suspended.service.ts:199`; `subscription/suspend-for-arrears.service.ts:167`; `subscription/suspend-for-chargeback.service.ts:123` | B | admit `ACUERDO` at the class gate; the CARD test excludes children |
| `subscription/expire-authorization-windows.service.ts:266,329` | X | `!== 'MANUAL'` would include `AGREEMENT`: children are excluded at the selector (`findExpiredAuthorizationWindows`) and carry no `provider_link`; the payer gets the provider cancel |
| `subscription/grace-reminder-notice.ts:70,170`; `subscription/signup-incomplete-notice.ts:66`; `subscription/renewal-notice.ts:120,224` | U | pass-through of the CARD payer's method |
| `subscription/renewal-notice.ts:143` | U | `CARD`/`MANUAL` only: excludes children, admits the payer (the class gate at `:142` is a separate change) |
| `subscription/send-renewal-notices.service.ts:97` | U | `inArray(['CARD','MANUAL'])`: payer in, children out |
| `subscription/grant-temporary-courtesy.service.ts:112,256`; `subscription/temporary-courtesy-preview.ts:46,138`; `subscription/reissue-deferred-courtesy.service.ts:77,137` | U | unreachable, courtesy refused first (D19) |
| `subscription/pause-policy.ts:65` | U | select |
| `subscription/pause-policy.ts:77` | B | refuse `AGREEMENT` and `ACUERDO` alike (`AGREEMENT_PAUSE_NOT_AVAILABLE`, D15, refusal table) |
| `subscription/plan-change-cycle-deadlines.ts:38`; `subscription/request-plan-change.service.ts:281` | U | plan change refused on a child first |
| `subscription/resolve-live-commitment.ts:167` | B | the backstop is a new check placed right after the status check (`:163`) and before the billing-option check (`:164-165`), so it precedes this `MANUAL` test: `AGREEMENT` throws `VERTICAL_IN_AGREEMENT`. A non-pending child already fails `:163` with `COMMITMENT_TAKEN`; S1's earlier check owns that case |
| `subscription/s11-service-end.ts:72,169,177,184` | U | pass-through; the `ACUERDO` branch (`readAgreementServiceEndFacts`) runs before these reads |
| `subscription/paying-predecessor-successor.ts:8,16,39,60,88`; `subscription/start-succession.service.ts:105,126,154`; `subscription/succession-closer.service.ts:59`; `subscription/succession-target-guard.ts:59`; `subscription/successor-cut-after-commit.ts:90`; `subscription/successor-cut-writes.ts:39,91,128,163,195`; `subscription/successor-cutter.ts:22`; `subscription/successor-window.ts:13,29`; `subscription/cancel-succession-predecessor-support.ts:41`; `subscription/cancel-succession-predecessor.service.ts:104` | U | succession, unreachable (children and payer carry `succeeds_id` NULL by CHECK) |

`check-payment-method-branches` re-runs the narrower JS search plus the Drizzle forms and fails
on a comparison outside this reviewed inventory. It matches the JS forms (`paymentMethod
===/!== '...'`) AND the Drizzle forms `eq(…paymentMethod, …)`, `ne(…)` and `inArray(…)`/
`dbInArray(…)` over `subscriptions.paymentMethod` (also through a schema namespace such as
`dbPackage.subscriptions`), which today appear at 8 sites: `credited-pending.reads.ts:29`,
`creation-sweep.model.ts:146`, `reconciliation-pause-gift.model.ts:47`,
`send-promo-ending-notices.service.ts:52`, `send-renewal-notices.service.ts:97`,
`manual-payment.model.ts:28,89` and `read-own-manual-installments.ts:62`. V1 adds two
reviewed Drizzle sites to that inventory: the `ne(…, 'AGREEMENT')` exclusion in
`read-own-subscriptions.ts` (AC-3.14) and `findDeclinedWithProviderLinks` (AC-6.10).
**What the guard compares (minor 10):** its inventory is those comparison SITES, not the 152
audited lines: at this checkout the JS search above returns **59** lines and the Drizzle forms
**8** sites (both re-counted for this revision), so the frozen inventory starts at **67**
entries, and grows by every comparison V1 adds (the two Drizzle sites above plus each new JS
comparison, for example in `pause-policy.ts`), each reviewed. The 152-line audit is the review
input that classified them; the guard does not read it.

### Authorization flow

`authorizeAgreement({ agreementId, versionId, via: SESSION | LINK, payerEmail? })` (no
`returnUrl` input: the terms resolver hands every `ACUERDO` row `buildAgreementReturnUrl`, step
7, so no caller can pass another destination):

**Payer email (fifth review minor 6; the single rule, AC-4.18).** Only the LINK path takes
`payerEmail`: the public body `{ token, payerEmail? }`, fed by the link page's optional "email
you'll pay with" field (omitted when blank); the closed body schema trims, lowercases and
validates it (`z.email().max(254)`). The protected body is `{ versionId }` (the card has no input). The value
becomes the inserted payer's `declared_payer_email` (step 5; NULL when absent), which S1's
provider call forwards as `payer_email` only when present (`start-subscription.service.ts:222`,
adapter `mercadopago-payment-provider.ts:290`). A re-mint keeps the payer row and its email; a
`CREATION_NOT_APPLIED` replacement copies the old payer's email unless the triggering LINK body
carries one. It helps the creations sweep find a loose preapproval, which already searches by
`coalesce(declared_payer_email, users.email)` (`creation-sweep.model.ts:122-124`), so a NULL
falls back to the account email. It is never identity, never echoed by a public response or the
page (D21), and shown masked only in protected responses (AC-4.5). The account email is NOT
copied into `declared_payer_email` on the SESSION path: that would send `payer_email` to
MercadoPago for a customer who never typed it.

**Transaction boundaries (minor 3).** Steps 1 and 2 first run once WITHOUT locks, so a refusal
never reaches the provider; then step 2b runs OUTSIDE any transaction (it calls the provider);
then steps 1 to 5 run in ONE transaction that takes its locks in the global order ("Lock
order": customer `users` row -> agreement -> version -> payer -> children -> links), re-checking step 1 under the
locks and re-validating step 2b's outcome in step 3 (provider-call rule of "Lock order"); step 6
and every post-commit cancel run after commit. This is S1's write-then-call
shape (`createPendingAuthorization` commits before `authorizePendingSubscription` calls the
provider, `start-subscription.service.ts:381-420`). **LINK path (M2):** the unlocked pre-pass
first evaluates AC-4.14 rows 1 to 6 (unknown, revoked, expired, consumed with a non-pending live
payer, version or agreement not `OFFERED`, consumed with no live payer), BEFORE step 1 and
therefore before step 2b; a hit answers its 404/410 at once, so a dead token never reads or
cancels a preapproval nor enqueues a before-cancel notice (AC-4.17). The transaction evaluates
the same rows 1 to 6 again right after step 1's locks and before step 1's own checks, so on the
LINK path a closed version or agreement answers 410 `VERSION_CLOSED`, never 409
`AGREEMENT_VERSION_NOT_OFFERED`/`AGREEMENT_NOT_LIVE`.

1. Lock the customer's `users` row `FOR NO KEY UPDATE` (AC-9.4), the agreement, then the version `FOR UPDATE`. Agreement `OFFERED` (else
   `AGREEMENT_NOT_LIVE`); version `OFFERED` and `change_kind = 'INITIAL'` (else
   `AGREEMENT_VERSION_NOT_OFFERED`). SESSION requires the actor to be the customer (else 404).
   Any OTHER agreement of the customer whose status is not `ENDED`/`WITHDRAWN` -> 409
   `AGREEMENT_PREVIOUS_NOT_ENDED` (AC-3.9, D14). This, not the vertical overlap, is what keeps
   AG2 from colliding with `uq_agreement_one_active_per_customer` while the provider charges.
2. `assertNewPaidSignupsOpen` (HOS-1749, D16); a refusal writes nothing and consumes no link.
2b. **Close the customer's declined attempts with a live provider link (M2, AC-5.6).** S16 can
   leave a declined payer's preapproval LIVE: with the before-cancel notice `NOT_YET_SENT` it
   sets `cancelCall = 'DEFERRED'` (`decline-first-charge.service.ts:142-143`). S1's guard
   `closeDeclinedAttempts` (`start-subscription.service.ts:424-470`, called at `:336`) cannot
   see a payer, because `findDeclinedWithProviderLinks` filters
   `eq(subscriptions.vertical, input.vertical)` (`subscription.model.ts:445`) and the payer's
   vertical is NULL. `authorizeAgreement` calls the SAME `closeDeclinedAttempts` with
   `{ userId, verticals: <the version's line verticals> }`; it reads each row's preapproval,
   skips a `cancelled` one, sends the before-cancel notice (`FIRST_CHARGE_DECLINED`) and the
   cancel for any other, and throws 409 `ALREADY_EXISTS`, `reason: 'PREVIOUS_ATTEMPT_CLOSING'`
   while any is not yet cancelled (writes nothing, consumes no link). `FindDeclinedInput`
   (`subscription.model.ts:47-51`) changes `vertical: string` to `verticals: readonly string[]`
   and the query becomes `user_id = :userId AND status = 'CHARGE_DECLINED' AND payment_method
   <> 'AGREEMENT' AND (vertical = ANY(:verticals) OR class = 'ACUERDO')` (Drizzle:
   `eq(subscriptions.userId, …)`, `eq(subscriptions.status, 'CHARGE_DECLINED')`,
   `ne(subscriptions.paymentMethod, 'AGREEMENT')`, `or(inArray(subscriptions.vertical, …),
   eq(subscriptions.class, 'ACUERDO'))`). S1 (`:336`) and the manual signup
   (`start-manual-subscription.service.ts:77`) pass `[choice.vertical]`, so a standalone signup
   also closes every declined `ACUERDO` payer of the user (AC-6.15). Children never match (no
   link; `ne` above, AC-6.10). The payer reached `CHARGE_DECLINED` through S16, which needs its
   provider link, so the `!row.providerLink -> closing` branch (`start-subscription.service.ts:431-434`) never fires for it.
3. Re-validate: lines PRIVATE, Partner rule, cap, AC-1.9, and `findAgreementBlockers({ userId,
   verticals, includeTouristIfVip, at: 'AUTHORIZE' })` (blocking subscriptions and live
   permanent grants, AC-3.7). `findAgreementBlockers` takes `at: 'OFFER' | 'AUTHORIZE'`: with
   `OFFER` it skips children (`payment_method = 'AGREEMENT'`) whose payer is the customer's own
   `CANCEL_SCHEDULED` payer (AC-1.7, D14); with `AUTHORIZE` (and `versionId` required) it
   skips exactly the children whose `payer_subscription_id` is a live payer of THIS
   `agreement_version` (`uq_subscription_live_payer_per_version`, at most one): those are the
   rows an earlier press of this same authorization committed, they are `PENDING_AUTHORIZATION`
   (a live status, `subscription.dbschema.ts:44-51`) and, without the exclusion, the second
   press would answer 409 before step 4 and AC-3.3, AC-4.5, the re-mint after a rejected
   creation and the `CREATION_NOT_APPLIED` replacement would be unreachable (AC-3.10). The
   OLD agreement's children while its payer is `CANCEL_SCHEDULED` are NOT skipped at
   `AUTHORIZE` (consistent with D14: the new agreement is authorizable only once the old one is
   `ENDED`); in practice step 1 refuses first with `AGREEMENT_PREVIOUS_NOT_ENDED`, and once the
   old agreement is `ENDED` its children are `CANCELLED` (not live) and block nothing. Every
   other live row (any method, any class listed in AC-1.7) still blocks.
   **Declined re-read (sixth review minor 5).** AFTER the blocker read, the same transaction
   re-runs step 2b's predicate (the widened `findDeclinedWithProviderLinks`) with no provider
   call; any row step 2b did not confirm `cancelled` (typically a standalone PRINCIPAL that went
   `CHARGE_DECLINED` with a deferred cancel after 2b) -> 409 `PREVIOUS_ATTEMPT_CLOSING`, nothing
   written, no link consumed (AC-5.6). No row lock is needed: `CHARGE_DECLINED` is terminal, so a
   row that was live at the blocker read was refused there, and one declined then is still
   declined now.
   **Authorize dry run (seventh review M2; the single definition).** `POST /resolve` (AC-4.12,
   AC-4.14 row 7) and the `authorize` of `GET .../agreements/mine` (AC-3.11) evaluate, without
   locks or writes, steps 1 and 2 and the checks of step 3 EXCEPT the declined re-read: that
   re-read is meaningful only after step 2b's provider confirmations, and
   `findDeclinedWithProviderLinks` keeps returning a historical declined row whose preapproval is
   long cancelled, so in a dry run it would block forever (AC-3.15). Step 2b never runs either.
   Hence `PREVIOUS_ATTEMPT_CLOSING` is never a dry-run answer (not in
   `AgreementAuthorizeBlockReasonSchema`); only the real authorize returns it, and the client
   shows "processing" for it (AC-3.3).
   The 422 refusals this step can produce at authorize (terms that were valid at offer but no
   longer are, AC-3.12): `AGREEMENT_AMOUNT_OUT_OF_RANGE` (staff lowered `maxChargeMinor` below
   the amount), `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED` (the Partner setting was turned off
   and the version has a Partner line), `AGREEMENT_TOURIST_VIP_REDUNDANT` (a VIP-inheriting
   PRINCIPAL outside the agreement appeared next to its tourist line, AC-1.9). The others
   cannot change after the offer: lines stay PRIVATE (extras 058), the grace rule reads fixed
   constants, and an offered version stays authorizable when its plan version stops being
   current (edge cases).
4. Live payer for the version -> `resolveAgreementPayerReuse` (M3), checks in S1's order
   (`resolve-live-commitment.ts:169-173`): key still in flight (a concurrent press during the
   first press's provider call) -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS` (AC-3.3); `now >=
   authorization_window_ends_at` (the S3 job, `payment-window-expiry` at minute 23, has not
   abandoned it yet) -> 409 `ALREADY_EXISTS`, `reason: 'COMMITMENT_TAKEN'` (S1's own answer,
   `commitmentTaken()`), with no reuse, no write and no provider call: S3 owns that payer and
   reads the provider first (an `active` read activates instead of abandoning), so an inline
   abandon could drop a paid attempt; then applied creation -> reuse the checkout URL; rejected
   or throttled creation -> re-mint on the same payer; `CREATION_NOT_APPLIED` -> replace the
   payer (S39 variant, see `signed_action_link` notes). On the LINK path the link records the payer the reuse,
   re-mint or replacement ends at (the "Which payer a link records" rule, AC-4.8, AC-4.11).
5. Same transaction: insert payer (`ACUERDO`, `CARD`, `PENDING_AUTHORIZATION`, version id,
   `declared_payer_email`, window from `deadlines.values['10'].cardHours`), insert children
   (`PRINCIPAL`, `AGREEMENT`, payer id, line version, no option, no window,
   `PENDING_AUTHORIZATION`), insert the idempotency key (`PREAPPROVAL_CREATE`, subject =
   payer); for LINK, consume the link (`agreement-link-used` is NOT enqueued here: it waits
   for the activation, AC-4.8, D22). A 23505 on INV:8 ->
   `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION` (a blocker appeared between step 3 and the
   insert); on `uq_subscription_live_payer_per_version` -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`
   with no in-transaction re-read (seventh review minor 4: unreachable, because step 1 holds the
   version lock while step 4 reads the live payer; the mapping is defence only, the client retry
   of AC-3.3 then reaches step 4).
6. Provider phase with `authorizePendingSubscription` (terms from the resolver): reference =
   payer id, `everyMonths` 1 or 12, agreement `reason`, **no `firstChargeAt`** (EX-38, M9,
   G11). Failures follow S1: REJECTED/429 completes the key with a rejected/throttled result
   (`recordCreationRejected`, read back as `RECREATE`, so the next press re-mints); 5xx leaves
   it to the creations sweep.
7. Return URL, ONE destination for every `ACUERDO` path (AC-3.13). Today
   `authorizePendingSubscription` builds the return URL itself
   (`start-subscription.service.ts:216-221`) from `buildAuthorizationReturnUrl`
   (`authorization-return-url.ts:22-29`), whose path is the hardcoded
   `AUTHORIZATION_RETURN_PATH = '/es/mi-cuenta/suscripcion/'` (`:8`) plus
   `?subscription=<id>`: the session result screen of S1, in Spanish whatever the customer's
   locale. It gains an optional `returnUrlBuilder` input (default: today's builder, so S1 is
   unchanged), and the terms resolver hands every `ACUERDO` row the new
   `buildAgreementReturnUrl({ siteUrl, lang })` in the same file, returning
   `${siteUrl}/{lang}/acuerdo/resultado/` with NO query parameter (no agreement id, no
   subscription id, no token: the page is static and session-blind). SESSION, LINK and the
   creations sweep all use it; S1 rows keep `buildAuthorizationReturnUrl`. `{lang}`:
   - SESSION: the customer's account locale, read as the existing
     `readAccountLocaleByEmail` does (`COALESCE(settings->>'languageWeb', settings->>'language')`,
     `packages/db/src/models/partner/partner-application.model.ts:303-308`), through a by-user-id
     sibling;
   - LINK: `signed_action_link.locale` (staff's pick when generating the link, defaulting to
     the same account locale), so the return page matches the link page;
   - creations sweep: the customer's account locale (the sweep does not know the origin);
   - any value outside `es | en | pt`, or none -> `es`.

### Version changes and ending (D5, D14)

`publishAgreementVersion({ agreementId, terms, actor })`:

- Agreement `OFFERED`: the new version replaces the offer (`INITIAL`; AV6 on the old row
  first, then AV1; link revoked). **Validation first (M4, AC-8.15):** under the agreement lock
  and before anything else, the new terms run the SAME validator as `POST /` (one function,
  `validateAgreementTerms({ customerUserId, terms, at: 'OFFER', replacingVersionId })`, shared
  by `POST /`, `POST /preview` and the replace): `AGREEMENT_NO_LINES`,
  `AGREEMENT_LINE_NOT_PRIVATE`, `AGREEMENT_LINE_NOT_CURRENT`, `AGREEMENT_AMOUNT_OUT_OF_RANGE`,
  `AGREEMENT_GRACE_NOT_BELOW_CYCLE`, `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED`,
  `AGREEMENT_TOURIST_VIP_REDUNDANT` (422) and `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION`,
  `AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT` (409). `findAgreementBlockers` with
  `replacingVersionId` also skips the children of a live payer of THAT version (the act abandons
  them). A refusal touches nothing. If the old version has a live payer, the act then runs the
  four creation branches of AC-8.6 (their single definition: latest `PREAPPROVAL_CREATE` key,
  rejected/throttled result, S40 order, fallback) under the provider-call rule of "Lock order".
  `RejectedCreationResultSchema` and `ThrottledCreationResultSchema` are module-private today
  (only their inferred types are exported, `resolve-live-commitment.ts:41,44`): export them, or a
  predicate over them, for this check. `withdrawAgreement`
  follows the same sequence and adds AG3. Without this, a customer could pay a withdrawn offer
  and the three activation sites would loop (`expire-authorization-windows.service.ts:115-123,273-280`,
  `process-provider-notice.service.ts:345-351`); AC-5.5 is the safety net if it happens anyway.
- Classification for an `ACTIVE` agreement, in this order (minor 9): (a) other cycle or other
  lines (a line set compared as `(vertical, plan_version_id)` pairs), or a higher amount -> 409
  `AGREEMENT_CHANGE_REQUIRES_NEW_AGREEMENT`; (b) same amount, cycle and lines -> 422
  `AGREEMENT_VERSION_NO_CHANGE`, whatever `grace_days` says (AC-8.10): a grace-only change is
  NOT a provider-free version in V1, it needs end-and-recreate (V1-b spirit; every version of
  an active agreement is a provider-backed `DECREASE`, so there is one change path); (c) lower
  amount, same cycle and lines -> `DECREASE`, validated exactly per AC-8.16 (floor and
  `maxChargeMinor`, grace below `AGREEMENT_CYCLE_MIN_DAYS`, D17; no line, Partner, VIP or
  blocker re-check), which may also carry a new `grace_days`; the new grace applies to grace periods entered
  after AV4, because `resolveGraceDays` reads the payer's version at grace entry and a running
  grace keeps its stored `grace_ends_at`.
- Agreement `ACTIVE`, same cycle and lines, lower amount -> `DECREASE` (locks: agreement ->
  versions -> payer, "Lock order"): payer `ACTIVE` (RP6
  refuses changes on a paused authorization) and no `APPLYING` version; insert `APPLYING`;
  `recordAmountMutationDecided({ transition: 'S52', changes: [{ field:
  'agreement_version_id', new: <APPLYING id> }] })` in the same transaction;
  `provider.changeAmount`; fresh read. While `APPLYING`, the expected amount is the new amount,
  so the reconciliation retry never reverts it (it re-sends only over the old amount, rule (2)
  of "After `FAILED`"). Then tx: AV5 (old
  -> `SUPERSEDED`) first, then AV4 (new -> `ACTIVE`), then payer
  `agreement_version_id = new`; enqueue `agreement-price-decreased` (M5); answer 201
  `{ applied: true, status: 'ACTIVE' }`. Three other outcomes, each with exactly one answer:
  - **Unknown** (timeout, network error, 5xx, or a fresh read that does not show the new
    amount yet): the version stays `APPLYING`, MOT:27 (`VERSION_DE_ACUERDO_SIN_APLICAR`,
    subject = the payer) is opened, and the answer is 202 `{ versionId, changeKind:
    'DECREASE', applied: false, status: 'APPLYING' }` (never 503, AC-8.14). It is resolved by
    `POST .../apply` (payer not `ACTIVE` -> 409 `AGREEMENT_PAYER_NOT_ACTIVE`; read first, then
    promote, or re-send `changeAmount` when the read shows the old amount; a definitive refusal
    of that re-send -> AV7 and 422 `AGREEMENT_PROVIDER_REJECTED_AMOUNT`; a third amount -> 409
    `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` with `details.providerAmountMinor` and nothing sent,
    until staff confirms the re-send with `confirmResendOverAmountMinor`; AC-8.17), by
    `POST .../abandon` (AC-8.12) or by the stale check (AC-8.9).
  - **Definitive refusal** (a `PaymentProviderError` that is not a timeout, network error or
    5xx): AV7 `FAILED` in a second transaction, nothing else changes, 422
    `AGREEMENT_PROVIDER_REJECTED_AMOUNT` with `details.versionId` (AC-8.13).
  - **Abandon** (`abandonAgreementVersion`, `POST .../versions/:versionId/abandon`, ACC_28):
    fresh read FIRST, outside any transaction; new amount -> promote (AV5, AV4, payer
    `agreement_version_id`, email, MOT:27 lifted) and 409
    `AGREEMENT_VERSION_ALREADY_APPLIED`; the `ACTIVE` version's amount -> AV7 `FAILED` with an
    `agreement_version.failed` event (actor `admin` + id) and MOT:27 lifted through S15, 200; any
    third amount -> the same `FAILED` write and 200, plus MOT:5 `DIVERGENCIA_DE_MONTO` on the
    payer; read failure -> 503 (AC-8.12).
  **Post-provider re-validation (fifth review M1, AC-8.18).** The publish commits `APPLYING` and
  calls the provider outside the lock, so an `abandon` or AG4 can close the version meanwhile.
  Each transaction after the provider call (promote, definitive refusal, unknown outcome with
  MOT:27) re-takes the locks in the global order and acts only if the version is still
  `APPLYING` and the agreement still `ACTIVE`. Otherwise it writes no version row, enqueues
  nothing and opens no MOT:27, and answers 409 `AGREEMENT_VERSION_NOT_APPLYING`; one case adds a
  mark: the agreement is `ACTIVE`, the version was `FAILED` by an abandon, and the fresh read
  shows the NEW amount -> `DIVERGENCIA_DE_MONTO` (MOT:5, subject = the payer, the mark the amount
  comparison already opens for a divergence, `amount-comparison.ts:19,83`; MOT:27 would claim an
  `APPLYING` version that no longer exists). An `ENDED` agreement never gets a mark (its payer is
  terminal and its preapproval cancelled). `apply` and `abandon` check `APPLYING` and an
  `ACTIVE` agreement in their unlocked pre-read before any provider call, and re-validate them
  in the writing transaction, with the same 409 (provider-call rule, "Lock order").
  **After `FAILED`.** `AUTHORIZATION` expected amount = the `ACTIVE` version's amount (no
  `APPLYING` version exists any more); `PERIOD` = the version effective at `chargeCreatedAt`
  (the `ACTIVE` one for charges after the FAILED version's `closed_at`; the closed
  `[created_at, closed_at)` interval of the FAILED version stays `NOT_COMPARABLE`
  `VERSION_APPLYING`, the provider may have charged either amount). The amount retry
  (`amount-comparison.ts:54-78`: inside the window after the latest decision it sends
  `changeAmount` with the expected amount, whatever amount the provider shows) gains two rules
  for `ACUERDO` when the latest decision is `S52` (the single amount-retry rule): (1) the version
  named in its `changes` (`agreement_version_id`) is `FAILED` -> it does not send and returns the
  `AMOUNT_DIVERGENCE` finding instead, so it neither re-sends the abandoned decrease nor pushes the
  old amount over a provider that reports something else; (2) that version is `APPLYING` (seventh
  review M3, AC-8.19) -> it sends only when the provider shows the `ACTIVE` version's (old)
  amount, the one case where re-sending completes the decrease; any third amount -> no send, the
  `AMOUNT_DIVERGENCE` finding (MOT:5 on the payer opened, or accumulated), and MOT:27 keeps its
  own rules (staff resolves through `apply` with the confirmed re-send, AC-8.17, or `abandon`).
  **Re-read before sending (sixth review minor 8).** The expected amount and the
  decision are read at the start of the comparison (`:43-54`), so an `abandon` can commit between
  them and the `changeAmount` at `:62`. For `ACUERDO`, immediately before that call the retry
  re-reads, in a short transaction that takes the agreement and its versions `FOR SHARE` (a prefix
  of "Lock order") and commits before the call, the version status and `findLatest`; if the `S52`
  version is no longer `APPLYING`, or the latest decision changed, it sends nothing and returns no
  finding this run (the next run recomputes). A send that still slips in after that commit leaves
  the provider on the new amount under a `FAILED` version, which the next comparison reports as
  MOT:5 (no retry for a `FAILED` `S52`). The read is defence against a lost or reordered request (M1 is not about
  amounts; EX-39 showed an amount PUT applied).
  **How the retry learns the version (M4).** Today the reader cannot tell: `findLatest`
  (`createRecordedAmountMutationDecisions`, `amount-mutation-decision.ts:73-100`) selects only
  `reason` and `occurredAt`, the port (`amount-mutation-decisions.port.ts:5-10`) types the
  transition `'S30' | 'S37' | 'S10'`, and an unknown `reason` throws `INTERNAL_ERROR`
  (`:89-96`, fail closed), which would break the whole amount comparison for the payer. V1:
  (1) the port's transition becomes `'S30' | 'S37' | 'S10' | 'S52'` and its result gains
  `agreementVersionId: string | null`; (2) `findLatest` also selects `domain_event.changes` and
  returns the `new` value of the `agreement_version_id` change for an `S52` row (`null` for the
  others); (3) the reader keeps reading ONLY `event_type = 'subscription.amount_mutation_decided'`
  on `entity_type = 'subscription'` (`:80-84`), whose writers are `recordAmountMutationDecided`
  for S30, S37, S10 and the new S52. **AV7 is never written there**: every AV7 (publish refusal,
  `apply` refusal, abandon, AG4) records a `domain_event` of the NEW type
  `agreement_version.failed` (entity `agreement_version`, entity id = the version,
  `reason: 'AV7'`, the status change, the actor: staff for the staff acts, the payer writer's
  actor for AG4), added to `DOMAIN_EVENT_TYPES` ("Data Model Changes"), so the amount reader
  never meets an unknown reason. The comparison then reads that version's status and applies the
  rule above.
  **Lifting MOT:27 (minor 2; the single rule).** Every exit of a version from `APPLYING` lifts
  an open MOT:27 on the payer through S15 in the same transaction: promote at publish (none is
  open), promote through `apply` or `abandon` (`liftedBy` = the staff actor), promote through
  the stale check (`liftedBy = SYSTEM_USER_ID`, `packages/db/src/constants/index.ts:27`, the
  fixed id for automated operations, because `reconciliation_mark.lifted_by` is a `users.id`
  FK), and AV7 through abandon, `apply` or AG4 (`liftedBy` = the staff actor when a staff act
  drives it, else `SYSTEM_USER_ID`). MOT:27 never holds payments, so S15's unresolved-payment
  check cannot refuse it.
  **Stuck `APPLYING` (AC-8.9).** The `billing-agreement-consistency-check` job also selects versions in
  `APPLYING` whose `created_at` is older than
  `billing.agreementDefaults.applyingStaleHours` (default 24). For each it does a fresh
  provider read of the payer's preapproval: amount equal to the `APPLYING` version's
  `amount_minor` -> commit AV5 + AV4 + the payer's `agreement_version_id`, enqueue
  `agreement-price-decreased` and lift MOT:27 (rule above), in the same order and transaction
  shape as the normal path, after re-validating that the version is still `APPLYING` and the
  agreement `ACTIVE` (else skip, AC-8.18);
  any other amount, or a read that fails -> open (or keep) the reconciliation mark
  `VERSION_DE_ACUERDO_SIN_APLICAR` (MOT:27) with a Sentry alert and write nothing else (staff decides
  through `POST .../apply`, with the confirmed re-send for a third amount, or `POST .../abandon`,
  which fails the version and opens MOT:5 for a third amount). It never moves a version to
  `FAILED` on its own.
- Agreement `ACTIVE`, anything else -> 409 `AGREEMENT_CHANGE_REQUIRES_NEW_AGREEMENT`, except
  the no-change case (b) above, which is 422 `AGREEMENT_VERSION_NO_CHANGE`.

`endAgreement({ agreementId, mode: 'SCHEDULED' | 'IMMEDIATE', actor })` (staff, ACC_28).
The existing primitives do not cover every state (S11 leaves only `ACTIVE`,
`cancel-active-subscription.service.ts:223`; direct cancel leaves only
`SUSPENDED`/`GRACE_PERIOD`, `cancel-direct-subscription.service.ts:232`), so the matrix is:

| Payer state | SCHEDULED | IMMEDIATE |
|---|---|---|
| `ACTIVE` | S11 (S48), ends at the paid period end | S51 |
| `GRACE_PERIOD` | refused (no paid period to keep; nothing guarantees the next charge) | S51 |
| `SUSPENDED` | refused (same reason) | S51 |
| `CANCEL_SCHEDULED` | idempotent: returns the current `service_ends_at` | S51 (ends now) |
| Agreement `OFFERED`: payer `PENDING_AUTHORIZATION`, or no live payer (never pressed, abandoned or declined) | refused, `allowedModes: []`: use withdraw | refused, `allowedModes: []`: use withdraw |
| agreement `ENDED` or `WITHDRAWN` | `AGREEMENT_NOT_LIVE` | `AGREEMENT_NOT_LIVE` |

Refusals answer 409 `AGREEMENT_END_MODE_NOT_AVAILABLE` with `details.allowedModes` (the admin
copy for `[]` points to "Withdraw offer"). An `OFFERED` agreement is never ended through this
act, payer or not: withdraw is the act that closes an offer (AG3, `end_reason = 'WITHDRAWN'`,
AC-8.5), and silently treating "end" as withdraw would record AG3 under an end request. S51 is
never refused for child drift (M3): under the agreement, version and payer locks ("Lock
order"), in one transaction it writes the
payer `CANCELLED`, propagates `CANCELLED { cause: 'STAFF_CANCELLED' }` with
`onMismatch: 'FORCE'` (S49 for consistent children, drifted live children forced to
`CANCELLED` with their MOT:25 opened and lifted, AC-6.13; coverage loss per child vertical;
the same call runs AG4, rule 8) and records
`recordProviderCancellationDecided({ transition: 'S51' })`; after commit it cancels the
preapproval (`cancelOurAuthorization`, kind `DIRECT_CANCELLATION`, whose template already says
"the service ends today"). A cancel that fails is retried by `our-cancellation-retry`, and a
preapproval that stays live on the closed row is H-7's case (a). Writing first means the
payer can never be left live with a cancelled preapproval. It never reads a refund source or
creates a refund (D14). Then staff offers the new
agreement; it can be authorized only once the old agreement is `ENDED` (AC-3.9).

### Signed link mechanism (generic)

`signed-action-link.service.ts`: `issue` (revokes with `REGENERATED` every link of the subject
whose `revoked_at IS NULL`, open or consumed, M1; returns the token once, never logged; runs in
one transaction that locks the agreement then the version ("Lock order"), re-checks the version
`OFFERED` (else 409 `AGREEMENT_VERSION_NOT_OFFERED`), and maps a 23505 on
`uq_signed_action_link_open_agreement_version` to 409 `AGREEMENT_LINK_CONCURRENT_ISSUE` with no
retry, AC-4.19),
`resolve` (by `token_hash`, in the order of the `signed_action_link` notes: revoked before
expired before consumed, AC-4.14), `consume` (writes `consumed_subscription_id` per the "Which
payer a link records" rule), `revoke` (revokes EVERY link of the subject
whose `revoked_at IS NULL`, open and consumed, with the given reason: `STAFF_REVOKED` for
`DELETE /:id/payment-link`, AC-4.16; `VERSION_CLOSED` / `ACTIVATED` at activation, AC-4.15;
`VERSION_CLOSED` on withdraw, replace and AG4; the staff `DELETE` takes the same agreement ->
version locks as `issue`, the others run inside their caller's locked transaction). URL
`${HOSPEDA_SITE_URL}/{lang}/acuerdo/#t=<token>` with `{lang}` = the link's `locale`. Public
endpoints take the token only in a POST body, answer `no-store`, are rate limited (below). The
page is session-blind, has no token-specific content, `noindex`, `no-referrer`. `issue`
refuses `DECREASE` versions.

**Rate limits (minor 7)**, with the existing middleware in `apps/api/src/middlewares/rate-limit.ts`
(precedent: `apps/api/src/routes/conversations/public/initiate.ts:85,97`, IP plus keyed):

| Endpoint | Limit | Middleware |
|---|---|---|
| `POST /resolve` | 10 per minute per client IP | `createPerRouteRateLimitMiddleware({ requests: 10, windowMs: 60_000 })` (`rate-limit.ts:486`) |
| `POST /authorize` | 10 per minute per client IP AND 5 per minute per token | the same per-IP middleware plus `createKeyedRateLimitMiddleware({ requests: 5, windowMs: 60_000, keyPrefix: 'agreement-link:authorize', keyExtractor: token from the body })` (`rate-limit.ts:1030`), which stores only the SHA-256 of the key, so the token never reaches the store |

**Middleware order for `POST /authorize` (minor 7).** `createKeyedRateLimitMiddleware` calls
`keyExtractor(c)` synchronously (`rate-limit.ts:1043`), so it cannot read the JSON body itself;
the body must be parsed and validated before it runs. The order follows the precedent
(`initiate.ts:85-106` defines the limiters, `:289-290` wires `.use('*', ipRateLimiter)` then
`.post('/', validateBody, emailRateLimiter, handler)`): (1) per-IP limiter; (2) inline body
validation against the closed `{ token, payerEmail? }` schema, storing the parsed body under
`_validatedBody` (invalid body -> 400 `VALIDATION_ERROR`, not counted by the token limiter);
(3) the per-token keyed limiter, whose `keyExtractor` reads the token from `_validatedBody`
(no token -> `null`, which skips it); (4) the handler. `POST /resolve` has only (1), (2) and
(4).

Over the limit: 429 `RATE_LIMIT_EXCEEDED` with `Retry-After` (both middlewares). Both skip
under `NODE_ENV=test` unless `HOSPEDA_TESTING_RATE_LIMIT` is set, so the AC-4.13 test sets it.

### Permanent grant exclusion (D8)

Offer and authorize refuse a vertical with a live permanent grant
(`permanent-grant-live-anchors.ts`); S13 and its preview refuse a vertical with a live child.

### Pricing situation and My account

`PricingSituationResponseSchema` (`pricing-situation.schema.ts:56`) gains
`{ situation: 'AGREEMENT', agreementId, agreementState: 'PENDING_AUTHORIZATION' | 'INCLUDED' }`
(the one shape, also in AC-7.5), returned first by `read-pricing-situation.ts` when a child in
`LIVE_SUBSCRIPTION_STATUSES` exists (the same live set as the S1 refusal, AC-7.6);
`agreementState` is `PENDING_AUTHORIZATION` exactly when the child is. `GET .../agreements/mine` feeds
`AgreedPlanCard.client.tsx`, which alone renders the payer and the children;
`read-own-subscriptions.ts` excludes both (AC-3.14).

### API Design

Admin tier (`/api/v1/admin/billing/agreements`), `createAdminRoute` / `createAdminListRoute`,
permission `BILLING_MANAGE_AGREEMENTS`, action `ACC_28`, error order per
`apps/api/docs/error-contract.md`.

**Where the reason lives (minor 6; the single form).** Every refusal of every tier carries its
reason as the top-level `error.reason` of the error body, which `createErrorResponse` emits
unconditionally (`apps/api/src/utils/response-helpers.ts:303-315`; the service sets it as the
`ServiceError` reason, as `commitmentTaken()` does with `'COMMITMENT_TAKEN'`,
`resolve-live-commitment.ts:95-106`). `reason: 'X'` anywhere in this spec means `error.reason`,
never `error.details.reason`; `details.*` (for example `details.cause`, `details.blocking`)
means `error.details`. `handleRouteError` publishes `error.details` outside debug mode only for
`PUBLIC_DETAILS_ERROR_CODES` and three named reasons (`response-helpers.ts:477-480,698-705`), so
every agreement reason whose details this spec promises (`details.cause` of the 410s,
`details.blocking`, `details.payerSubscriptionId`, `existingAgreementId`, `allowedModes`,
`versionId`, `offeredVersionId`, `previousAgreementId`, `inheritingSubscriptionId`,
`providerAmountMinor`) is added
to that gate by reason; the public LINK path still never attaches `blocking` or ids (D21).

| Method and path | Request | Response | Errors |
|---|---|---|---|
| GET `/` | `page`, `pageSize`, `q`, `status` | `AdminAgreementListResponseSchema` (below) | 400 unknown param |
| GET `/:id` | | `AdminAgreementDetailResponseSchema` (below; never the token) | 404 |
| POST `/preview` | `AgreementCreateRequestSchema` (below) | `AdminAgreementPreviewResponseSchema` `{ valid, problems, blocking }` (below; no writes; runs the same `validateAgreementTerms` as `POST /`) | 400 body; 404 customer |
| POST `/` | `AgreementCreateRequestSchema` (below) | 201 `{ agreementId, versionId }` | 400 body (incl. duplicate verticals); 422 `AGREEMENT_AMOUNT_OUT_OF_RANGE`, `_GRACE_NOT_BELOW_CYCLE`, `_PARTNER_CARD_CHARGING_DISABLED`, `_TOURIST_VIP_REDUNDANT`, `_LINE_NOT_PRIVATE`, `_LINE_NOT_CURRENT`, `_NO_LINES`; 409 `AGREEMENT_ALREADY_OFFERED`, `_ALREADY_LIVE`, `_VERTICAL_HAS_PERMANENT_GRANT`, `_VERTICAL_HAS_LIVE_SUBSCRIPTION`; 404 |
| POST `/:id/versions` | `AgreementVersionTermsSchema` (below: `{ cycle, amountMinor, graceDays, lines }`, with lines; no `tradeName`/`internalNotes`) | 201 `{ versionId, changeKind, applied: true, status }` (`INITIAL` replace -> `OFFERED`; confirmed `DECREASE` -> `ACTIVE`); 202 `{ versionId, changeKind: 'DECREASE', applied: false, status: 'APPLYING' }` (outcome unknown, AC-8.14) | replacing an `OFFERED` offer: exactly the 422/409 of `POST /` except `_ALREADY_OFFERED`/`_ALREADY_LIVE` (AC-8.15), plus 409 `AGREEMENT_PAYER_AUTHORIZING`, `PREVIOUS_ATTEMPT_IN_PROGRESS` (AC-8.6); on an `ACTIVE` agreement: 422 `AGREEMENT_VERSION_NO_CHANGE` (AC-8.10), `AGREEMENT_GRACE_NOT_BELOW_CYCLE`, `AGREEMENT_AMOUNT_OUT_OF_RANGE`, `AGREEMENT_PROVIDER_REJECTED_AMOUNT` (`details.versionId`, version `FAILED`, AC-8.13); 409 `AGREEMENT_PAYER_NOT_ACTIVE`, `_VERSION_CHANGE_IN_PROGRESS`, `_CHANGE_REQUIRES_NEW_AGREEMENT`, `_VERSION_NOT_APPLYING` (closed by a concurrent abandon or AG4 during the provider call, AC-8.18); any state: 409 `AGREEMENT_NOT_LIVE`; never 503 |
| POST `/:id/versions/:versionId/apply` | `{ confirmResendOverAmountMinor?: int }` (closed; empty body allowed) | 200 `{ versionId, status }` (`ACTIVE` when the read shows the new amount; `APPLYING` after a re-send whose outcome is still unknown) | 409 `AGREEMENT_VERSION_NOT_APPLYING`, `AGREEMENT_PAYER_NOT_ACTIVE`, `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` (third amount without a matching confirmation, `details.providerAmountMinor`, AC-8.17); 422 `AGREEMENT_PROVIDER_REJECTED_AMOUNT` (`details.versionId`, version `FAILED`, AC-8.17); 503 read failed |
| POST `/:id/versions/:versionId/abandon` | | 200 `{ versionId, status: 'FAILED' }` (old or third amount; a third amount also opens MOT:5, AC-8.12) | 409 `AGREEMENT_VERSION_NOT_APPLYING`, `AGREEMENT_VERSION_ALREADY_APPLIED` (the read showed the new amount: promoted instead); 503 read failed |
| POST `/:id/withdraw` | | 200 (a live pending payer is abandoned in the same act, S40 order; drifted children forced, AC-6.13) | 409 `AGREEMENT_VERSION_NOT_OFFERED`, `AGREEMENT_PAYER_AUTHORIZING`, `PREVIOUS_ATTEMPT_IN_PROGRESS` (AC-8.6) |
| POST `/:id/end` | `{ mode: 'SCHEDULED' \| 'IMMEDIATE' }` | 200 `{ serviceEndsAt }` (IMMEDIATE: the end instant) | 409 `AGREEMENT_NOT_LIVE`, `AGREEMENT_END_MODE_NOT_AVAILABLE` (`details.allowedModes`), S11 rejections; never refused for child drift (AC-6.13) |
| POST `/:id/realign-children` | | 200 `{ realigned: [{ childId, from, to }] }` (AC-6.12) | 404; 409 `AGREEMENT_NO_PAYER`, `AGREEMENT_PAYER_STATE_UNSUPPORTED` |
| POST `/:id/payment-link` | `{ locale?: 'es' \| 'en' \| 'pt' }` (default: the customer's account locale) | 201 `{ url, expiresAt, locale }` | 409 `AGREEMENT_VERSION_NOT_OFFERED`, `AGREEMENT_LINK_CONCURRENT_ISSUE` (AC-4.19) |
| DELETE `/:id/payment-link` | | 204 (revokes every non-revoked link of the offered version, open and consumed, with `STAFF_REVOKED`, AC-4.16) | |
| GET `/private-plans` | `vertical?` | `{ plans: [...] }` ("Private plan fields") | |
| POST `/private-plans` | `{ vertical, name, slug, description?, basePlanVersionId, entitlements: [{ key, planQuota? }], limits: [{ key, value }], inheritsTouristVip }` (closed) | 201 `{ planId, planVersionId }` | 400; 404 base; 409 `PRIVATE_PLAN_SLUG_TAKEN`; 422 `PRIVATE_PLAN_BASE_VERTICAL_MISMATCH`, `PRIVATE_PLAN_BASE_HAS_ROLE`, `VALIDATION_ERROR` (unknown key, G3) |
| POST `/private-plans/:planId/versions` | `{ basePlanVersionId?, entitlements, limits, inheritsTouristVip }` (closed) | 201 `{ planId, planVersionId }` (previous version `current = false`) | 400; 404 plan (unknown or PUBLIC) or base; 409 `PRIVATE_PLAN_CONCURRENT_PUBLISH` (AC-2.10); 422 as above |

Protected tier: `GET /api/v1/protected/billing/agreements/mine` (response below) and
`POST /api/v1/protected/billing/agreements/:agreementId/authorize` (`{ versionId }`, closed; no
`payerEmail`, "Payer email")
-> `{ payerSubscriptionId, checkoutUrl, reused, declaredPayerEmailMasked }`; errors 404, 409
`AGREEMENT_VERSION_NOT_OFFERED`, `_NOT_LIVE`, `_VERTICAL_HAS_LIVE_SUBSCRIPTION`,
`_VERTICAL_HAS_PERMANENT_GRANT`, `AGREEMENT_PREVIOUS_NOT_ENDED`, `PREVIOUS_ATTEMPT_IN_PROGRESS`,
`COMMITMENT_TAKEN` (step 4, payer past its window), `PREVIOUS_ATTEMPT_CLOSING` (step 2b,
AC-5.6), `NEW_PAID_SIGNUPS_FROZEN`; 422 `VALIDATION_ERROR`
with `reason` `AGREEMENT_AMOUNT_OUT_OF_RANGE`, `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED` or
`AGREEMENT_TOURIST_VIP_REDUNDANT` (step 3, AC-3.12); 503). Cancellation uses the existing
protected cancellation and pending-attempt-cancellation endpoints with the payer id; a child
id answers per the refusal table ("Writers that must refuse an AGREEMENT child or the payer").

Public tier (`/api/v1/public/billing/agreement-links`, no auth, rate limited, `no-store`):
`POST /resolve` (`{ token }` -> `AgreementLinkResolveResponseSchema`, below; D21) and
`POST /authorize` (`{ token, payerEmail? }` -> `{ checkoutUrl, reused }`, closed; no email
field of any kind, D21, AC-4.5; `declaredPayerEmailMasked` exists only in the protected
response). Both follow the precedence of AC-4.14. Errors of both: 404 unknown token; 410 `GONE`
with `details.cause` and no agreement data in the body (AC-4.10); 429 `RATE_LIMIT_EXCEEDED`;
and for `/authorize` also 409 `AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION`,
`_VERTICAL_HAS_PERMANENT_GRANT`, `AGREEMENT_PREVIOUS_NOT_ENDED`, `PREVIOUS_ATTEMPT_IN_PROGRESS`,
`COMMITMENT_TAKEN`, `PREVIOUS_ATTEMPT_CLOSING`, `NEW_PAID_SIGNUPS_FROZEN`, 422
`AGREEMENT_AMOUNT_OUT_OF_RANGE`, `AGREEMENT_PARTNER_CARD_CHARGING_DISABLED`,
`AGREEMENT_TOURIST_VIP_REDUNDANT`, and 503. `AGREEMENT_VERSION_NOT_OFFERED` and
`AGREEMENT_NOT_LIVE` are NOT public answers: a version or agreement that is not `OFFERED`
answers 410 `VERSION_CLOSED` at AC-4.14 row 5, evaluated in the unlocked LINK pre-pass and
again under step 1's locks (transaction boundaries, "Authorization flow"), so step 1's own
refusals and step 2b cannot be reached for a dead token (AC-4.17). The public 409/422 bodies carry `code` and `reason`
only, never `details.blocking` or any id (D21); the protected ones carry the details.

**Response schemas (closed, `z.strictObject` at every level; in
`packages/schemas/src/api/billing/agreement-customer.schema.ts`).**

```ts
const AgreementLineSummarySchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planName: z.string()
});

/** Why the customer cannot authorize right now (the authorize dry run, "Authorization flow"; never PREVIOUS_ATTEMPT_CLOSING). */
const AgreementAuthorizeBlockReasonSchema = z.enum([
    'AGREEMENT_PREVIOUS_NOT_ENDED',
    'AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION',
    'AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT',
    'AGREEMENT_AMOUNT_OUT_OF_RANGE',
    'AGREEMENT_PARTNER_CARD_CHARGING_DISABLED',
    'AGREEMENT_TOURIST_VIP_REDUNDANT',
    'NEW_PAID_SIGNUPS_FROZEN'
]);

export const AgreementsMineResponseSchema = z.strictObject({
    /** At most two: one ACTIVE (its payer may be CANCEL_SCHEDULED) and one OFFERED (D14). ACTIVE first. */
    agreements: z
        .array(
            z.strictObject({
                agreementId: z.string().uuid(),
                status: z.enum(['OFFERED', 'ACTIVE']),
                tradeName: z.string(),
                /** The ACTIVE version of an ACTIVE agreement (never an APPLYING one), the OFFERED one of an OFFERED agreement. */
                version: z.strictObject({
                    versionId: z.string().uuid(),
                    amountMinor: z.number().int().positive(),
                    currency: z.literal('ARS'),
                    cycle: z.enum(['monthly', 'annual']),
                    lines: z.array(AgreementLineSummarySchema).min(1)
                }),
                /** ACTIVE only: the DECREASE being applied (AC-3.16); `version` stays the ACTIVE one. null otherwise. */
                pendingVersion: z
                    .strictObject({
                        amountMinor: z.number().int().positive(),
                        status: z.literal('APPLYING')
                    })
                    .nullable(),
                /** The live payer of that version, or null when none (OFFERED, never pressed or abandoned). */
                payer: z
                    .strictObject({
                        subscriptionId: z.string().uuid(),
                        status: z.enum([
                            'PENDING_AUTHORIZATION',
                            'ACTIVE',
                            'GRACE_PERIOD',
                            'SUSPENDED',
                            'CANCEL_SCHEDULED'
                        ]),
                        nextChargeAt: z.string().datetime().nullable(),
                        graceEndsAt: z.string().datetime().nullable(),
                        serviceEndsAt: z.string().datetime().nullable(),
                        /** Masked declared payer email (e.g. j***@g***.com), null when none; protected only (AC-4.5). */
                        declaredPayerEmailMasked: z.string().nullable()
                    })
                    .nullable(),
                /** null for ACTIVE; for OFFERED, whether "Authorize" is enabled. */
                authorize: z
                    .discriminatedUnion('allowed', [
                        z.strictObject({ allowed: z.literal(true) }),
                        z.strictObject({
                            allowed: z.literal(false),
                            reason: AgreementAuthorizeBlockReasonSchema,
                            /** Only with AGREEMENT_PREVIOUS_NOT_ENDED. */
                            previousAgreementId: z.string().uuid().optional(),
                            /** Only with AGREEMENT_PREVIOUS_NOT_ENDED: the old payer's service_ends_at. */
                            availableAfter: z.string().datetime().optional(),
                            /** Only with the two VERTICAL_HAS_* reasons (the customer's own rows). */
                            blockingVerticals: z.array(VerticalEnumSchema).optional()
                        })
                    ])
                    .nullable()
            })
        )
        .max(2)
});

export const AgreementLinkResolveResponseSchema = z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('AUTHORIZABLE'), ...summary }),
    z.strictObject({ state: z.literal('CHECKOUT_PENDING'), ...summary }),
    z.strictObject({
        state: z.literal('BLOCKED'),
        ...summary,
        blockedReason: AgreementAuthorizeBlockReasonSchema
    })
]);
// summary = { customerTradeName: z.string(), lines: z.array(AgreementLineSummarySchema).min(1),
//   amountMinor: z.number().int().positive(), currency: z.literal('ARS'),
//   cycle: z.enum(['monthly', 'annual']), linkExpiresAt: z.string().datetime() }
```

- `state` is the closed set `AUTHORIZABLE | CHECKOUT_PENDING | BLOCKED`. Expired, replaced,
  revoked, used and closed links are NOT states: they are 410 errors whose body carries no
  agreement data (AC-4.10), and an unknown token is 404. `POST /resolve` is the endpoint that
  yields the page's "blocked" state (`state: 'BLOCKED'`, from the same dry run as
  `/agreements/mine`); `POST /authorize` re-runs the real checks and answers 409/422 when a
  refusal appeared after the resolve (AC-4.12).
- `/agreements/mine` lists agreements `OFFERED`, or `ACTIVE` with a live payer; an `ENDED` or
  `WITHDRAWN` one is never listed. The simultaneous pair of D14 (old `ACTIVE` with payer
  `CANCEL_SCHEDULED`, new `OFFERED` with `authorize.allowed = false` and
  `AGREEMENT_PREVIOUS_NOT_ENDED`) is the AC-3.11 case.
- Both responses carry no email (except the protected `/agreements/mine` payer's masked
  `declaredPayerEmailMasked`), tax id, `internal_notes`, entitlement or limit detail; a test
  asserts `strictObject` rejects an extra key.
- The public `AgreementLinkAuthorizeResponseSchema` is `z.strictObject({ checkoutUrl:
  z.string().url(), reused: z.boolean() })`; the protected one adds `payerSubscriptionId` and
  `declaredPayerEmailMasked: z.string().nullable()`.

**Admin request schemas (M1; closed, `z.strictObject`; same file as the admin responses).**

```ts
const AgreementLineInputSchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planVersionId: z.string().uuid()
});

/** The terms of one version: POST /:id/versions takes exactly this (lines included). */
export const AgreementVersionTermsSchema = z.strictObject({
    cycle: z.enum(['monthly', 'annual']),
    amountMinor: z.number().int(),
    graceDays: z.number().int().nonnegative(),
    lines: z
        .array(AgreementLineInputSchema)
        .refine((lines) => new Set(lines.map((l) => l.vertical)).size === lines.length, {
            message: 'one line per vertical'
        })
});

/** POST / and POST /preview. tradeName and internalNotes are agreement-level, set once at offer. */
export const AgreementCreateRequestSchema = AgreementVersionTermsSchema.extend({
    customerUserId: z.string().uuid(),
    tradeName: z.string().trim().min(1).max(120), // agreement.trade_name varchar(120) NOT NULL
    internalNotes: z.string().max(2000).optional() // agreement.internal_notes
});
```

A duplicate vertical is a body-shape error (400 `VALIDATION_ERROR`; it would also violate
`uq_agreement_version_line_vertical`). An EMPTY `lines` array passes the body schema on purpose:
`validateAgreementTerms` answers it as 422 `AGREEMENT_NO_LINES`, so the preview can list it
among its `problems` and the existing reason stays reachable; the amount range and the grace
rule are likewise 422 business checks (AC-1.3, AC-1.8), not schema bounds. A version carries no
`tradeName` or `internalNotes` (V1 exposes no edit of either); an `INITIAL` replace and a
`DECREASE` both send the full line set (the classification compares it, AC-8.16).

**Admin response schemas (minor 12; closed, `z.strictObject`; in
`packages/schemas/src/api/billing/agreement-admin.schema.ts`).** Staff-only, so they may carry
ids, the customer email and `internalNotes`; never a token or token hash.

```ts
const AdminAgreementLinkStateSchema = z.strictObject({
    /** NONE: no link was ever issued for the current offered version. */
    state: z.enum(['NONE', 'OPEN', 'CONSUMED', 'REVOKED', 'EXPIRED']),
    locale: z.enum(['es', 'en', 'pt']).nullable(),
    expiresAt: z.string().datetime().nullable(),
    consumedAt: z.string().datetime().nullable(),
    revokeReason: z.enum(['REGENERATED', 'VERSION_CLOSED', 'STAFF_REVOKED', 'ACTIVATED']).nullable()
});

const AdminAgreementLineSchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planId: z.string().uuid(),
    planVersionId: z.string().uuid(),
    planName: z.string()
});

const AdminAgreementVersionSchema = z.strictObject({
    versionId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    changeKind: z.enum(['INITIAL', 'DECREASE']),
    status: z.enum(['OFFERED', 'APPLYING', 'ACTIVE', 'SUPERSEDED', 'WITHDRAWN', 'FAILED', 'ENDED']),
    amountMinor: z.number().int().positive(),
    currency: z.literal('ARS'),
    cycle: z.enum(['monthly', 'annual']),
    graceDays: z.number().int().nonnegative(),
    lines: z.array(AdminAgreementLineSchema).min(1),
    activatedAt: z.string().datetime().nullable(),
    closedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime()
});

export const AdminAgreementListResponseSchema = z.strictObject({
    items: z.array(
        z.strictObject({
            agreementId: z.string().uuid(),
            tradeName: z.string(),
            customer: z.strictObject({ userId: z.string().uuid(), email: z.string(), displayName: z.string().nullable() }),
            status: z.enum(['OFFERED', 'ACTIVE', 'ENDED', 'WITHDRAWN']),
            /** The ACTIVE version, else the OFFERED one, else the last closed one. */
            currentVersion: z.strictObject({
                versionId: z.string().uuid(),
                status: AdminAgreementVersionSchema.shape.status,
                amountMinor: z.number().int().positive(),
                cycle: z.enum(['monthly', 'annual']),
                verticals: z.array(VerticalEnumSchema).min(1)
            }),
            /** The payer the realign rule resolves (AC-10.2). */
            payerStatus: z.enum([...SUBSCRIPTION_STATUSES]).nullable(),
            createdAt: z.string().datetime()
        })
    ),
    // shared metadata (api/response/base-response.schema.ts:23); createAdminListRoute's envelope wins if it differs
    pagination: PaginationMetadataSchema
});

export const AdminAgreementDetailResponseSchema = z.strictObject({
    agreementId: z.string().uuid(),
    tradeName: z.string(),
    customer: z.strictObject({ userId: z.string().uuid(), email: z.string(), displayName: z.string().nullable() }),
    status: z.enum(['OFFERED', 'ACTIVE', 'ENDED', 'WITHDRAWN']),
    endReason: z.enum([/* the agreement end_reason list */]).nullable(),
    endedAt: z.string().datetime().nullable(),
    internalNotes: z.string().nullable(),
    versions: z.array(AdminAgreementVersionSchema).min(1), // newest first
    /** The payer the realign rule resolves; `children` are only its children (AC-10.2). */
    payer: z
        .strictObject({
            subscriptionId: z.string().uuid(),
            status: z.enum([...SUBSCRIPTION_STATUSES]),
            nextChargeAt: z.string().datetime().nullable(),
            graceEndsAt: z.string().datetime().nullable(),
            serviceEndsAt: z.string().datetime().nullable()
        })
        .nullable(),
    children: z.array(
        z.strictObject({
            subscriptionId: z.string().uuid(),
            vertical: VerticalEnumSchema,
            status: z.enum([...SUBSCRIPTION_STATUSES]),
            /** mapPayerStatus(payer) disagrees with this row (drives "Realign children"). */
            misaligned: z.boolean(),
            openMarkId: z.string().uuid().nullable()
        })
    ),
    link: AdminAgreementLinkStateSchema,
    /** Open MOT:25-28 marks on the payer or the children (MOT:29's subject is a non-agreement PRINCIPAL). */
    openMarks: z.array(z.strictObject({ markId: z.string().uuid(), reason: z.string(), subscriptionId: z.string().uuid() }))
});

const AgreementProblemCodeSchema = z.enum([
    'AGREEMENT_NO_LINES',
    'AGREEMENT_LINE_NOT_PRIVATE',
    'AGREEMENT_LINE_NOT_CURRENT',
    'AGREEMENT_AMOUNT_OUT_OF_RANGE',
    'AGREEMENT_GRACE_NOT_BELOW_CYCLE',
    'AGREEMENT_PARTNER_CARD_CHARGING_DISABLED',
    'AGREEMENT_TOURIST_VIP_REDUNDANT',
    'AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION',
    'AGREEMENT_VERTICAL_HAS_PERMANENT_GRANT',
    'AGREEMENT_ALREADY_OFFERED',
    'AGREEMENT_ALREADY_LIVE'
]);

export const AdminAgreementPreviewResponseSchema = z.strictObject({
    /** true iff problems is empty. */
    valid: z.boolean(),
    /** Every failing check, not only the first (the submit answers the first in error order). */
    problems: z.array(
        z.strictObject({
            code: AgreementProblemCodeSchema,
            /** The line the problem is about, when it is about one. */
            vertical: VerticalEnumSchema.nullable(),
            /** Interpolation values for the i18n message (floor, cap, cycle days, existing id). */
            params: z.record(z.string(), z.union([z.string(), z.number()])).optional()
        })
    ),
    /** The details.blocking rows of AC-1.7 / AC-1.5. */
    blocking: z.array(AgreementBlockingRowSchema)
});

/**
 * The ONE blocking-row shape (minor 11): preview `blocking` AND `details.blocking` of every
 * protected/admin 409 AGREEMENT_VERTICAL_HAS_LIVE_SUBSCRIPTION / _HAS_PERMANENT_GRANT
 * (AC-1.5, AC-1.7, AC-3.7, AC-8.15). Never in a public body (D21).
 */
export const AgreementBlockingRowSchema = z.strictObject({
    kind: z.enum(['SUBSCRIPTION', 'PERMANENT_GRANT']),
    id: z.string().uuid(),
    vertical: VerticalEnumSchema,
    status: z.string(),
    /** null for a PERMANENT_GRANT. */
    paymentMethod: z.string().nullable()
});
```

**i18n keys (minor 12).** es/en/pt values are written at implementation; the key set below is
closed and a parity test asserts every enum value has its key in the three locales. Admin keys
live in `packages/i18n/src/locales/<locale>/admin-billing.json` (namespace `admin-billing`), web
keys in `.../billing.json` (namespace `billing`).

| Key | Covers |
|---|---|
| `admin-billing.agreements.reasons.<REASON>` | every agreement error reason the admin can receive: the `AgreementProblemCodeSchema` values plus `AGREEMENT_NOT_LIVE`, `AGREEMENT_VERSION_NOT_OFFERED`, `AGREEMENT_VERSION_NOT_APPLYING`, `AGREEMENT_VERSION_ALREADY_APPLIED`, `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED`, `AGREEMENT_PROVIDER_REJECTED_AMOUNT`, `AGREEMENT_LINK_CONCURRENT_ISSUE`, `AGREEMENT_PAYER_NOT_ACTIVE`, `AGREEMENT_VERSION_CHANGE_IN_PROGRESS`, `AGREEMENT_CHANGE_REQUIRES_NEW_AGREEMENT`, `AGREEMENT_VERSION_NO_CHANGE`, `AGREEMENT_END_MODE_NOT_AVAILABLE`, `AGREEMENT_PAYER_AUTHORIZING`, `AGREEMENT_NO_PAYER`, `AGREEMENT_PAYER_STATE_UNSUPPORTED`, `AGREEMENT_CHILD_ACT_ON_PAYER`, `AGREEMENT_COURTESY_NOT_AVAILABLE`, `AGREEMENT_PAUSE_NOT_AVAILABLE`, `AGREEMENT_MANAGED` (staff plan change, refusal table), `PREVIOUS_ATTEMPT_IN_PROGRESS`, `PRIVATE_PLAN_SLUG_TAKEN`, `PRIVATE_PLAN_CONCURRENT_PUBLISH`, `PRIVATE_PLAN_BASE_VERTICAL_MISMATCH`, `PRIVATE_PLAN_BASE_HAS_ROLE`, `PERMANENT_GRANT_VERTICAL_IN_AGREEMENT` |
| `admin-billing.agreements.wizard.amountOutOfRange` | AC-1.3 field message |
| `admin-billing.agreements.status.<OFFERED\|ACTIVE\|ENDED\|WITHDRAWN>` | agreement status |
| `admin-billing.agreements.versionStatus.<status>` | the seven version statuses |
| `admin-billing.agreements.endReason.<end_reason>` | the eight end reasons |
| `admin-billing.agreements.linkState.<NONE\|OPEN\|CONSUMED\|REVOKED\|EXPIRED>` | detail link state |
| `admin-billing.agreements.revokeReason.<REGENERATED\|VERSION_CLOSED\|STAFF_REVOKED\|ACTIVATED>` | detail link state |
| `billing.agreements.card.<OFFERED\|OFFERED_BLOCKED\|CHECKOUT_PENDING\|ACTIVE\|GRACE_PERIOD\|SUSPENDED\|CANCEL_SCHEDULED\|PENDING_PRICE>` | My account card states (UX; `PENDING_PRICE` is the note for `pendingVersion`, AC-3.16) |
| `billing.agreements.blocked.<reason>` | one per `AgreementAuthorizeBlockReasonSchema` value (card disabled reason and link "blocked" copy; `AGREEMENT_TOURIST_VIP_REDUNDANT` is reused for the S1, manual-start and plan-change refusal and the S37 exclusion of D26, AC-7.10) |
| `billing.agreements.link.<loading\|valid\|noLongerValid\|blocked\|providerError>` | link page states (AC-4.10, AC-4.12; "processing" uses `billing.agreements.processing.*`) |
| `billing.agreements.link.payerEmail.<label\|help\|invalid>` | the optional "email you'll pay with" field of the link page (AC-4.18; `help` says it is only used to find the payment) |
| `billing.agreements.result.confirming` | `/{lang}/acuerdo/resultado/` |
| `billing.agreements.pricingSituation.<included\|pending>` | "Included in your agreed plan" and "Pending authorization of your agreement" (`agreementState`, AC-7.5) |
| `billing.agreements.errors.<reason>` | the protected and public authorize 409/422 reasons not already in `billing.agreements.blocked.*` (`AGREEMENT_VERSION_NOT_OFFERED`, `AGREEMENT_NOT_LIVE`, `PREVIOUS_ATTEMPT_IN_PROGRESS`, `PREVIOUS_ATTEMPT_CLOSING`, `COMMITMENT_TAKEN`) and the customer-facing reasons of the refusal table (`AGREEMENT_CHILD_ACT_ON_PAYER`, `AGREEMENT_MANAGED`, `AGREEMENT_ADDONS_NOT_AVAILABLE`, `VERTICAL_IN_AGREEMENT`, `AGREEMENT_PAUSE_NOT_AVAILABLE`) |
| `billing.agreements.processing.<title\|retry>` | the "processing" state of the card and the link page (AC-3.3: title and retry button; its body line is `billing.agreements.errors.PREVIOUS_ATTEMPT_IN_PROGRESS` or `..._CLOSING`) |

All new codes go to `apps/api/docs/error-contract.md`; a 4xx is never `INTERNAL_ERROR`.

### Permissions and administrative action

- `PermissionEnum.BILLING_MANAGE_AGREEMENTS = 'billing.manageAgreements'` (camelCase family;
  naming guard green), SUPER_ADMIN-only in `rolePermissions.seed.ts` and seed 0177; migration
  0226 adds the enum value.
- `ACC_28` in `packages/verticals/src/authorization/administrative-actions.ts`
  (`permissions: [BILLING_MANAGE_AGREEMENTS]`); catalog count 27. ACC_18 refuses PRIVATE.
- **Agreement staff gate (D25, AC-10.3).** One service-core helper,
  `assertAgreementStaffAccess({ actor, subject })` in `agreement/agreement-errors.ts` (subject: a
  subscription, payment or reconciliation mark id already loaded by the act), throws 403
  `ADMINISTRATIVE_ACTION_FORBIDDEN` when the subject is a payer or a child (or hangs from one) and
  the actor lacks `BILLING_MANAGE_AGREEMENTS`. Every admin write service and preview keyed by such
  an id calls it right after its own row lookup (the 404) and before any other business rule;
  the existing route permission is unchanged. Why after the 404: the class is known only by
  reading the row, and the contract forbids touching the database before shape validation; an
  unknown id still answers 404, and a 403 tells an actor who already passed the act's staff
  permission only that the row is an agreement row, which the admin subscription list shows
  (AC-10.1). Agreement admin routes need no call (route-gated, AC-1.2); customer acts never call
  it. The admin reads the actor's permissions to hide the write actions on those rows.

### Notifications (outbox)

Recipient and locale of every new template (minor 12): the customer's ACCOUNT email
(`agreement.customer_user_id` -> `users.email`; never `declared_payer_email`, never a provider
email), in the customer's account locale read as in authorization step 7 (by-user-id sibling of
`readAccountLocaleByEmail`, `es` when absent or unsupported); never the link's `locale`, because
the account owner is the recipient whoever opened the link. Dedupe keys: `agreement-confirmed`
and `agreement-link-used` = the activated version id; `agreement-price-decreased` = the
`DECREASE` version id (so AV4 from publish, `apply`, `abandon` or the stale check enqueues it
once).

New templates (es/en/pt, `packages/email`, registry guard): `agreement-confirmed` (enqueued in
the activation transaction, AC-5.1: trade name, verticals with plan names, price, cycle),
`agreement-price-decreased` (old and new amount, and "from which charge": `fromChargeAt` = the
next charge date carried by the SAME fresh provider read that confirmed the new amount at AV4,
falling back to the payer's `subscription.next_charge_at` when the read carries none; when both
are absent the template says "from your next charge" without a date),
`agreement-link-used` (D22: sent at activation when the activated payer is the one a consumed
link records in `consumed_subscription_id`, "Which payer a link records"), to the
ACCOUNT email; authorization date, agreement name = `agreement.trade_name`, "if you don't
recognize this, contact us"; never the token, any payer email or a claim about who paid,
because MP returns `payer_email` empty on preapproval reads and `declared_payer_email` is
never identity). Adapted to list the verticals when the subject is a payer: grace started, grace
reminder, arrears suspension, chargeback suspension, renewal notice, cancellation confirmed,
first charge declined, and the payloads that today carry `subscription.vertical` and would
send NULL for a payer: `signup-incomplete-notice.ts:65` (S3) and the before-cancel kinds
`AUTHORIZATION_EXPIRED` (S3), `ATTEMPT_CANCELLED` (S40, withdraw, AC-5.5) and
`ATTEMPT_REPLACED` (S39).

### Guards and frozen counts

Existing (recount, never add one): administrative-action catalog guard (26 -> 27),
`SALVEDAD_4_TRANSITIONS` count in
`packages/service-core/test/integration/services/reconciliation-exit-game.test.ts:195`
(`toHaveLength(15)` -> 16, `S51` added to the sorted list and to the comment), the
`BEFORE_CANCEL_KIND_BY_TRANSITION` map (`S51: 'DIRECT_CANCELLATION'`, enforced by
`before-cancel-notice-kinds.guard.test.ts`), `catalog-parity.test.ts` (vertical becomes
optional: `.unwrap()`), `packages/analytics/test/billing-catalog.test.ts` (`ACUERDO` cases),
`umami-limits.test.ts` (added by HOS-2119; only if it has merged),
`route-manifest.json`, `check-clock-transitions-never-grant` (S41-S50 classified like their
payer counterparts; S51 and S52 are staff acts, never clock), `source-off-writers.json` (propagation), `live-term-inventories.json`,
`transition-tables.json` + `04-catalogos.md`, `check-catalog-sql` (G18), `check-catalog-key-usage`
(G3), billing-fact-sink / analytics emitters, `b3-schema-from-empty.test.ts`,
`subscription-admin.schema.test.ts`, b9a sources composition (`charged` via payer),
`activation-after-commit.guard.test.ts` (funnel), email template registry (three templates),
subject-coverage and pricing-card guards (`AGREEMENT`), effective-set invalidation,
permission naming and role counts, session-blind guard, `check-no-provider-trial` (G11),
`check:commercial-values` (G7), the reconciliation mark catalog (24 -> 29, every file listed
under "Reconciliation mark reasons (MOT:25-29)"), the cron manifest sync test
(`apps/api/test/cron/schedules-manifest.test.ts`) and the MP stagger guard
(`apps/api/test/cron/mp-cron-stagger.guard.test.ts`: a pending placeholder for minute 38 in
Phase 2, the job exclusive on minute 38 from Phase 4).

New (own CI `Guards` step AND `pnpm check:guards`):

| Guard | Proves | Blind spots |
|---|---|---|
| `check-private-plans-never-public` (+ integration test) | sellable listing reads filter PRIVATE; by-id reads return it | raw SQL strings |
| `check-agreement-children-never-call-provider` | provider calls only after a `provider_link` read; extras 060 is the runtime proof | a provider call keyed otherwise |
| `check-agreement-propagation-coverage` | (a) every status / `service_ends_at` write calls the propagation, refuses agreements, or is inventoried; (b) every class selector has a decision (rule 5) | writes through model methods (inventoried); dynamic class filters |
| `check-payment-method-branches` (new: no such script exists under `scripts/` today) | no unreviewed `paymentMethod` comparison; its inventory starts at 67 comparison sites plus the V1 additions ("`paymentMethod` branch audit"), not the 152 audited lines | dynamic comparisons |

The hourly `billing-agreement-consistency-check` is NOT a guard and has no CI step: it is a
runtime cron registered in `schedules.manifest.ts` and `registry.ts` ("Agreement consistency
check job"; checks (a) to (d)), the safety net behind the guards above; its blind spot is drift
that appears and heals between two runs.

The agreement-scope lock before AG4 needs no guard either: `propagatePayerTransition` takes a
branded `AgreementScopeLock` on the two transitions that may run AG4 (rule 8), so a payer writer
that forgot `lockAgreementScopeForPayer` fails `tsc` (seventh review minor 2). Blind spot: a
writer that obtains the brand and then locks the payer through another path first; the `40P01`
concurrency test of "Lock order" covers the known writers.

New vitest guard (runs with the service-core suite, not a CI `Guards` step):
`agreement-child-emits-no-fact.guard.test.ts` proves every `emitBillingFact(` /
`buildSuspendedFact(` site under `services/billing` calls `isAgreementChild` or is
allowlisted with a reason (D23, "Analytics (D23)"); blind spot: a fact emitted through a
differently named helper. The allowlist has exactly six entries: the four existing sites that
cannot see a child (`credit-payment.service.ts`, `record-charge-fact.service.ts`,
`open-manual-installment.service.ts`, `register-manual-payment.service.ts`) and the two new
payer-only emitters under `services/billing/agreement/` (`afterAgreementActivated` in
`activate-agreement-payer.ts`, reason "reads the ACUERDO payer row only"; the S51
`SUBSCRIPTION_CANCELLED` fact in `agreement-end.service.ts`, same reason). The realign act and
the propagation emit no fact and are not in it.

### Spec-consolidada amendments (same PR as the code)

- **DEC-ARCH-013**: `ACC_28` is a second door for PRIVATE plans and agreements only.
- **DEC-ARCH-001**: children anchor immutable private versions; agreement versions are
  immutable.
- **04-catalogos.md**: S41-S50 (children), S51-S52 (payer), AG1-AG4, AV1-AV8, and the mark
  reasons MOT:25 `HIJA_DE_ACUERDO_DESALINEADA`, MOT:26 `ACTIVACION_SOBRE_VERSION_CERRADA`,
  MOT:27 `VERSION_DE_ACUERDO_SIN_APLICAR`, MOT:28 `ADDON_SOBRE_HIJA_DE_ACUERDO` and MOT:29
  `VIP_TURISTA_DUPLICADO_POR_ACUERDO` (also added
  to `RECONCILIATION_MARK_REASONS` / `RECONCILIATION_MARK_REASON_CATALOG` in `@repo/db`, see
  "Reconciliation mark reasons (MOT:25-29)").
- INV:8 unchanged (it backs V1-a against origin rows only; `findAgreementBlockers` enforces it,
  "`subscription`").

### Dependencies

No external packages. Internal: `@repo/db`, `@repo/schemas`, `@repo/service-core`,
`@repo/verticals` (`ACC_28`), `@repo/payments` (no change: `authorize`, `changeAmount`,
`cancel`, reads; the fake reproduces M3, M5, M8, M9, M11, RP3, RP6), `@repo/email`,
`@repo/i18n`, `@repo/seed`, `apps/api`, `apps/admin`, `apps/web`.

### Risks & Mitigations

| Risk | P | I | Mitigation |
|---|---|---|---|
| A lifecycle writer misses propagation and a child drifts | M | H | single service, propagation-coverage guard, hourly consistency job (MOT:25), a guarded UPDATE that matches no row is MARKED (never aborts, rule 1) |
| A PRINCIPAL-only gate skips the payer (no grace, no S12) | M | H | gate lists above, S11/S12 payer branches, integration test per payer transition |
| A PRINCIPAL-only cron acts on a child alone | M | H | selector inventory, CHECK (no window on children), no-op rule |
| Activation through a site that bypasses the payer branch | M | H | single funnel + extended after-commit guard |
| Private plan leaks to a public surface | L | H | filtering in `packages/db`, guard + test, rank index excludes PRIVATE |
| Customer buys a subscription between offer and authorize | M | M | re-check at authorize + INV:8 23505 mapping |
| Coverage gap when changing package (scheduled end) | H | M | D14 offers the immediate mode; staff compensates by hand |
| Token leakage | L | H | fragment + POST + no-store + no-referrer + hash-only + log test |
| New enum values trip frozen guards | H | L | run all guards before the PR |
| Decrease lost in flight or not announced (M5) | L | M | `APPLYING`, fresh read, mark, own email, expected-amount check |
| Double press refused by the version's own pending children (B1) | M | H | `findAgreementBlockers({ at: 'AUTHORIZE' })` skips them (AC-3.10), double-click test with an outside blocker |
| A regenerated link keeps paying through an old consumed token (M1) | L | M | `issue` revokes every non-revoked link of the version; revocation checked first |
| Double charge: a declined payer's deferred cancel leaves its preapproval live while a new payer is authorized | L | H | authorize step 2b and the widened `findDeclinedWithProviderLinks` (AC-5.6, AC-6.15) |
| Double charge: an S51 provider cancel fails and the old preapproval charges after a new agreement is authorized | L | H | `our-cancellation-retry` and H-7 retry the cancel; S51 in the crossing classifier hangs the charge on MOT:2 for a staff refund (AC-5.9) |
| Deadlock between payer-first writers and agreement-first acts | M | M | one global lock order, `lockAgreementScopeForPayer` ("Lock order"), concurrency test |
| Double Tourist VIP: S1 of a VIP-inheriting plan and authorize of an agreement with a tourist line run at once (D26 and the D18 check share no lock) | L | M | the consistency job's check (e) opens MOT:29 for staff (AC-6.18) |

### Performance Considerations

Tens of agreements, at most 5 children per payer. Propagation locks payer then children in
id order. Indexes: `idx_subscription_payer`, the partial uniques, `token_hash`. Sentry on the
marks MOT:25-29 (`HIJA_DE_ACUERDO_DESALINEADA` first) and agreement authorization provider
errors. The hourly consistency job reads tens of payers and at most a handful of provider reads
(only stale `APPLYING` versions).

### Edge cases

| Case | Behaviour |
|---|---|
| Customer buys a plan in a line's vertical after the offer | authorize 409 with the blocking list; staff withdraws or the customer cancels that plan |
| Two presses / link and session at once | one payer and one preapproval per version; 409 `PREVIOUS_ATTEMPT_IN_PROGRESS` while the first creation is in flight (the island retries, then "processing"), the same checkout URL afterwards (AC-3.3) |
| Link expired / regenerated / used | 410 `EXPIRED` / `REPLACED` / `USED` |
| Authorizes after a newer offer exists | 409 `AGREEMENT_VERSION_NOT_OFFERED` with the offered id; old link 410 `VERSION_CLOSED` |
| Window expires | payer and children `ABANDONED`; agreement stays `OFFERED`; staff issues a new link |
| Staff withdraws or replaces while the customer is on the checkout | read `pending`: payer and children `ABANDONED` with the version close in one tx, then the preapproval cancel (sweep retries); read `active`: 409 and the activation wins (AC-8.6) |
| Customer pays a closed version anyway (race or defect) | no activation; preapproval cancelled, payer `ABANDONED`, mark + alert, manual refund (AC-5.5) |
| New agreement authorized while the old one is still `CANCEL_SCHEDULED` | 409 `AGREEMENT_PREVIOUS_NOT_ENDED`, even with disjoint verticals (AC-3.9) |
| Reconciliation sweep during a decrease | expected amount = the `APPLYING` amount; the retry re-sends the decrease only over the old amount, a third amount gets MOT:5 (AC-8.1, AC-8.19) |
| Agreement declined, customer later buys the vertical alone | S1 ignores the AGREEMENT `CHARGE_DECLINED` child (AC-6.10) |
| First charge declined after activation | payer and children `CHARGE_DECLINED`, coverage loss, agreement `ENDED`; staff offers again |
| Credit lands while pending | credited-pending sweep activates through the funnel; coverage events per child |
| S7 reactivates to `CANCEL_SCHEDULED` | children follow with the same `service_ends_at` |
| Agreement ends with a decrease pending | decrease `FAILED` (an `ACTIVE` agreement never holds an `OFFERED` version, AC-6.9) |
| Decrease outcome unknown, or stuck `APPLYING` | 202 `APPLYING` + MOT:27; staff `apply` or `abandon` (fresh read first), or the stale check promotes on a matching read (AC-8.12, AC-8.14, AC-8.9) |
| A child drifted and nothing ends the agreement | MOT:25 stays open; staff runs "Realign children" (AC-6.12); terminal staff acts force the child instead (AC-6.13) |
| A child left live after the agreement ended | the hourly job forces it to the payer's terminal status (AC-6.14); the realign act resolves the terminal payer too |
| First charge declined while pending, cancel deferred, customer authorizes again | step 2b cancels the old preapproval first and answers 409 `PREVIOUS_ATTEMPT_CLOSING` until it is cancelled (AC-5.6); a standalone S1 does the same (AC-6.15) |
| Link opened after its payer activated | 410 `USED` (consumed link revoked `ACTIVATED`, AC-4.15) |
| Partner setting turned OFF with a live Partner line | keeps running; new agreements cannot add Partner |
| Private plan version retired while anchored | children keep their anchor; an offered version stays authorizable; new offers need current versions |
| Customer asks to close the account | action 24 is refused while the account can still be charged (`ACCOUNT_CAN_STILL_BE_CHARGED`, `apps/api/src/services/account-closure/account-closure-rejection.ts:30`); the customer cancels the agreement first (or staff ends it IMMEDIATE), then closes the account |
| Trial in a line's vertical | converts on the payer's first credit (`charged` via payer) |

## Implementation Approach

Every phase is an independently mergeable PR; no agreement can be created until Phase 6
exposes the admin endpoint, so earlier phases ship dormant code with full tests.

### Phase 1: Schema and private plans

1. [ ] Migrations 0225 (incl. `agreement_version.failed` in `DOMAIN_EVENT_TYPES`), 0226,
   extras 058-060, seed 0177 + `rolePermissions.seed.ts`.
2. [ ] `@repo/schemas`: enums, admin subscription schema (incl. `agreementId`, AC-10.1),
   settings keys, permission.
3. [ ] PRIVATE filtering on sellable listings only (`plan-catalog.model.ts`
   `findSellableCurrentVersions` and siblings) + `findAgreementSelectableVersions`; ACC_18
   refuses PRIVATE.
4. [ ] `check-private-plans-never-public` + integration test; recount schema tests.
4b. [ ] `private-plan.service.ts` and its three admin endpoints (`GET /private-plans`,
   `POST /private-plans`, `POST /private-plans/:planId/versions` with the `plan` row lock,
   AC-2.1 to AC-2.10), gated by
   `BILLING_MANAGE_AGREEMENTS` (0226 lands in this phase); a private plan alone sells nothing,
   so this does not break the "no agreement before Phase 6" rule.

### Phase 2: Payer and children core

5. [ ] `propagatePayerTransition`, `recordCoverageLossForRow`, terms resolver,
   `resolveGraceDays`, coverage `charged` via payer; `lockAgreementScopeForPayer` and the
   global lock order ("Lock order") in every payer writer that can run AG4, with the
   `AgreementScopeLock` brand on `CANCELLED`/`CHARGE_DECLINED` (rule 8); AG4 core inside the
   propagation (rule 8: agreement `ENDED`, `end_reason`, AV8), which S12, S16, S36 and the
   mirrors of this phase need.
6. [ ] Activation funnel (three sites, with the pending check before the closed-version guard,
   AC-5.7) + extended after-commit guard; S16, S4/S5, S6, S7
   (target state), S11 facts branch, S12 payer branch, crossing charge + `SERVICE_END_MOVED`,
   direct cancel, revocation with its refund (D24, AC-6.16), provider mirrors; first-credit `ACUERDO` branch;
   the crossing MARK for a charge on an `ABANDONED` payer (MOT:2, AC-5.8); the
   `agreement-confirmed` template (es/en/pt, registry), which `activateAgreementPayer` enqueues.
7. [ ] Refusals (child acts, courtesy, S35, pauses, add-ons, promos, S1, S13; S13 under the
   customer `users` row lock, AC-9.4); the D26 S1/manual-start/succession refusal and S37 cohort exclusion (AC-7.10); the D25 staff
   gate `assertAgreementStaffAccess` in every admin write service keyed by a payer, child,
   payer payment or agreement mark (AC-10.3); the widened
   `findDeclinedWithProviderLinks` (`verticals`, payers in, children out; AC-6.10, AC-6.15);
   selector decisions; S41-S50 in the catalogs; propagation-coverage, payment-method and
   children-never-call-provider guards; `mapPayerStatus` (full table) and the propagation's
   `MARK`/`FORCE` modes; the `billing-agreement-consistency-check` cron job with checks (a)
   child drift, (b) vertical add-ons (AC-6.17), (d) live children of a terminal payer
   (AC-6.14) and (e) a duplicate Tourist VIP (AC-6.18) only (manifest entry at minute 38, NOT exclusive, minute reserved by the pending
   placeholder of "Agreement consistency check job"; AC-6.4, AC-6.11); mark reasons MOT:25-29 with every recount of
   "Reconciliation mark reasons";
   the payer `ACUERDO` branch (with `agreementVerticals`/`lineCount`) in every payer fact
   emitter (AC-11.1); the `isAgreementChild` skip in every listed emitter plus the
   `agreement-child-emits-no-fact` guard (AC-11.2, AC-11.6);
   USER/GLOBAL add-on placement skip (`addon-sources.ts`, D20); D23 facts + analytics catalog
   (`catalog-billing.ts`: `ACUERDO`, `agreement_verticals`, `line_count`, the per-event
   `.superRefine`, no walker-unsupported Zod types; parity test), the `AGREEMENT_ENDED`
   cancellation path in both enums, and the API sink
   (`apps/api/src/utils/analytics/analytics-facts.ts`: admit `ACUERDO`, omit `vertical` when
   absent, sort and join `agreement_verticals`).
   **Exit criterion:** integration tests run the REAL services for every payer transition
   (activation through each of the three sites, S16, S4, S5, S6 arrears, chargeback
   suspension, S7 both targets, S11 (customer and staff via ACC_8), S12, S12 chargeback,
   direct cancel, provider cancel mirror, S36 including a forced drifted child, crossing
   charge) on the fake with lies ON, including the notice content built for the payer; stubs
   do not count. S51 is NOT in this criterion: `endAgreement` ships in Phase 4.

### Phase 3: Authorization and signed link

8. [ ] `agreement-offer.service.ts` (`validateAgreementTerms`, the create and preview services
   behind `POST /` and `POST /preview`, no route yet: Phase 3 tests create offers through the
   service), `findAgreementBlockers`, `signed-action-link.service.ts`, `authorizeAgreement`
   (with the LINK pre-pass, AC-4.17), `resolveAgreementPayerReuse` (in-flight and expired-window
   checks, AC-3.3), creations-sweep reason; `buildAgreementReturnUrl` +
   `returnUrlBuilder` and the account-locale read (AC-3.13); `signed_action_link.locale`;
   regenerate revoking consumed links (AC-4.11); the nine-row resolve precedence (AC-4.14);
   `ACTIVATED` revocation wired into `activateAgreementPayer` (AC-4.15); staff revoke covering
   consumed links (AC-4.16); AG4's link-revocation step (`VERSION_CLOSED`); the payer email rule
   (AC-4.18); `authorizeAgreement` without a `returnUrl` input, with step 2b
   (AC-5.6), the step 3 declined re-read and its transaction boundaries; the "Which payer a link
   records" rule (AC-4.8); link `issue`/`revoke` under the agreement -> version locks (AC-4.19);
   the `users` row lock first in authorize (AC-9.4), the step 5 23505 mapping and the authorize
   dry run without the declined re-read (AC-3.15).
9. [ ] Protected and public endpoints (dormant, `POST /resolve` shape per D21, closed
   `AgreementLinkResolveResponseSchema` and `AgreementsMineResponseSchema`, public authorize
   without any email field, rate limits per AC-4.13 in the order IP -> body validation ->
   token), error-contract entries, `agreement-link-used` (enqueued at activation, D22); the
   own-subscriptions exclusion (AC-3.14).

### Phase 4: Version changes and ending

10. [ ] `publishAgreementVersion` (INITIAL replace through the shared `validateAgreementTerms`,
    AC-8.15; DECREASE via `APPLYING` with the 201/202/422 outcomes, AC-8.13, AC-8.14; refusal
    of other changes), `withdrawAgreement` (the AC-8.6 sequence plus AG3), `apply`, `abandon`
    (AC-8.12) and the amount-retry rule for a `FAILED`
    `S52` version (`findLatest` returning `agreementVersionId`, port widened to `S52`, every AV7
    recorded as `agreement_version.failed`), `S52` in both `TRANSITIONS` and the input type;
    the DECREASE validations (AC-8.16), `apply` refusals (AC-8.17) and the MOT:27 lift rule;
    the consistency job's check
    (c) stale `APPLYING` (AC-8.9), with the job turned `exclusive: true` and the pending
    placeholder removed in the same PR (AC-6.11); `endAgreement` with S51 (`FORCE`, AC-6.13); the realign act
    (AC-6.12); AG4's AV7 step and its MOT:27 lift (rule 8); the provider-call and zero-row rules
    of "Lock order" for the decrease, `apply` (with the confirmed re-send), `abandon` (third
    amount -> MOT:5), withdraw/replace and check (c) (AC-8.6, AC-8.18); the amount retry's
    pre-send re-read and its `APPLYING` rule (AC-8.19); the withdraw/replace exception for a payer
    S3 abandoned (AC-8.6); `S51` in the crossing classifier (AC-5.9); the `agreement-price-decreased` template
    (the other two agreement templates ship where they are enqueued: `agreement-confirmed` in
    Phase 2, `agreement-link-used` in Phase 3).
    **Exit criterion:** integration tests run the real services for S51 from each of the four
    payer states (with a forced drifted child), a decrease confirmed, uncertain, refused and
    abandoned (both read outcomes), the stale check, and the realign act, on the fake with
    lies ON.

### Phase 5: Customer web

11. [ ] `AGREEMENT` pricing situation with `agreementState` + `PlanCardCta.client.tsx` (AC-7.5); `AgreedPlanCard.client.tsx`
    (with `pendingVersion`, AC-3.16, and "Cancel agreement" in grace and suspension, AC-7.1);
    `/{lang}/acuerdo/` and `/{lang}/acuerdo/resultado/`; i18n es/en/pt.

### Phase 6: Admin (enables creation)

12. [ ] The admin agreement endpoints of "API Design" over the Phase 3-4 services (`POST /`
    and `/preview` on `agreement-offer.service.ts`, list, detail, withdraw, versions, apply,
    abandon, end, realign, payment link; the private-plan endpoints shipped in Phase 1);
    wizard, list, detail (admin response schemas), link copy and revoke, decrease with
    retry/abandon, realign children, end, private-plan editor reuse, settings; the
    `admin-billing.agreements.*` keys of "i18n keys"; the subscription detail hides payer and
    child write actions without `BILLING_MANAGE_AGREEMENTS` (D25, AC-10.3).

### Phase 7: Docs, guards, smoke

13. [ ] Spec-consolidada amendments, `apps/api/docs/route-architecture.md`, error contract,
    `docs/billing/smoke-checklist.md` agreement section, CLAUDE.md billing block (including
    `billing-agreement-consistency-check` under "Crons", "Payments and reconciliation").
14. [ ] `pnpm check:guards`, staging smoke, production smoke.

## Testing Strategy

AAA, 90 % coverage target. Integration tests use the real database (an `isDbAvailable()`
skip is not a pass). Provider behaviour uses `@repo/payments/fake` with lies ON; any
`honestAbout` must justify itself (G15).

- **Unit**: propagation mapping (exhaustive, no-op and MARK cases: a guarded UPDATE that
  matches no row opens MOT:25 and never throws), blockers resolver (`OFFER` and `AUTHORIZE`),
  version change classification, link token issue/resolve/hash, terms and grace resolvers,
  wizard validators with `PROVIDER_AMOUNT_FLOOR_MINOR`.
- **Integration (DB)**: every CHECK, FK, partial unique and trigger (extras 058-060); INV:8
  23505 mapping; each payer writer through its real service asserting S41-S50; the three
  activation sites through the funnel; S11/S12 payer branches; crons and selectors never pick
  a child; first credit emits one event per child vertical and converts a trial; private plan
  absent from sellable listings and present by id; ADMIN 403 on settings writes.
- **API**: auth order, shapes, every error code; public endpoints `no-store`, rate limit,
  token never logged.
- **Admin / Web**: wizard (blocked verticals with reasons), link copy shown once, decrease and
  end; island states, fragment removed, `AGREEMENT` CTA, Agreed plan card, cancel dialog.
- **E2E (Playwright, fake provider server)**: offer -> authorize from My account -> fake
  authorizes -> first credit; link path without login; price decrease; end and re-offer.
- **Guards**: mutation fixtures for each new guard (removed propagation call, new
  `paymentMethod` comparison, PRIVATE listing leak, unlisted class selector).

| AC | Test (type) |
|---|---|
| AC-1.1 | API create + audit; `AgreementCreateRequestSchema`: missing or blank `tradeName`, `tradeName` of 121 characters, `internalNotes` of 2001 characters and two lines with the same vertical -> 400; empty `lines` -> 422 `AGREEMENT_NO_LINES` (and listed by the preview); `POST /:id/versions` rejects `tradeName` (closed schema) (API, integration, unit) |
| AC-1.2 | 403 matrix; menu render (API, admin) |
| AC-1.3 | field message + disabled Next, Zod unit, API 422 (unit, admin, API) |
| AC-1.4 | 409 `AGREEMENT_ALREADY_OFFERED` / `_ALREADY_LIVE` with `existingAgreementId` and unchanged row counts; 201 when the live payer is `CANCEL_SCHEDULED`; two concurrent submissions -> one 201 and one 409, never 500 (API, integration) |
| AC-1.5 | API 409 with seeded grant; `details.blocking` rows parse against `AgreementBlockingRowSchema` with `kind: 'PERMANENT_GRANT'`, and the AC-1.7 rows with `kind: 'SUBSCRIPTION'` (API) |
| AC-1.6 | API 422 + wizard hides Partner (API, admin) |
| AC-1.7 | blockers for each live status and method, tourist when VIP; live COMPLEMENTO by scope: `VERTICAL_SUBSCRIPTION` and `LISTING` targeting a line vertical block, a USER-scope and a GLOBAL-scope add-on whose `COMPLEMENTO` row carries a line vertical (bought through a title there) do NOT block, a `VERTICAL_SUBSCRIPTION` add-on on another vertical does not block; own `CANCEL_SCHEDULED` agreement's children skipped at offer but not at authorize (integration, API, admin) |
| AC-1.8 | defaults + 422 (API, admin) |
| AC-1.9 | 422 in-agreement and outside VIP inheritance (API, integration) |
| AC-2.1 to AC-2.6 | private plan creation, guard test, extras 058, rank index (integration, guard) |
| AC-3.1 | card render (web) |
| AC-3.2 | payer + children + fake preapproval without start date (integration, E2E) |
| AC-3.3 | second press (SESSION and LINK) while the fake holds the first creation open -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`, one payer, one fake preapproval; a press after completion -> same checkout URL with `reused: true`; a pending payer past `authorization_window_ends_at` -> 409 `COMMITMENT_TAKEN`, no write, no provider call; island: one automatic retry after ~2 s, then the "processing" state with a working retry button, for both `PREVIOUS_ATTEMPT_IN_PROGRESS` and `PREVIOUS_ATTEMPT_CLOSING` (integration, unit, web) |
| AC-3.4 to AC-3.6, AC-3.8 | API errors; AC-3.5 leaves the version and link valid and the retry succeeds once the freeze lifts (API, integration) |
| AC-3.7 | blocker appears after offer, both paths; INV:8 race maps to the same 409 (integration) |
| AC-3.9 | old agreement CANCEL_SCHEDULED with disjoint verticals; authorize refused on both paths (integration) |
| AC-4.1 to AC-4.7, AC-4.9 | link lifecycle; AC-4.5 after a `CREATION_NOT_APPLIED` replacement resolves to the new payer, old payer and children `ABANDONED` with an `S39` decision; the public authorize response has no email key (`strictObject` rejects `declaredPayerEmailMasked`) while the protected one carries it (unit, API, integration, guard) |
| AC-4.8 | `agreement-link-used` enqueued once at activation for a link-created payer, in the locale, without payer email or token; none for a session-only authorization, a link payer that never activates, a replacement payer after a `CREATION_NOT_APPLIED` made from My account (AC-4.5), or a later payer authorized from My account after the link payer was abandoned; SENT once for a `CREATION_NOT_APPLIED` replacement made through a LINK authorize, after which `consumed_subscription_id` = the new payer; SENT once when L, after its own payer was abandoned, is used for a LINK authorize that reuses a pending payer created from My account (integration, email template render) |
| AC-4.10 | 410/404 page renders only the generic message; error body without agreement data (API, web) |
| AC-4.19 | two concurrent `POST /payment-link`: both 201, one open link, the first `REGENERATED`; version withdrawn before the second's lock -> 409 `AGREEMENT_VERSION_NOT_OFFERED`; a forced 23505 (unit, stubbed insert) -> 409 `AGREEMENT_LINK_CONCURRENT_ISSUE` (integration, unit) |
| AC-5.1 | activation via notice, read, S3 and credited-pending, one tx (integration) |
| AC-5.2 | window expiry propagation (integration) |
| AC-5.3 | S16 from PENDING and from ACTIVE; agreement ENDED vs OFFERED (integration, fake) |
| AC-5.4 | first credit events + trial conversion (integration) |
| AC-5.5 | DB fixture: a `PENDING_AUTHORIZATION` payer seeded directly on a `WITHDRAWN` version (the withdraw act would abandon it and reach AC-5.7 instead); the fake authorizes it via notice, S3 and credited-pending; one cancel, payer ABANDONED, mark, no retry loop (integration, fake) |
| AC-6.1 to AC-6.3 | each payer writer propagates; S7 both targets; S6 and chargeback suspension build per-line notice content for the payer; `end_reason` per the derivation table, including a staff S11 through ACC_8 -> `STAFF_CANCELLED` via the `actorType` returned by `findCancellationDecision` (integration) |
| AC-6.4 | consistency job opens MOT:25 on a drifted child (integration) |
| AC-6.5 | extras 060 + static guard (integration, guard) |
| AC-6.6 | selectors never pick children (integration) |
| AC-6.7 | crossing-charge extension S50 (integration) |
| AC-6.8 | no-op; MARK + alert on a notice, on a customer S11 and on a staff S11 through ACC_8 with a drifted child; no endpoint answers `AGREEMENT_CHILD_STATE_MISMATCH` (unit, integration) |
| AC-6.9 | AG4 with an `APPLYING` decrease -> `FAILED`, active -> `ENDED`, links revoked; a separate `OFFERED` agreement of the customer untouched (integration) |
| AC-6.10 | S1 after a declined agreement proceeds (integration) |
| AC-7.1 | from ACTIVE: S11 facts from the version, add-on S11 rule skipped, S12 payer branch; from GRACE_PERIOD and SUSPENDED: direct cancel S49; preview outcome; the card renders "Cancel agreement" for a payer `ACTIVE`, `GRACE_PERIOD` and `SUSPENDED` (integration, E2E, web) |
| AC-7.2 to AC-7.4, AC-7.6 | one table-driven test over every row of the refusal table (act x child/payer/vertical -> reason, nothing written); courtesy hidden in the admin detail for payer and child (API, integration, admin) |
| AC-7.7 | USER-scope purchase skips the agreement vertical and resolves in W; no non-agreement title and one vertical skipped -> `AGREEMENT_ADDONS_NOT_AVAILABLE`; no title and nothing skipped -> `NO_VALID_TITLE` (integration) |
| AC-7.8 | pre-existing USER add-on stays `ACTIVE` and charging, absent from the agreement verticals' effective set, no consistency mark, absent from the per-line suspension notice (integration) |
| AC-7.5 | pricing situation + CTA: a `PENDING_AUTHORIZATION` child -> `agreementState: 'PENDING_AUTHORIZATION'` and the "pending" copy, never "included"; `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED`, `CANCEL_SCHEDULED` -> `INCLUDED`; no checkout button in either (API, web) |
| AC-8.1, AC-8.2 | decrease via `APPLYING` with fake `changeAmount` + M5 email; reconciliation sweep run while `APPLYING` re-sends the NEW amount over the old one (AC-8.19 covers the third amount); decision recorded as `S52`; PERIOD comparison picks the version effective at `chargeCreatedAt` and is `NOT_COMPARABLE` during `APPLYING`; refusals (integration); unit: after a confirmed decrease, a charge created after AV4 matches exactly one version (the `DECREASE`), with the old version's `closed_at` equal to the new one's `activated_at`; `ck_agreement_version_closed_at` / `_activated_at` reject a closed status without `closed_at` and an `ACTIVE` row without `activated_at` (unit, integration) |
| AC-8.3 to AC-8.5 | version rules and withdraw (API) |
| AC-8.6 | withdraw and replace with a pending payer on the fake: latest key open -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`, nothing sent; no link and latest key completed as `REJECTED_BY_PROVIDER` (fake creation rejected) and as `THROTTLED_BY_PROVIDER` (429) -> abandoned with zero provider calls; a payer with an older rejected key and a newer OPEN key (retry after a rejection) -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS` (the latest key decides); no link and any other completed result -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`; link present and `pending`/`cancelled` read -> one tx then cancel, failed cancel retried by the sweep; `active` (or any other) read -> 409 `AGREEMENT_PAYER_AUTHORIZING` and activation; re-validation: the payer activates (or its latest key changes) between the `pending` read and the writing transaction -> 409 `AGREEMENT_PAYER_AUTHORIZING`, nothing written, no cancel; S3 abandons the payer in that gap -> the withdraw proceeds (version `WITHDRAWN`, agreement `WITHDRAWN`), no cancel sent by the act; no transaction holds a lock during the fake read (integration) |
| AC-8.7 | end then re-offer with OVERLAPPING and with disjoint verticals: offer accepted, authorize blocked until old ENDED, then succeeds (integration, E2E) |
| AC-8.8 | full mode x payer-state matrix, incl. an `OFFERED` agreement with no payer and with a pending payer -> 409 `allowedModes: []` for both modes; S51 creates no refund, writes before the provider cancel, failed cancel retried by the sweep; S51 with a drifted child proceeds and forces it (integration) |
| AC-8.9 | stale `APPLYING` promoted on a matching read with MOT:27 lifted by `SYSTEM_USER_ID`; marked on a mismatching or failed read; young `APPLYING` ignored; threshold read from the setting (integration, fake) |
| AC-9.1, AC-9.2 | S13 refusal; Partner OFF (integration) |
| AC-9.3 | ADMIN 403 (API) |
| AC-10.1, AC-10.2 | admin list/detail; `agreementId` set for the payer and each child, `null` for other rows, and the "via agreement" link uses it (API, admin) |
| AC-10.2 (payer shown) | agreement whose version had an `ABANDONED` payer and then a live one: detail `payer` and list `payerStatus` show the live one and `children` only its children; with no live payer, the newest by `created_at DESC, id DESC` (API) |
| AC-10.3 | table-driven over every gated admin write endpoint and preview: ADMIN with the route permission on a payer id and on a child id -> 403 `ADMINISTRATIVE_ACTION_FORBIDDEN`, no `details`, nothing written, zero fake calls; unknown id -> 404; non-agreement row -> unchanged; SUPER_ADMIN -> the act runs; the gate answers before any other refusal (a child id gets 403, not `AGREEMENT_CHILD_ACT_ON_PAYER`); the subscription detail renders no write action for an ADMIN on a payer or child (API, integration, admin) |
| AC-11.1, AC-11.2 | payer facts with class `ACUERDO`, no `vertical` key, and `agreement_verticals` (sorted, comma-joined, also when the emitter reads the lines unsorted) plus `line_count` for activation, credit, rejection, grace, suspension, recovery, cancel scheduled (S11 by the customer and by staff via ACC_8; S7 to `CANCEL_SCHEDULED` emits `RECOVERED` only; the S48 mirror emits nothing), cancelled (S51 -> `path: 'AGREEMENT_ENDED'`); each fact goes through `createAnalyticsFactSink` with a capture spy: the spy is called, `!('vertical' in properties)` and both agreement properties match; across every one of those acts the spy records ZERO calls with a child's `subscriptionId` (integration, unit on `apps/api/src/utils/analytics/analytics-facts.ts`); per listed emitter a unit test that an `AGREEMENT` child row produces no fact; `agreement-child-emits-no-fact.guard.test.ts` (guard, with a mutation that removes one `isAgreementChild` call, and an allowlist test that pins its six entries) |
| AC-11.3, AC-11.4 | catalog `.superRefine` accepts/rejects per class (`vertical` vs `agreement_verticals`/`line_count`, `plan_version_id`/`billing_option_id` on activation); `line_count` 51 and a 501-character `agreement_verticals` rejected; `AGREEMENT_ENDED` accepted (new case next to `billing-catalog.test.ts:144-158`; no frozen enum count changes); parity with `VerticalEnum` via `.shape.vertical.unwrap()`; forbidden-key and `pf_entity_id` checks; no `z.intersection`/`.and()`/`z.record`/`z.tuple`/`z.lazy` in the catalog (HOS-2119 `umami-limits.test.ts` when present) (unit in `packages/analytics`, `catalog-parity.test.ts`) |
| AC-2.7 to AC-2.9 | fixed defaults written (`rank`, `trial_days`, `allows_pause`, `grace_days`); extra field -> 400; second version flips `current`; duplicate slug -> 409 `PRIVATE_PLAN_SLUG_TAKEN`; PUBLIC `planId` -> 404; base version with a role or another vertical -> 422 (API, integration) |
| AC-3.10 | double press with an OUTSIDE blocker absent: second press returns the same payer (`reused`), no 409; same after a rejected creation (re-mint) and after `CREATION_NOT_APPLIED` (replacement); with a live tourist PRINCIPAL seeded after the first press next to a VIP-inheriting line -> 409 listing only the tourist row (integration, API) |
| AC-3.11 | `/agreements/mine` with old ACTIVE + payer `CANCEL_SCHEDULED` and new OFFERED: two entries, ACTIVE first, `authorize.allowed = false` with `AGREEMENT_PREVIOUS_NOT_ENDED` and `availableAfter`; closed schema rejects an extra key (API, web) |
| AC-3.12 | each of the three 422 reasons provoked between offer and authorize, both paths; nothing written, link not consumed (integration, API) |
| AC-3.13 | SESSION, LINK and creations-sweep payers all get `/{lang}/acuerdo/resultado/` with no query; locale from account, from `signed_action_link.locale`, and `es` fallback for an unknown value; S1 keeps `buildAuthorizationReturnUrl` (unit on `authorization-return-url.ts`, integration) |
| AC-4.11 | regenerate after a consumed link: old token -> 410 `REPLACED`; revoked checked before consumed; LINK reuse consumes the open link (integration, API) |
| AC-4.12 | resolve returns `AUTHORIZABLE`, `CHECKOUT_PENDING`, `BLOCKED` with each `blockedReason`; a pending payer plus a freeze -> `BLOCKED`, not `CHECKOUT_PENDING`; authorize re-checks and answers 409/422 when a blocker appears after resolve; resolve with a declined live-preapproval payer makes zero provider calls (no step 2b); public bodies carry no ids (API, web) |
| AC-4.13 | 11th resolve per minute from one IP -> 429 with `Retry-After`; 6th authorize per token per minute -> 429; the rate-limit store holds no plain token; an invalid body -> 400 before the token limiter (5 invalid bodies then a valid one is not 429) (`HOSPEDA_TESTING_RATE_LIMIT` set) (API) |
| AC-4.14 | one table-driven test per precedence row, plus overlap cases: revoked AND expired -> the revoke cause; expired AND payer `ACTIVE` -> `EXPIRED`; consumed link with payer `ACTIVE` and not revoked (revocation row deleted in the fixture) -> `USED`, never `CHECKOUT_PENDING`; consumed, version `WITHDRAWN`, no live payer -> `VERSION_CLOSED`; same order on resolve and public authorize (unit, API) |
| AC-4.15 | seeded open + consumed fixture; activation revokes consumed links `ACTIVATED` and open links `VERSION_CLOSED` in the same tx; both answer 410 afterwards; `agreement-link-used` still sent per AC-4.8 (integration, API) |
| AC-4.16 | same seeded fixture; `DELETE /payment-link` revokes open and consumed links `STAFF_REVOKED`; pending payer untouched; 204 with nothing to revoke (API, integration) |
| AC-4.17 | for each of AC-4.14 rows 1 to 6, with a declined payer whose preapproval the fake keeps live: public authorize answers the row's 404/410, the fake records zero reads and cancels, no before-cancel notice is enqueued; a version `WITHDRAWN` between the pre-pass and the locks still answers 410 `VERSION_CLOSED` (API, integration, fake) |
| AC-4.18 | link page field: blank -> no `payerEmail` key and `declared_payer_email` NULL; `Juan@Mail.com ` stored as `juan@mail.com` and forwarded to the fake as `payer_email`; malformed -> field message and 400; no public response carries it; protected body with `payerEmail` -> 400; a SESSION payer has `declared_payer_email` NULL and the creations sweep still searches by the account email (API, integration, web) |
| AC-3.14 | own-subscriptions excludes the payer and the children, returns the non-agreement PRINCIPAL, parses against the unchanged schema; `MySubscriptions.astro` renders no agreement row (API, web) |
| AC-6.12 | realign writes the drifted child to `mapPayerStatus`, lifts its MOT:25, emits a coverage event and no fact; no-op when aligned; 409 `AGREEMENT_NO_PAYER` only for an agreement that never had a payer; an `ENDED` agreement with a `CANCELLED` payer and a `GRACE_PERIOD` child -> child `CANCELLED`; 403 without the permission; `mapPayerStatus` unit-tested over all nine payer statuses (unit, integration, API) |
| AC-6.13 | S51 and S36 with a drifted live child: payer and child `CANCELLED`, MOT:25 opened and lifted by the actor in the same tx; withdraw/replace with a drifted child: forced `CANCELLED`, consistent children `ABANDONED`; a terminal drifted child left as is (integration) |
| AC-7.9 | staff S11 via ACC_8 -> `CANCEL_SCHEDULED` propagated, `end_reason = STAFF_CANCELLED` at S12; no credited period -> `service_ends_at = now`; staff direct cancel from grace -> `STAFF_CANCELLED` (integration) |
| AC-8.12 | abandon: new-amount read -> promoted and 409 `AGREEMENT_VERSION_ALREADY_APPLIED`; old-amount read -> `FAILED`, decision with the actor, MOT:27 lifted; third amount -> 200 `FAILED`, MOT:27 lifted, MOT:5 open on the payer, later sweep sends no `changeAmount`; read failure -> 503; after `FAILED` the AUTHORIZATION expected amount is the `ACTIVE` one, a charge inside the closed interval is `NOT_COMPARABLE`, and the amount retry inside its window does NOT call `changeAmount` (fake call count 0) but reports the divergence; a full reconciliation sweep after the abandon completes without `INVALID_RECORDED_AMOUNT_MUTATION_TRANSITION` (the AV7 event is `agreement_version.failed`, invisible to `findLatest`) and makes zero `changeAmount` calls (integration, fake) |
| AC-8.13 | fake refuses `changeAmount` -> 422 `AGREEMENT_PROVIDER_REJECTED_AMOUNT`, version `FAILED`, payer version and email unchanged; later sweep sends nothing (integration, API) |
| AC-8.14 | fake timeout / 5xx / stale read -> exactly 202 `{ applied: false, status: 'APPLYING' }`, MOT:27 open, never 503; confirmed -> 201 `applied: true` (API, integration) |
| AC-8.15 | replacing an offer returns each 422/409 of `POST /` (one case per code, incl. Partner OFF, tourist VIP inside and outside, grace = cycle, line not current, outside live subscription, permanent grant); the old offer's pending children are not counted; any refusal leaves the old offer, payer and links untouched (API, integration) |
| AC-5.1 (email) | `agreement-confirmed` renders verticals, amount, cycle in es/en/pt (email template render) |
| AC-5.5 (payments) | the payments of the abandoned payer hang on the MOT:26 mark; `refundConfirmation = true`, `defaultProposal = 'REFUND'` (the new MOT:26 entry of `RECONCILIATION_MARK_REASON_CATALOG`, "Reconciliation mark reasons (MOT:25-29)") (integration) |
| AC-6.11 | job registered in the manifest at `38 * * * *`; Phase 2: not exclusive, placeholder pending entry present, stagger guard green; Phase 4: `exclusive: true`, placeholder gone, stagger guard green, two overlapping runs -> one skipped by `withCronLock`; a repeated drift accumulates on the open mark (unit, integration) |
| AC-8.10 | same terms -> 422 `AGREEMENT_VERSION_NO_CHANGE`; grace-only change -> 422; decrease with a new grace applied to a grace entered after AV4, not to a running one (API, integration) |
| AC-8.11 | PERIOD comparison for an INITIAL version uses the payer's `created_at` as `effective_from` (unit, integration) |
| AC-11.5, AC-11.6 | activation through each of the three sites yields exactly one `SUBSCRIPTION_ACTIVATED` (payer, `ACUERDO`) and none for children; a 3-line agreement entering grace yields exactly one `GRACE_STARTED` in total (`line_count: 3`) (integration) |
| Notices (verticals) | grace started/reminder, arrears and chargeback suspension, renewal, cancellation confirmed, first charge declined, signup incomplete and the before-cancel kinds list the verticals for a payer and never send a NULL vertical (email template render, integration) |
| Mark catalog | MOT:25-29 in `RECONCILIATION_MARK_REASONS`, the schemas vocabulary, admin labels, enrichment labels; recount tests 24 -> 29, `refundConfirmation` count 9 -> 10, `defaultProposal` counts `REFUND` 8 -> 9 and `NONE` 14 -> 18; migration 0225 CHECK accepts 25-29 (unit, integration) |
| AC-5.6 | declined payer with a `DEFERRED` cancel (fake keeps the preapproval live): re-authorize -> 409 `PREVIOUS_ATTEMPT_CLOSING`, one before-cancel notice and one fake cancel, nothing written; next press after the fake reports `cancelled` -> P2 created; never two live preapprovals; the same through a regenerated link, while P1's consumed link answers 410 `USED`; a standalone PRINCIPAL declined (cancel deferred) between step 2b and step 3 -> 409 `PREVIOUS_ATTEMPT_CLOSING`, nothing written (integration, fake) |
| AC-5.7 | two activations of one pending payer run concurrently (notice and credited-pending sweep): exactly one activation, the other returns `{ activated: false, terminal: true }`; zero fake cancels, zero MOT:26, version and agreement `ACTIVE`, one `SUBSCRIPTION_ACTIVATED`; activation of an `ABANDONED` payer on a still-`OFFERED` version -> no-op, no AV3/AG2, links untouched, no email (integration, fake) |
| AC-5.8 | withdraw with a failed fake cancel, then the fake charges and the charge is credited: the payment hangs on MOT:2 on the payer, the mark cannot be lifted while it is unresolved, staff refund from the mark resolves it; the same after an AC-5.5 abandon (a second, later charge); a `PRINCIPAL` `ABANDONED` row keeps today's `NONE` (unit on `cancellation-crossing-rule.ts`, integration, fake) |
| AC-6.14 | job: live `GRACE_PERIOD` child under a `CANCELLED` payer of an `ENDED` agreement -> child `CANCELLED`, coverage loss, MOT:25 opened and lifted by `SYSTEM_USER_ID`, one coverage event; `ACTIVE` child under an `ABANDONED` payer -> `CANCELLED`; `PENDING_AUTHORIZATION` child under an `ABANDONED` payer -> `ABANDONED`; a terminal child under a terminal payer not selected (integration) |
| AC-6.15 | S1 and the manual signup in a vertical outside the agreement, with a declined payer whose preapproval is live -> 409 `PREVIOUS_ATTEMPT_CLOSING` and the payer's preapproval cancelled; children never selected; unit test of the widened `findDeclinedWithProviderLinks` query (integration, unit) |
| AC-6.16 | S36 preview on an `ACTIVE` payer shows the full last charge as the refund; confirm -> payer and children `CANCELLED`, agreement `ENDED` `REVOKED`, one RF1 of the full amount on the payer's payment, preapproval cancelled after commit, one payer `SUBSCRIPTION_CANCELLED` `path: 'REVOKED'` and no child fact; a drifted child forced (AC-6.13); `SUSPENDED` payer and a closed window keep S36's refusals; child id -> `AGREEMENT_CHILD_ACT_ON_PAYER` (integration, API, fake) |
| AC-6.17 | seeded `VERTICAL_SUBSCRIPTION` add-on on a child -> MOT:28 on the child, add-on untouched; second run accumulates; USER/GLOBAL add-on -> no mark (integration) |
| AC-6.18 | seeded live agreement tourist child + live non-agreement VIP-inheriting `PRINCIPAL` -> MOT:29 on the `PRINCIPAL`, nothing written; second run accumulates; without the `PRINCIPAL` -> no mark (integration) |
| AC-8.16 | decrease above `maxChargeMinor`, below the floor, and with grace = cycle -> 422; with the Partner setting OFF and a retired line plan version -> still accepted (API, integration) |
| AC-8.17 | `apply` with payer `GRACE_PERIOD` -> 409 `AGREEMENT_PAYER_NOT_ACTIVE`, no provider call; old-amount read and fake refusal of the re-send -> 422, version `FAILED`, `agreement_version.failed` event, MOT:27 lifted by the actor; new-amount read -> 200 `ACTIVE` with MOT:27 lifted; third-amount read -> 409 `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` with `details.providerAmountMinor`, nothing written, zero `changeAmount` calls; `apply` with a matching `confirmResendOverAmountMinor` -> one `changeAmount` with the `APPLYING` amount, then promote / 422 / 200 `APPLYING` per the fake; a stale confirmation -> 409, zero calls (integration, API) |
| AC-8.18 | publish vs abandon: the fake holds `changeAmount` until abandon commits `FAILED`, then applies the new amount -> 409 `AGREEMENT_VERSION_NOT_APPLYING`, version stays `FAILED`, MOT:5 open on the payer, no email, no MOT:27; publish vs AG4 (S51 during the call) -> 409, no write, no mark; the same race on the refusal and unknown-outcome paths writes nothing; `apply` and `abandon` on a version `FAILED` meanwhile -> 409; job vs abandon: the fake read for check (c) returns the new amount, an abandon commits `FAILED` before the job's transaction -> the job writes nothing (no AV5/AV4, no email), the version stays `FAILED`; a forced 0-row AV4 after AV5 rolls both back (old version still `ACTIVE`); amount retry vs abandon: abandon commits between the comparison's start and its pre-send re-read -> zero `changeAmount` calls (integration, fake, unit) |
| Lock order (minor 3) | activation, S51 and AG4 through S12 run concurrently on one agreement: no `40P01`, final state consistent; authorize steps 1-5 roll back together on a step 5 failure (integration) |
| MOT:27 lift (minor 2) | every exit from `APPLYING` (publish, `apply`, `abandon`, stale check, AG4) leaves no open MOT:27 on the payer, with `liftedBy` = the actor or `SYSTEM_USER_ID` (integration) |
| AC-2.10 | two concurrent version publishes on one private plan: both 201, one `current` version; a forced 23505 (unit, stubbed insert) -> 409 `PRIVATE_PLAN_CONCURRENT_PUBLISH` (integration, unit) |
| AC-3.15 | old declined attempt whose fake preapproval is `cancelled`: `/agreements/mine` -> `authorize.allowed = true`, resolve -> `AUTHORIZABLE`, zero fake calls; the real authorize then proceeds (API, integration, fake) |
| AC-3.16 | `/agreements/mine` with a `DECREASE` `APPLYING`: `version` = the `ACTIVE` one, `pendingVersion` with the `APPLYING` amount; `null` otherwise; closed schema rejects an extra key in `pendingVersion` (API, web) |
| Step 5 23505 (minor 4) | a forced 23505 on `uq_subscription_live_payer_per_version` at step 5 (unit, stubbed insert) -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`, the transaction rolled back, nothing written (unit) |
| AC-5.9 | S51 with a failed fake cancel, new agreement authorized, then the old preapproval charges and is credited: MOT:2 on the old payer with the payment hung, covered period on the old payer only, old children `CANCELLED` with no coverage event, new agreement untouched; unit: `classifyCancellationCrossing` -> `MARK` for `CANCELLED` + `S51`, `crossingMarkReason('S51')` = `COBRO_POSTERIOR_A_LA_BAJA` (unit on `cancellation-crossing-rule.ts`, integration, fake) |
| AC-7.10 | S1 and manual start of a VIP-inheriting plan with a live `AGREEMENT` tourist child (pending and active) -> 422 `AGREEMENT_TOURIST_VIP_REDUNDANT`, nothing written, zero fake calls; a non-VIP plan proceeds; plan change of a standalone accommodation `PRINCIPAL` to a VIP-inheriting version with a live agreement tourist child -> 422 `AGREEMENT_TOURIST_VIP_REDUNDANT`, no successor row, zero fake calls; S37 to a VIP-inheriting target -> that cohort row `EXCLUDED` with `AGREEMENT_TOURIST_VIP_REDUNDANT` in preview and launch; a tourist purchase next to an active VIP-inheriting child -> 409 `TOURIST_VIP_INHERITED` (integration, API, web) |
| AC-8.19 | `S52` `APPLYING` inside the window: fake shows the old amount -> one `changeAmount` with the `APPLYING` amount; fake shows a third amount -> zero `changeAmount` calls, MOT:5 opened on the payer, accumulated on the next run (integration, fake) |
| AC-9.4 | S13 and authorize on the same customer and vertical run concurrently: exactly one commits, the other answers its D8 409; seeded live grant + live child -> the sweep's grant fan-out check opens MOT:10 on the child, nothing else written (integration) |

**Smoke**: staging (MP sandbox: offer, authorize from My account and from link, first charge,
price decrease, cancel, end and re-offer) and production (one low-amount agreement end to end,
then cancel), recorded in `docs/billing/smoke-checklist.md`; labels
`status-needs-smoke-staging` and `status-needs-smoke-prod`.

## Product decisions pending owner approval

None. P4 became D17, P5 and P11 became D18, and P6 to P10 became D19 to D23 (all approved by
the owner on 2026-11-15, see "Binding owner decisions"). The D20 extension to GLOBAL-scope
add-ons was approved on 2026-11-15 and is now in the D20 row.

## Internal Review Notes

### V1 trim

The owner cut HOS-2211 to a V1 on 2026-11-15. The full design (six review passes, D3, D4,
D7, D11, D12, D13) is preserved in `docs/full-design-pre-v1.md`, and its V2 is Linear
HOS-2226. Removed, and why:

- **Succession at authorization** (D3): `admitAgreementPredecessor`, S17/S18/S19 with
  AGREEMENT successors, the payer-link resolution in S17, the S18 billing-option bypass, the
  `succeeded_by_id` release, retentions and the chargeback successor-cutter rule. Three
  blockers of review rounds 2 and 3 lived here. V1 forbids predecessors (V1-a, enforced by
  INV:8 and a CHECK), so none of it is reachable.
- **Compensation** (D4, D7, D11): `agreement_compensation`, `applyAgreementCompensation`, its
  sweep, promo `origin`, courtesy N months, addon cancellation, the annual block. Staff
  compensates by hand with existing tools.
- **Re-authorization and D12/D13**: `REAUTHORIZATION`, `closeSupersededPayer`, grace on a
  first decline. Replaced by end-and-recreate (D14) and the plain S16 path (V1-c).
- **Courtesy on the payer**: no payer pause in V1, so the courtesy vertical rework, S17
  `paused` acceptance and pause rows disappear.

Kept and fixed from the third review: the activation funnel over three sites, S7's
`CANCEL_SCHEDULED` target, the S11 facts branch, the S12 payer branch, the no-op/abort rule
over a renumbered S41-S50 table.

### Pass 1 (trimmed text): completeness and junior readability

- Every US has Given/When/Then ACs with explicit codes; every AC is in the test map; ACs are
  numbered in order with no gaps.
- Glossary terms (payer, child, blocking subscription) are used consistently; "predecessor"
  and "compensation" no longer appear as V1 concepts.
- Each removed item has one line in "Deferred to V2".

### Pass 2 (trimmed text): technical coherence with the code (96756adfc4)

- V1-a is DB-backed: children have `succeeds_id` NULL and occupy
  `uq_subscription_commitment_origin` (`subscription.dbschema.ts:183-187`), which forbids a
  second live origin PRINCIPAL in `(user, vertical)`.
- Activation sites verified: `activatePendingRow` (`expire-authorization-windows.service.ts:74-88`)
  is called at `:123` (credited-pending) and `:275` (S3 active read).
- `readS11ServiceEndFacts` throws without anchors (`s11-service-end.ts:113-119`); callers
  verified at `cancel-active-subscription.service.ts:232`,
  `cancel-paused-subscription-support.ts:239`, `cancellation-preview.ts:100`,
  `cancellation-crossing-charge.ts:141`.
- `service-end-s12.ts:144` (class gate), `:188` (`expectedClass: 'PRINCIPAL'`), `:189-191`
  (NULL vertical throw) verified.
- S7 destination `CANCEL_SCHEDULED` on a `cancelled` read (`reactivate-suspended.service.ts:210-218`)
  and its `service_ends_at` block (`:296-327`) verified.
- `decline-first-charge.service.ts:100` admits ACTIVE rows, so S43 must start from
  `PENDING_AUTHORIZATION` and `ACTIVE`; `CHARGE_DECLINED` on an activated payer ends the
  agreement (new end reason).
- The payer is never `PAUSED` in V1: no courtesy (refused), no customer pause (refused),
  provider pause arrears maps to `SUSPENDED` (`provider-pause-arrears.ts:47,97`).

### Pass 3 (trimmed text): external API accuracy (`fake-lists.json`)

- No future `start_date` (M9, EX-38, G11). Duplicate creation on equal requests (M3): one
  payer per version and reuse of the checkout URL. Approval links never expire (M11): our
  window and link expiry. Amount change sends no notice (M5): our email and the
  expected-amount check; a paused authorization refuses changes (RP6), which is why a
  decrease needs the payer `ACTIVE`. Amount bounds (RP3) mirrored by the DB CHECK and the
  constants. The cycle of a live preapproval cannot change (EX-4): a cycle change is a new
  agreement (D14).
- No unmeasured provider behaviour remains in V1 (the annual pause question left with D11).

### Pass 4 (trimmed text): AC testability

- Each AC names an observable outcome (rows, statuses, HTTP code + reason, rendered text,
  provider call on the fake). AC-1.7 and AC-3.7 assert the exact `details.blocking` list.
  Guard ACs (AC-2.2, AC-6.5) carry mutation fixtures.

### V1 review 1 (2026-11-15)

A fresh review of the V1 text found 4 blockers, 6 majors and 7 minors, all verified at
96756adfc4 before applying. The owner approved P1 as D14 in the same round.

- **Blockers.**
  1. Withdraw/replace with a pending payer and an open checkout: the act now cancels the
     preapproval first (S40 payer variant, S42) or answers 503; the closed-version guard in
     `activateAgreementPayer` makes a paid closed version terminal instead of looping across
     `expire-authorization-windows.service.ts:115-123,273-280` and
     `process-provider-notice.service.ts:345-351` (AC-5.5, AC-8.6).
  2. AG2 versus `uq_agreement_one_active_per_customer` with disjoint verticals: authorize
     refuses while any other agreement is not `ENDED` (AC-3.9).
  3. The amount retry (`amount-comparison.ts:57-77`) would revert an `APPLYING` decrease:
     expected amount follows the `APPLYING` version, and `recordAmountMutationDecided`
     (`amount-mutation-decision.ts:42`) gains `'S52'`.
  4. `cancelComplementsByS11Rule` throws for `ACUERDO` (`complement-s11-rule.ts:119-128`) and
     would roll back the customer cancel: skipped for `ACUERDO` at
     `cancel-active-subscription.service.ts:253` and `reactivate-suspended.service.ts:338-346`.
     `mirror-our-cancellation-on-active.ts:160` already gates on `PRINCIPAL`; the preview only
     calls `selectComplementTargets` with a vertical (`cancellation-preview.ts:178`).
- **Majors.**
  5. End mode x payer state matrix and the new S51 (immediate end, no refund) instead of S36
     (refund semantics, principal-only, no `SUSPENDED` origin).
  6. `findDeclinedWithProviderLinks` excludes AGREEMENT so S1 is not blocked forever
     (AC-6.10).
  7. Selector inventory completed (about 30 sites) with a closed decision list, and
     `check-payment-method-branches` extended to the Drizzle `eq/ne` forms.
  8. Pending cancel: payer variant plus a child refusal.
  9. Add-on orphanhood: declared unreachable by construction (purchase refusal + COMPLEMENTO
     blocker), with a consistency assertion; A5 per child is not added.
  10. `CREATION_NOT_APPLIED`: re-mint on the same payer after cancelling the divergent
      preapproval.
- **Minors.**
  11. S48 leaves `ACTIVE` only; customer cancel from grace or suspension is direct (S49).
  12. Account closure edge case corrected (action 24 is refused while `canCharge`).
  13. `VERTICAL_IN_AGREEMENT` runs before `closeDeclinedAttempts` and before
      `COMMITMENT_TAKEN`.
  14. S43 coverage loss only from `ACTIVE`.
  15. `authorizePendingSubscription` gains a `returnUrlBuilder`.
  16. Citations fixed: `subscription.model.ts:350-360` (S3) versus `:415-430` (S39/S40);
      `hasOtherLivePrincipal` already returns false on NULL vertical (`:148`);
      `reconciliation-zero-call.model.ts:183` unreachable (`isNotNull` at `:128`).
  17. Version write order (old row first, uniques not deferrable) and `onMismatch: MARK`
      for provider-driven writers.

### V1 review 2 (2026-11-15)

A second fresh review found no blocker, 6 majors and 5 minors, all verified at 96756adfc4.
The owner approved P2 and P3 as D15 and D16 in the same round.

- **Majors.**
  1. `CREATION_NOT_APPLIED` cannot re-mint on the same row: `uq_provider_link_subscription`
     (`provider-link.dbschema.ts:25`) is 1:1 with no close column, and S1 abandons the row
     (`start-subscription.service.ts:372`). Now an S39 payer variant: abandon payer and
     children and insert new ones in one transaction; the link resolves to the live payer of
     its version.
  2. D14 contradicted AC-1.7 with overlapping verticals: `findAgreementBlockers` takes
     `at: 'OFFER'` and skips the customer's own `CANCEL_SCHEDULED` agreement's children.
  3. `readArrearsSuspensionNoticeContent` throws on a NULL vertical
     (`arrears-suspension-notice.ts:138-139`) before the S6 and chargeback writes
     (`suspend-for-arrears.service.ts:196`, `suspend-for-chargeback.service.ts:146`): named as
     a gate with per-line content; Phase 2 exit criterion extended.
  4. The S40 payer variant now follows S40's real order (read, `active` -> 409, write plus
     decision, then cancel, retries by the sweep and H-7); the "cancel first or 503" wording is
     gone, and the AC-5.5 guard has the same structure. S51 follows it too and joins
     `SALVEDAD_4_TRANSITIONS`.
  5. Expected amount split by purpose: AUTHORIZATION uses APPLYING-else-ACTIVE; PERIOD uses
     the version effective at `chargeCreatedAt`, `NOT_COMPARABLE` during `APPLYING`.
  6. The propagation never aborts; staff acts that call the provider pre-check the children
     before the call; customer S11 and direct cancel always proceed and MARK.
- **Minors.**
  7. `end_reason` derivation table.
  8. Creations sweep: reason, return URL builder and a closed-version skip from the terms
     resolver (`creations-sweep.service.ts:238-250`).
  9. The link is consumed at authorize; AC-5.1 no longer says activation.
  10. NULL-vertical payloads named: `signup-incomplete-notice.ts:65`, `AUTHORIZATION_EXPIRED`,
      `ATTEMPT_CANCELLED`, `ATTEMPT_REPLACED`.
  11. Notice path: a `terminal` result sets `resolved = true` and breaks
      (`process-provider-notice.service.ts:351`).
  12. `tourist-vip-inheritance.ts:89` re-checked: the cited file is
      `apps/api/src/routes/billing-subscription/tourist-vip-inheritance.ts`, where line 89 is
      `eq(subscriptions.class, 'PRINCIPAL')`; the blank line is in the shorter same-named file
      under `packages/verticals`. The citation now quotes the line and names the other file.
  Also: Phase 2 listed S8 (the customer pause, refused by D15); removed.

### V1 review 3 (2026-11-15)

A third fresh review found no blocker and 10 items, all verified at the worktree checkout
(`322baf2214`) before applying. The owner
resolved P6 to P10 in the same round as D19 to D23 (P10 with the non-default option).

1. Withdraw/replace while the payer creation is in flight: an open, uncompleted
   `PREAPPROVAL_CREATE` key -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`; no `provider_link` and no
   key -> abandon with no provider call (AC-8.6; cf. `cancel-pending-attempt.service.ts:48-50`,
   which refuses both cases).
2. Creations sweep: an `ACUERDO` row always uses the signed-link return URL builder; no
   `created_via` column.
3. Stuck `APPLYING`: the consistency check promotes AV4 on a matching fresh read after
   `applyingStaleHours` (default 24) or opens `AGREEMENT_VERSION_APPLYING_STALE` (AC-8.9).
4. Explicit `AGREEMENT_ADDONS_NOT_AVAILABLE` in `resolvePurchaseTitle`
   (`purchase-addon-eligibility.ts:135`); USER scope skips agreement verticals (AC-7.7); why:
   `creditedPaymentsFromLedger` cannot follow a child to its payer.
5. USER/GLOBAL add-ons excluded from the consistency predicate and from the per-line
   suspension notice add-on list (`arrears-suspension-notice.ts:156-169`).
6. `findCancellationDecision` (`reconciliation-inventory.model.ts:264-286`) returns
   `actorType`; a staff S11 through ACC_8 derives `STAFF_CANCELLED`.
7. `S51: 'DIRECT_CANCELLATION'` in `BEFORE_CANCEL_KIND_BY_TRANSITION`
   (`our-cancellation-retry.ts:44-76`); `reconciliation-exit-game.test.ts:195` 15 -> 16.
8. AC-8.6: any read other than `pending`/`cancelled` -> 409 `AGREEMENT_PAYER_AUTHORIZING`.
9. `VERSION_APPLYING` and `NO_VERSION` added to the `NOT_COMPARABLE` reasons
   (`expected-amount.ts:30`), plus `AGREEMENT_VERSION` as a `COMPARABLE` source.
10. AC-6.10 moved after AC-6.9 (and the test map reordered, AC-3.7 before AC-3.9); AC-1.4
    rewritten with concrete rows, ids and the concurrent case.

Owner decisions applied: D19 (AC-7.4, admin hides courtesy), D20 (AC-7.3, AC-7.7, AC-7.8,
`addon-sources.ts:100-105`), D21 (`agreement.trade_name`, AC-4.2, AC-4.10, `POST /resolve`
shape), D22 (`agreement-link-used` moved from authorize to activation, AC-4.8), D23
("Analytics (D23)", US-11).

### Final review (2026-11-15)

A final review found one blocker, two majors and three minors, all verified against the code
at the worktree checkout before applying.

- **B1. Withdraw/replace branches (AC-8.6, "Version changes and ending", AC-8.6 test row).**
  V1 review 3 item 1 assumed a rejected creation frees its key. It does not:
  `start-subscription.service.ts:248-262` -> `recordCreationRejected`
  (`subscription.model.ts:191-206`) completes the key with `REJECTED_BY_PROVIDER` or
  `THROTTLED_BY_PROVIDER`, `resolve-live-commitment.ts:193-204` reads it as `RECREATE`, and the
  payer row and key are inserted together, so "no link and no key" was unreachable. The
  branches now read the LATEST key (several can exist, `mintKeyAfterRejectedCreation`,
  `subscription.model.ts:209`): open -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS`; no link and a
  rejected/throttled result (`RejectedCreationResultSchema`/`ThrottledCreationResultSchema`,
  `resolve-live-commitment.ts:27-36`, module-private today) -> abandon with no provider call;
  link present -> S40 order with a fresh read; anything else without a link -> 409
  `PREVIOUS_ATTEMPT_IN_PROGRESS`.
- **M1. API analytics sink ("Analytics (D23)", Phase 2 item 7, AC-11.1, test row).**
  `analytics-facts.ts:262-264` drops every non-`PRINCIPAL` fact and `toEvent` (`:73-81`)
  always writes the `vertical` key; the sink is now a touched file (admit `ACUERDO`, omit
  `vertical`), and AC-11.1's test goes through `createAnalyticsFactSink` with a capture spy
  asserting `!('vertical' in properties)`.
- **M2. Cancellation `path` ("Analytics (D23)", AC-11.1, AC-11.3, test row).** The enum is
  closed (`billing-fact-sink.ts:101-107`, `catalog-billing.ts:125-132`); `AGREEMENT_ENDED` is
  added to both for S51 and its children. "S16 after activation" was removed (it is a
  `CHARGE_DECLINED` transition, reported by `CHARGE_REJECTED`), and "provider mirrors" was
  removed (no emitter exists on that path; V1 emits nothing new there). No frozen count over
  the enum exists (`billing-catalog.test.ts:144-158` tests single values).
- **Minor 1.** The wizard's trade name starts empty and is required; it is never prefilled
  from `display_name` (D21, token-reachable page).
- **Minor 2.** AC-7.7 and the `resolvePurchaseTitle` note: `AGREEMENT_ADDONS_NOT_AVAILABLE`
  when no non-agreement vertical has a title and at least one vertical was skipped for an
  agreement child; `NO_VALID_TITLE` otherwise.
- **Minor 3.** AC-4.8 sends `agreement-link-used` only when the activated payer is the link's
  `consumed_subscription_id`; a replacement payer (AC-4.5) or one authorized later from My
  account does not trigger it (AC, activation flow, notifications, test row).
- Added a counting note under "Analytics (D23)": per-vertical counts include children and an
  all-class count gives N+1 per agreement.

### Full review (2026-11-15, clean context)

A clean-context review of the whole spec found one blocker, seven majors and nine minors.
Every file:line added below was re-read in this worktree; no "Binding owner decisions" row
changed. Applied:

- **B1. Double press refused by its own children.** The blocking set counted the version's
  own `PENDING_AUTHORIZATION` children, so a second press answered 409 before the reuse step,
  making AC-3.3, AC-4.5, the re-mint and the `CREATION_NOT_APPLIED` replacement unreachable.
  `findAgreementBlockers({ at: 'AUTHORIZE' })` now skips children of a live payer of the same
  version (Glossary, authorization flow step 3, new AC-3.10, risk row, test row).
- **M1. Consumed link survived a regenerate.** `issue` revokes every non-revoked link,
  consumed included; `resolve` checks revocation first; cause `REVOKED` added for
  `STAFF_REVOKED`; LINK reuse consumes an open link (AC-4.11, `signed_action_link` notes,
  signed link mechanism).
- **M2. "Consistency check" had no runner.** Defined as the cron job
  `billing-agreement-consistency-check` (hourly at minute 38, exclusive, `withCronLock`,
  manifest entry, stagger guard, CLAUDE.md Crons), new AC-6.11, rule 7 rewritten ("retry" =
  next run), Phase 2, guards.
- **M3. Mark reasons in the wrong language and outside the catalog.** The catalog is closed
  and Spanish (MOT:1-24); the three English names became MOT:25-27 in Spanish and the add-on
  drift became MOT:28, with the full recount list and migration 0225 regenerating the CHECK
  (new subsection, AC-5.5, AC-6.8, AC-8.9, propagation rule 1, spec-consolidada amendments,
  performance, test row). A guarded UPDATE that matches no row is MARKED, never thrown (rule 1,
  risk row, unit tests).
- **M4. `/agreements/mine` and `/resolve` had no schema.** `AgreementsMineResponseSchema` and
  `AgreementLinkResolveResponseSchema` written as closed Zod (API Design, AC-3.11, AC-4.12);
  the D14 pair (old ACTIVE + CANCEL_SCHEDULED, new OFFERED disabled) is explicit.
- **M5. Return URL was Spanish and session-only.** One destination `/{lang}/acuerdo/resultado/`
  without query for SESSION, LINK and the creations sweep through `buildAgreementReturnUrl`;
  locale sources fixed (AC-3.13, AC-4.1, authorization step 7, `signed_action_link.locale`).
- **M6. Payer analytics silently missing.** Every payer emitter skips a NULL vertical today;
  the `ACUERDO` branch is listed per emitter (grace, suspended, recovered, cancel scheduled),
  children emit only activation (single origin), cancel scheduled and cancelled (AC-11.1,
  AC-11.2, AC-11.5, "Analytics (D23)").
- **M7. `paymentMethod` audit counted a different search.** Replaced by a full 207-line
  production inventory (55 unrelated, 152 subscription: 24 branch, 2 exclude, 126
  unaffected) with the command and counts; `read-own-manual-installments.ts:62` fixed;
  `send-renewal-notices.service.ts:97` added to the guard's Drizzle forms; duplicated-enum
  bullet corrected (`subscription-self-cancel.schema.ts:36` gains `AGREEMENT`, preview
  `vertical` nullable for the payer).
- **Minors 1-9.** Private plan fields subsection with fixed defaults, closed schema and slug
  409 (AC-2.7 to AC-2.9); cycle constants `AGREEMENT_CYCLE_MIN_DAYS` with a DB CHECK
  (AC-1.8, `ck_agreement_version_grace_below_cycle`); 422 refusals at authorize (AC-3.12);
  `declaredPayerEmailMasked` in both authorize responses (AC-4.5); resolve states with
  `blockedReason` (AC-4.12); concrete rate limits on the existing middlewares (AC-4.13);
  `AGREEMENT_VERSION_NO_CHANGE` and the decrease-with-grace rule (AC-8.10, version changes);
  PERIOD `effective_from` for an INITIAL version (AC-8.11); "Copy payment link" locale select
  and My account card states (UX).

### Not verified

- `packages/analytics/test/umami-limits.test.ts` does not exist at this checkout (HOS-2119):
  its supported-type list and the 500-character Umami value limit are taken from the
  HOS-2119 owner's statement, not read from code.
- Whether each listed emitter's reading already carries `paymentMethod` was not checked per
  site (only `buildSuspendedFact`, which takes the full `SelectSubscription`); the
  implementer adds it where missing ("Analytics (D23)").
- Which path hangs a charge the provider credits AFTER the MOT:26 abandon on that same mark
  (the mark is opened at the abandon; a later credit reaches the closed payer through the
  credit path) was not traced end to end; the implementer verifies it in the AC-5.5 test.
- Whether a provider authorization read returns the next charge date (used for
  `fromChargeAt` in `agreement-price-decreased`) was not checked in the adapter; the template
  falls back to `subscription.next_charge_at` and then to an undated "from your next charge".
- Which `PaymentProviderError` variants count as a "definitive refusal" of `changeAmount`
  (AC-8.13) versus an unknown outcome (AC-8.14) was not mapped against the adapter's error
  classes; the rule is "timeout, network and 5xx are unknown, everything else is a refusal",
  and the implementer pins it to the adapter's actual error kinds.
- Whether S6 (arrears suspension from grace) and S7 to `ACTIVE` clear `grace_started_at` /
  `grace_ends_at` and `service_ends_at` was not traced; `mapPayerStatus` therefore compares
  those columns only where the table says so.
- The admin list envelope of `createAdminListRoute` was not read; `pagination:
  PaginationMetadataSchema` is a placeholder that yields to the route factory's envelope.

### Open questions for the owner

None. Every product question is resolved (D17 to D23).

### D23 revised (2026-11-15)

The owner revised D23: only the payer emits billing facts (class `ACUERDO`, `vertical`
omitted, plus `agreement_verticals` and `line_count`); children emit none. Applied: D23 row,
Glossary "Child", US-11 (AC-11.1, AC-11.2, AC-11.3, AC-11.5 rewritten, new AC-11.6),
activation funnel, `billing-fact-sink.ts` and catalog bullets, "Analytics (D23)" rewritten
(explicit `isAgreementChild` skip per named emitter plus a static guard; per-event
`.superRefine` instead of a discriminated union, with the HOS-2119 walker's forbidden Zod
types; `billing_option_id`/`plan_version_id` optional only for the payer; `AGREEMENT_ENDED`
payer-only; counting note replaced by "no double counting by construction"), Phase 2 item
7, test rows. Removed from "Not verified": the child `amountMinor: 0` activation and the
narrowed reading of "children emit their lifecycle" (both resolved by the revision). Earlier
review entries that describe child lifecycle facts or N+1 counting are superseded by this
entry.

### Second full review (2026-11-15, clean context)

A second clean-context review (at `437954eb56`) found no blocker, six majors and twelve minors.
Every file:line added below was re-read in this worktree. No "Binding owner decisions" row
changed except D20, amended after the owner approved the GLOBAL-scope extension (2026-11-15).
Entries of earlier reviews that say otherwise (for example "`declaredPayerEmailMasked` in both
authorize responses", the 409 `AGREEMENT_CHILD_STATE_MISMATCH`, AG4 withdrawing `OFFERED`
versions) are superseded by this one.

- **M1. A consumed link kept resolving after activation.** Rule (4) matched any live payer
  through `uq_subscription_live_payer_per_version`, which includes `ACTIVE`
  (`subscription.dbschema.ts:44-51`), and activation did not revoke consumed links. Now a
  nine-row total precedence (AC-4.14) applied by resolve and public authorize; activation
  revokes consumed links with the new `revoke_reason = 'ACTIVATED'` (cause `USED`) and open
  links with `VERSION_CLOSED` (AC-4.15, AC-4.7, AC-5.1, activation flow, `signed_action_link`
  notes); AC-4.12 picks its `state` from the same order.
- **M2. Stuck `APPLYING` had no exit.** New `POST .../versions/:versionId/abandon` (fresh read
  first: new amount -> promote and 409 `AGREEMENT_VERSION_ALREADY_APPLIED`; old amount -> AV7
  `FAILED` with a recorded decision; third amount -> 409; read failure -> 503, AC-8.12);
  expected amount after `FAILED` defined for both purposes and the amount retry no longer sends
  for a `FAILED` `S52` version (`amount-comparison.ts:53-76`); provider refusal at publish ->
  422 `AGREEMENT_PROVIDER_REJECTED_AMOUNT` (AC-8.13); minor 6: an uncertain decrease is exactly
  202 `{ applied: false, status: 'APPLYING' }`, never 503 (AC-8.14, API table, version changes).
- **M3. Drift had no repair.** New realign act `POST .../realign-children` (AC-6.12) and a full
  `mapPayerStatus` table; S51, S36, withdraw and replace FORCE drifted live children to
  `CANCELLED` and open-and-lift MOT:25 through S15 (`liftReconciliationMark`, which takes a
  `tx`, `lift-reconciliation-mark.service.ts:27`) instead of refusing (AC-6.13, AC-6.8, rule 1,
  S51 row, writer table, API table). `AGREEMENT_CHILD_STATE_MISMATCH` retired.
- **M4. Replace skipped the offer validations.** One shared `validateAgreementTerms` for
  `POST /`, `/preview` and the replace, with every code listed and the replaced version's own
  pending children excluded (AC-8.15, AC-8.4, version changes, API row).
- **M5. Add-on blocking used `subscription.vertical`.** Every `COMPLEMENTO` carries the title's
  vertical, even for USER scope (`purchase-addon-complement.ts:41`). Blocking is now by
  `addon_version.scope_type` (`addon-catalog.dbschema.ts:27,71`) through
  `addon_instance.addon_version_id` / `target_id` / `complement_subscription_id`
  (`addon-product.dbschema.ts:98,106,114`): `VERTICAL_SUBSCRIPTION`/`LISTING` on a line
  vertical block, `USER`/`GLOBAL` never (AC-1.7, Glossary, test row).
- **M6. The public page leaked the masked email.** `declaredPayerEmailMasked` removed from the
  public authorize response (only protected keeps it); AC-4.5, UX, API, reuse note.
- **Minors.** (1) Phases: S51 moved from the Phase 2 exit criterion to a new Phase 4 one; the
  job's stale-`APPLYING` check (c) moved to Phase 4 (schedule fixed from Phase 2). (2) AG4,
  AV6, AC-6.9, edge case and test row: only `APPLYING -> FAILED`. (3) Guard allowlist: six
  entries, incl. `afterAgreementActivated` and the S51 fact. (4) Staff revoke covers consumed
  links (AC-4.16). (5) `returnUrl` removed from `authorizeAgreement`. (7) Rate-limit order IP ->
  body validation -> token (`rate-limit.ts:1043`, `initiate.ts:289-290`). (8) Own-subscriptions
  list excludes payer and children, schema unchanged (AC-3.14; audit row B -> U, counts 23 B /
  127 U). (9) Trade name moved to "Choices made"; D20 GLOBAL approved and in the row; no pending
  owner item. (10) `TRANSITIONS` at `amount-mutation-decision.ts:17` gains `S52` too. (11)
  AC-11.1 names the `CANCEL_SCHEDULED` emitters (S11 only; S7 emits `RECOVERED`; the S48
  mirror emits nothing; verified by grep over `emitBillingFact(` call sites). (12) Admin
  response schemas, preview `problems`, i18n key table, email recipient/locale/dedupe,
  `fromChargeAt`, staff S11/direct cancel via ACC_8 (AC-7.9, end-reason rows), S11 with no
  credited period (`basis: 'NOW'`), and one pricing-situation shape `{ situation:
  'AGREEMENT', agreementId }`.

#### Choices made

1. **Trade name origin (technical, not an owner item).** `agreement.trade_name`, staff-entered,
   required, starts empty, never prefilled from `users.display_name` (no `users` column holds a
   trade name, `user.dbschema.ts:90`); reused as the agreement name of D22.
2. **`ACTIVATED` as a new `revoke_reason`** (mapping to cause `USED`) rather than reusing
   `VERSION_CLOSED`, so a consumed link and an open link of an activated version keep the two
   answers AC-4.7 already promised.
3. **Precedence puts `BLOCKED` before `CHECKOUT_PENDING`**, matching authorize's own order
   (steps 2-3 before the step 4 reuse), so resolve never offers a checkout authorize would
   refuse.
4. **Abandon with a new-amount read promotes and answers 409**, as requested; a third amount is
   its own 409 `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` (nothing written) rather than 503, because
   the read succeeded and the answer is known to be wrong.
5. **Provider refusal at publish = 422 `AGREEMENT_PROVIDER_REJECTED_AMOUNT`** with the version
   kept as `FAILED` (`details.versionId`), never a 5xx (error contract: a 4xx is never
   `INTERNAL_ERROR`). Uncertain decrease = 202 (not 201) because nothing is applied yet.
6. **The `FAILED` interval stays `NOT_COMPARABLE`**: charges created while the version was
   `APPLYING` may carry either amount; only charges after `closed_at` compare against the
   `ACTIVE` version.
7. **The 409 `AGREEMENT_CHILD_STATE_MISMATCH` is retired for withdraw/replace too.** Those acts
   end a pending payer; keeping a drifted child alive by refusing would leave it occupying
   INV:8 and block every later offer, and the realign act already covers non-terminal drift. A
   live drifted child is forced to `CANCELLED` (not `ABANDONED`, which only follows
   `PENDING_AUTHORIZATION`).
8. **Forced children leave an audit trail** by opening (or accumulating) MOT:25 and lifting it
   in the same transaction with the actor as `liftedBy`, rather than writing silently.
9. **`mapPayerStatus` compares `service_ends_at` only for `CANCEL_SCHEDULED` and the grace pair
   only for `GRACE_PERIOD`**, because the clearing of those columns by other transitions was not
   traced (see "Not verified").
10. **Own-subscriptions keeps its INNER join and adds `ne(paymentMethod, 'AGREEMENT')`**; the
    schema stays `CARD | MANUAL` and neither agreement row appears in the generic list.
11. **Replace uses `findAgreementBlockers({ at: 'OFFER', replacingVersionId })`**: without the
    exclusion the replaced offer's own pending children would block the replacement.
12. **Admin i18n keys move to `admin-billing.*`** (AC-1.3 key renamed), web keys stay
    `billing.*`, matching the existing `admin-billing.json` / `billing.json` namespaces.
13. **Email locale is the account locale, never the link's**, since the recipient is always the
    account owner.
14. **(Revised by the fourth review.)** `exclusive: true` without a detected provider call fails
    the stagger guard (`mp-cron-stagger.ts:27-28`), so the Phase 2 job is registered at minute
    38 WITHOUT `exclusive`, minute 38 is held by a placeholder `PENDING_MP_CRON_SCHEDULES` entry
    (a placeholder name, because a pending entry named like a registered job is dropped,
    `mp-cron-stagger.ts:32`), and Phase 4 adds check (c), `exclusive: true` and removes the
    placeholder; the manifest schedule never moves.

### Third full review (2026-11-16, clean context)

A third clean-context review (at `f7177f5e8c`) found no blocker, five majors and eleven minors.
Every file:line added below was re-read in this worktree. No "Binding owner decisions" row
changed. Earlier entries that say otherwise (for example "`consumed_subscription_id` records
the first payer only", "a replacement payer never triggers `agreement-link-used`", the realign
payer "of the `ACTIVE` or `OFFERED` version", the cron listed among the CI guards, "refund
actions") are superseded by this one.

- **M1. Create request incomplete.** `AgreementCreateRequestSchema` (POST `/` and `/preview`)
  adds `tradeName` (trim, 1..120, the column's `varchar(120)`), `internalNotes?` (max 2000; the
  column is `text` with no limit) and typed `lines` (`{ vertical, planVersionId }`, unique
  verticals by refine); `AgreementVersionTermsSchema` for `/:id/versions` carries lines but no
  agreement-level field (API Design, `agreement` table, UX wizard, AC-1.1 test row).
- **M2. Double charge after a deferred S16 cancel.** `findDeclinedWithProviderLinks`
  (`subscription.model.ts:434-449`) filters by vertical (`:445`), so neither S1 nor authorize
  saw a declined payer whose cancel S16 deferred (`decline-first-charge.service.ts:142-143`).
  New authorize step 2b reuses `closeDeclinedAttempts` (`start-subscription.service.ts:424-470`)
  with `verticals` and a query that admits `class = 'ACUERDO'` and excludes children; S1 and the
  manual signup see the payers too (AC-5.6, AC-6.15, selector rule, risk and edge rows, tests).
- **M3. Link-driven replacement lost the D22 email.** One rule: every LINK authorize writes
  `consumed_subscription_id` = the payer it ends at (insert, reuse, re-mint, replacement); a
  SESSION authorize never touches the link (`signed_action_link` notes, AC-4.5, AC-4.8, step 4,
  activation, notifications, test row).
- **M4. "Do not retry a FAILED S52" was unimplementable.** `findLatest`
  (`amount-mutation-decision.ts:73-100`, full path given in the S52 row) now returns
  `agreementVersionId` from `changes`, the port (`amount-mutation-decisions.port.ts:5-10`) admits
  `S52`, and every AV7 is a NEW `domain_event` type `agreement_version.failed`
  (`DOMAIN_EVENT_TYPES`, `domain_event.dbschema.ts:68-105`; CHECK `:197-200` regenerated in
  0225), never `subscription.amount_mutation_decided`, so the reader (which reads only that type,
  `:80-84`) never fails closed on an unknown reason (`:89-96`). `amount-comparison.ts` citations
  normalised to `:54-78`.
- **M5. Live child under an ENDED agreement had no exit.** The realign resolves the payer over
  every version (live first, else most recent by `created_at DESC, id DESC`); the job's new
  check (d) forces a live child of a terminal payer to `terminalTargetFor` with MOT:25 opened and
  lifted by `SYSTEM_USER_ID` (`packages/db/src/constants/index.ts:27`). S43 keeps its two
  origins: the forced write is a `REALIGNS_CHILDREN` write, not a propagation (AC-6.14,
  `mapPayerStatus` "Terminal payer", job, S43 row).
- **Minors.** (1) AC-3.10 fixture uses a live tourist PRINCIPAL next to a VIP-inheriting line
  (`uq_subscription_commitment_origin`, `subscription.dbschema.ts:183-187`, made the old one
  impossible). (2) "Lifting MOT:27": one rule for `apply`, `abandon`, stale check (`SYSTEM_USER_ID`,
  because `reconciliation_mark.lifted_by` is a `users.id` FK) and AG4. (3) "Lock order": agreement
  -> versions -> payer -> children -> links; payer-first writers that can run AG4 (`lockDueRow`,
  `service-end-s12.ts:124-136`; `cancel-direct-subscription.service.ts:210`) take the agreement
  scope first; authorize steps 1-5 in one transaction, 2b and the provider outside it. (4)
  `agreement-confirmed` in Phase 2, `agreement-link-used` in Phase 3, `agreement-price-decreased`
  in Phase 4. (5) `apply`: 409 `AGREEMENT_PAYER_NOT_ACTIVE`, 422
  `AGREEMENT_PROVIDER_REJECTED_AMOUNT` -> AV7 (AC-8.17). (6) DECREASE validations (AC-8.16). (7)
  `agreementId` on `AdminSubscriptionListItemSchema` (`subscription-admin.schema.ts:32-56`). (8)
  `agreementState` on the pricing situation; a pending child shows "Pending authorization of your
  agreement". (9) `defaultProposal` (`reconciliation-mark-reasons.ts:51`) replaces "refund
  actions". (10) The cron left the guards table; the payment-method guard compares 59 JS + 8
  Drizzle = 67 sites (re-counted), not the 152 audited lines. (11) Public authorize no longer
  lists `AGREEMENT_VERSION_NOT_OFFERED`/`_NOT_LIVE` (row 5 answers 410 first, under step 1's
  locks); one `AgreementBlockingRowSchema` for preview and every `details.blocking`; AC-5.2
  answers `USED` only for a consumed link.

#### Choices made

1. **Empty `lines` is not a schema error.** The review asked for `.min(1)`; the schema keeps
   only the unique-vertical refine, and `validateAgreementTerms` answers 422
   `AGREEMENT_NO_LINES`, so the preview can list it and that existing reason stays reachable. A
   duplicate vertical is a 400.
2. **Step 2b closes declined standalone PRINCIPALs in the line verticals too**, not only payers:
   their deferred cancel is the same double-charge risk for the same vertical.
3. **A standalone S1 closes every declined payer of the user, whatever the vertical**, as the
   review proposed (`vertical = ANY(:verticals) OR class = 'ACUERDO'`).
4. **`consumed_subscription_id` is updated in place** (no new column); `consumed_at` keeps the
   first consumption.
5. **AV7 gets its own event type** (`agreement_version.failed`, entity `agreement_version`)
   instead of a `subscription.amount_mutation_decided` row with reason `AV7`, so the amount
   reader's fail-closed parse stays as it is.
6. **The job writes children in exactly one case** (check (d), live child of a terminal payer),
   because no later payer transition can ever move that child; every live-payer drift stays
   MARK-only.
7. **Under an `ABANDONED` payer a non-pending live child goes to `CANCELLED`**, and under a
   terminal payer any terminal child agrees, consistent with AC-6.13.
8. **Jobs lift marks as `SYSTEM_USER_ID`**, the repo's fixed id for automated operations.
9. **`SUSPENDED` children show "Included"** on the plans page: the vertical is still governed by
   the agreement (S1 refuses it); the payment problem is shown on the My account card.
10. **Payer-first writers comply by taking the agreement scope first**, not by a retry loop; a
    residual `40P01` is retried by each caller's existing mechanism.

#### Not verified (third review)

- That S16 (`decline-first-charge.service.ts`), S36 and the provider cancel mirrors lock the payer
  first was inferred from the S12 and direct-cancel code (`service-end-s12.ts:136`,
  `cancel-direct-subscription.service.ts:210`) and the S36 docblock
  (`revoke-subscription.service.ts:280`), not traced line by line.
- Whether every shared payer lock runs on the caller's `tx` (so the agreement locks taken first
  are in the same transaction) was not checked per site; the implementer passes `tx` where a
  site opens its own.
- Whether `assertTouristVipPurchaseAllowed` would let the AC-3.10 tourist fixture be bought
  through S1 while the children are pending was not checked; the test seeds the row directly.

### Fourth full review (2026-11-16, clean context)

A fourth clean-context review (at `efc89d4cbf`) found no blocker, four majors and ten minors.
Every file:line added below was re-read in this worktree. One "Binding owner decisions" row was
added (D24, approved 2026-11-16); no other row changed. Earlier entries that say otherwise (for
example "both presses receive the same checkout URL", "the Phase 2 job is `exclusive: true`",
S36 as a refund-free path for the payer) are superseded by this one.

- **M1. Concurrent presses.** The first press's key stays open during the provider call, and
  S1's rule refuses an open key (`resolve-live-commitment.ts:169`): a concurrent press answers
  409 `PREVIOUS_ATTEMPT_IN_PROGRESS`, a later one reuses the URL; one client rule (retry once
  after ~2 s, then "processing" with `billing.agreements.processing.*`) (AC-3.3, AC-3.10, step 4,
  UX, i18n, edge and test rows).
- **M2. Dead token reached step 2b.** The LINK pre-pass evaluates AC-4.14 rows 1-6 before step 1
  and step 2b, and again under the locks (transaction boundaries, public API paragraph, new
  AC-4.17 and test).
- **M3. `closed_at` / `activated_at`.** One timestamp rule under the AV table, two CHECKs in 0225,
  a unit case for a charge after a confirmed decrease.
- **M4. Conflicting refusal codes.** One refusal table (act x child/payer/vertical -> reason) in
  "Writers that must refuse", referenced by AC-7.2 to AC-7.4, the audit rows, the API text, i18n
  and one table-driven test.
- **D24.** S36 on the payer refunds the full last charge; AC-6.3 points to the new AC-6.16; the
  "Why S51" paragraph and Phase 2 mention it.
- **Minors.** (1) Cron exclusivity per phase with a pending placeholder (job section, AC-6.11,
  phases, guards, second review's choice 14). (2) Expired window in step 4 -> `COMMITMENT_TAKEN`.
  (3) `apply` third amount -> 409 `AGREEMENT_PROVIDER_AMOUNT_UNEXPECTED` (AC-8.17, API, version
  changes). (4) D24. (5) New AC-6.17 for MOT:28 with test. (6) `error.reason` stated once in API
  Design (AC-1.3 fixed), plus the `handleRouteError` details gate. (7) Resolve dry run excludes
  2b; copy for the two 409s; AC-4.12 wording. (8) `declaredPayerEmailMasked` on the `/mine` payer.
  (9) Phases: private plans in Phase 1 (4b), `agreement-offer.service.ts` in Phase 3,
  `withdrawAgreement` in Phase 4, admin agreement endpoints in Phase 6. (10) AC-4.15/AC-4.16 use a
  seeded fixture (defence in depth).

#### Choices made

1. **Pause on a CHILD answers `AGREEMENT_PAUSE_NOT_AVAILABLE`, not `AGREEMENT_CHILD_ACT_ON_PAYER`.**
   The review grouped pause with the child redirects; but the redirect is only honest where the
   same act runs on the payer, and D15 (binding) refuses an agreement pause outright. So the
   rule is: `AGREEMENT_CHILD_ACT_ON_PAYER` for cancel, preview, pending cancel and S36; the
   agreement-wide code (D15, D19, D20) on child and payer alike for pause, courtesy and add-ons.
2. **Plan change answers `AGREEMENT_MANAGED` on the child and on the payer**: the API keys it by
   subscription id (`request-plan-change.service.ts:35`), and no plan change exists inside an
   agreement (Out of Scope), so a redirect to the payer would lead to another refusal.
3. **Succession admission on a child answers `VERTICAL_IN_AGREEMENT`** (S1's code, which refuses
   first anyway), not the redirect.
4. **Expired window in step 4 refuses with S1's `COMMITMENT_TAKEN`**, with no reuse and no inline
   abandon: S3 (`payment-window-expiry`, minute 23) reads the provider before abandoning, and an
   inline abandon without that read could drop a paid attempt.
5. **Client retry is one automatic retry after ~2 s**, then a manual retry button; the same rule
   covers `PREVIOUS_ATTEMPT_CLOSING`.
6. **Cron placeholder name** `billing-agreement-consistency-check-provider`: a pending entry
   named like a registered job is ignored (`mp-cron-stagger.ts:32`, guard test `:84-86`), so the
   literal instruction "reserve via `PENDING_MP_CRON_SCHEDULES`" needs a distinct name. In
   Phase 2 the job runs without the session lock; row locks and mark accumulation make an
   overlap harmless.
7. **CHECKs over prose for the AV timestamps**, both exact equivalences (closed statuses <=>
   `closed_at`; ever-active statuses <=> `activated_at`).
8. **AC-4.15/4.16 kept as defence in depth with a seeded fixture** rather than rewritten around a
   single link (smaller change; the revocation code still has to handle both kinds).
9. **The `handleRouteError` details gate was added** although no review item named it: without
   it every `details.*` this spec promises is stripped in production.
10. **D24 inherits every S36 rule unchanged** (origins, 10-day window, refusals); a `SUSPENDED`
    payer is not revocable and staff uses S51.

#### Not verified (fourth review)

- Whether `requestRevocationRefund` and the RF1 path accept a payment owned by an `ACUERDO` row
  (no vertical) was not traced; AC-6.16's test proves it.
- Whether the admin subscription detail's revoke action renders for a row with a NULL vertical
  was not checked in `apps/admin`.
- Whether other routes need the `handleRouteError` gate extended per reason or a code-level
  mechanism was not designed; the implementer picks the smaller change.

### Fifth full review (2026-11-16, clean context)

A fifth clean-context review (at `618874291f`) found one blocker, one major and seven minors.
Every file:line added below was re-read in this worktree. One "Binding owner decisions" row was
added (D25, approved 2026-11-16); no other row changed. Earlier entries that say otherwise (for
example the "single use ... afterwards 410" note, `after-activation-commit.ts:50` as a terms
resolver user, the backstop at `resolve-live-commitment.ts:167`, writers "running AG4", an
optional `payerEmail` on the protected authorize body) are superseded by this one.

- **B1. Activation of a payer that is no longer pending.** The three sites read unlocked and
  lose a race only through a guarded write (`expire-authorization-windows.service.ts:86`,
  `process-provider-notice.service.ts:351`, `activate-subscription.service.ts:65`), so a second
  caller reached the closed-version guard against an `ACTIVE` version and cancelled a paid
  preapproval. `activateAgreementPayer` now checks `PENDING_AUTHORIZATION` right after its locks
  and returns a resolved no-op; everything after the guard depends on the guarded UPDATE
  ("Activation funnel", AC-5.1, AC-5.5, new AC-5.7, Phase 2, test row).
- **M1. Decrease racing abandon or AG4.** Every post-provider transaction of the publish re-takes
  the locks and acts only on an `APPLYING` version under an `ACTIVE` agreement, else 409
  `AGREEMENT_VERSION_NOT_APPLYING`; an abandoned version whose new amount landed anyway opens
  `DIVERGENCIA_DE_MONTO` (MOT:5); `apply`/`abandon` state the same check ("Post-provider
  re-validation", new AC-8.18, API row, Phase 4, test row).
- **D25.** Binding row; the gate helper and its place in the error order ("Permissions and
  administrative action"); new AC-10.3; AC-6.16, AC-7.9, refusal-table intro, UX, Phases 2 and 6,
  test row.
- **Minors.** (1) "Single use" note reworded to the live-pending-payer rule; AC-4.8 gains the
  row-8 reuse case. (2) `after-activation-commit.ts:50` removed from the terms resolver users. (3)
  Backstop placed right after `resolve-live-commitment.ts:163`, before `:164-165` (refusal table,
  audit row). (4) AG4 core in Phase 2, its link step in Phase 3, its AV7/MOT:27 step in Phase 4.
  (5) AG4 runs only inside the propagation, guarded by `agreement.status = 'ACTIVE'` (rule 8, AG4
  row, S12 bullet, S51, lock order, `actorId`). (6) Payer email: LINK only, optional, validated,
  never echoed; SESSION stores NULL (new rule under "Authorization flow", AC-4.18, API, UX,
  i18n). (7) Admin detail and list show the realign-rule payer and only its children (AC-10.2,
  schema comments, test row).

#### Choices made

1. **The no-op returns `terminal: true`** (not a retryable outcome): the notice is acked and the
   sweeps skip the row; the first caller already did the work, and an abandoned row's live
   preapproval is H-7's case.
2. **MOT:5 `DIVERGENCIA_DE_MONTO` for "version FAILED, provider shows the new amount"**, not
   MOT:27: MOT:27 means an `APPLYING` version, which no longer exists and whose lift rule fires
   on every exit from `APPLYING`; MOT:5 is the mark the amount comparison opens for the same
   divergence (`amount-comparison.ts:19,83`), so a later sweep accumulates on it.
3. **Same 409 `AGREEMENT_VERSION_NOT_APPLYING` for the abandon and the AG4 race**, as requested;
   no new reason.
4. **D25 reuses `ADMINISTRATIVE_ACTION_FORBIDDEN`** (403 `FORBIDDEN`, already mapped by the admin
   cancellation route) with no `details`, rather than a new reason.
5. **D25 gate after the 404, as the first business rule.** The class needs a validated id and a
   row read; the 403 reveals only "agreement row" to an actor that already holds a staff
   permission, which the admin list shows anyway. It runs before every other refusal so an
   ADMIN never learns an agreement-specific reason.
6. **D25 covers payments and marks of agreement rows** (refund, mark lift), reading "any other
   admin endpoint touching an agreement" literally; reads stay ungated.
7. **SESSION authorize stores `declared_payer_email` NULL**, not the account email (the requested
   default): the provider call forwards a declared email as `payer_email`
   (`start-subscription.service.ts:222`, `mercadopago-payment-provider.ts:290`), and the sweep
   already falls back to the account email (`creation-sweep.model.ts:122-124`), so copying it
   adds a provider constraint and no benefit. The link page keeps the optional field.
8. **No history sub-list of abandoned payers** in the admin detail (YAGNI); they stay reachable
   from the admin subscription list through `agreementId`.
9. **"Single use" reworded rather than row 6 changed**, so the rule "each LINK authorize records
   the payer it reaches" and D22 stay as they are.

#### Not verified (fifth review)

- Whether a preapproval created with a `payer_email` refuses a checkout by a different
  MercadoPago account was not measured (`fake-lists.json` was not checked for it); choice 7
  avoids sending one the customer did not type.
- Whether every admin write service named in AC-10.3 (refund, mark lift, plan change, pause,
  courtesy) can reach the subject row before its first business rule was not traced per service.
- Whether ADMIN holds the admin subscription list read permission (the basis of choice 5's
  "already visible") was not checked in `rolePermissions.seed.ts`.

### Sixth full review (2026-11-16, clean context)

A sixth clean-context review (at `f31e9d8937`) found no blocker, three majors and nine minors.
Every file:line added below was re-read in this worktree. No "Binding owner decisions" row
changed. Earlier entries that say otherwise (for example "V1-a is DB-backed", withdraw/abandon
"under the payer lock", abandon or `apply` with a third amount as a plain 409 with nothing
written, second review choice 4, and the "Not verified" item on a charge credited after the
MOT:26 abandon) are superseded by this one.

- **M1. Provider calls under locks.** One rule, "Provider calls and locks" under "Lock order":
  unlocked pre-read, provider call outside any transaction, one guarded transaction that
  re-validates the observed preconditions, flow-specific 409 on a mismatch, provider cancels
  after commit; it mirrors S40 (`cancel-pending-attempt.service.ts:37-63`, `:66-76`, `:94`). Every
  "under the payer lock, fresh read" phrasing is gone (AC-8.6, AC-8.12, abandon, replace, job
  lock text, transaction boundaries); the replace paragraph now references AC-8.6 instead of
  repeating its four branches.
- **M2. Job check (c) and partial writes.** AC-8.18 adds check (c)'s re-validation (skip on a
  mismatch); "Zero-row writes abort" is one rule under "Lock order" (child propagation and the
  funnel keep their own); the invariant "an `ACTIVE` agreement has exactly one `ACTIVE`
  version" is stated there, its DB half being the existing `uq_agreement_version_one_active`.
- **M3. `APPLYING` with a third amount.** `apply` re-sends the `APPLYING` amount only after staff
  confirms it with `confirmResendOverAmountMinor` (409 with `details.providerAmountMinor`
  before that); `abandon` fails the version (AV7) and opens MOT:5 (AC-8.12, AC-8.17, version
  changes, stuck `APPLYING`, AV7 row, API rows, UX, tests).
- **Minors.** (1) AC-8.8 points to the matrix; new row for an `OFFERED` agreement with or
  without a payer (`allowedModes: []`, use withdraw). (2) `check-payment-method-branches` moved
  out of "Existing (recount)" into the new-guards row with its 67-site inventory. (3) AC-5.5 test
  seeds a pending payer on a `WITHDRAWN` version. (4) AC-5.6 restricted to My account or an
  unconsumed link. (5) Step 3 declined re-read -> 409 `PREVIOUS_ATTEMPT_CLOSING` (AC-5.6, test).
  (6) V1-a claim corrected: `uq_subscription_commitment_origin` filters `succeeds_id IS NULL`
  (`subscription.dbschema.ts:183-187`), a successor sits in `uq_subscription_commitment_successor`
  (`:188-192`); `findAgreementBlockers` enforces (Success metrics, `subscription` notes,
  spec-consolidada line). (7) Link `issue`/`revoke` lock agreement -> version, re-check
  `OFFERED`, 23505 -> 409 `AGREEMENT_LINK_CONCURRENT_ISSUE` (new AC-4.19, lock-order users, API,
  i18n). (8) Amount retry re-reads the version and `findLatest` right before `changeAmount`
  (`amount-comparison.ts:43-62`). (9) New AC-5.8: a credited charge on an `ABANDONED` payer hangs
  on MOT:2 through the crossing settlement (`cancellation-crossing-rule.ts:32-65`, `:62-63`;
  `cancellation-crossing-charge.ts:222-224`; called at `record-charge-fact.service.ts:288`).

#### Choices made

1. **The explicit confirmation is a request field**, `confirmResendOverAmountMinor`, equal to the
   amount the fresh read shows; a stale value answers the same 409. A field (not only a UI
   dialog) makes the confirmation auditable and race-safe if the provider amount moves again.
2. **`abandon` with a third amount answers 200 `FAILED`**, not a 409: the act did what staff asked
   (stop applying), and the divergence now lives in MOT:5, where the amount comparison already
   accumulates (`amount-comparison.ts:19,83`).
3. **`OFFERED` + end = 409 `AGREEMENT_END_MODE_NOT_AVAILABLE` with `allowedModes: []`**, not an
   implicit withdraw: withdraw has its own semantics (AG3, `end_reason = 'WITHDRAWN'`) and audit,
   and the response shape already carries `allowedModes`.
4. **No new index for the `ACTIVE`-version invariant**: `uq_agreement_version_one_active` (0225)
   is already the partial unique on `status = 'ACTIVE'`; adding
   `uq_agreement_version_active_per_agreement` would duplicate it.
5. **Concurrent link issue maps 23505 to 409 `AGREEMENT_LINK_CONCURRENT_ISSUE` with no retry**:
   under the version lock the second issue simply regenerates, so the 23505 is defence only.
6. **The step 3 declined re-read takes no row lock**: `CHARGE_DECLINED` is terminal and the
   re-read runs after the blocker read, so every interleaving is either a blocker or a declined row
   (a lock would add another agreement's rows to this lock order for nothing).
7. **AC-5.8 widens the crossing classifier for `ACUERDO` only**, whatever the decision
   (S40, S39 or S51); `PRINCIPAL` behaviour is out of scope and unchanged.
8. **The amount retry skips the run** (no finding) when its pre-send re-read sees the version or
   the decision changed; the next run recomputes from fresh state.

#### Not verified (sixth review)

- Whether the reconciliation sweep runs the amount comparison inside a context where a short
  `FOR SHARE` transaction can be opened before `changeAmount` was not traced; the implementer
  places the re-read where the comparison has database access.
- Whether `openReconciliationMark` hangs a payment on MOT:2 for a row with no cancellation
  decision (AC-5.8's "whatever the decision") without other preconditions was not traced beyond
  `cancellation-crossing-charge.ts:222-250`.

### Seventh full review (2026-11-16, clean context)

A seventh clean-context review (at `685fdfc094`) found no blocker, three majors and ten minors.
Every file:line added below was re-read in this worktree. One "Binding owner decisions" row was
added (D26, approved 2026-11-16); no other row changed. Earlier entries that say otherwise (for
example the dry run as "steps 1, 2 and 3", step 5's "re-read, step 4", the amount retry
re-sending the `APPLYING` amount over any provider amount, "Two exclusions" in the glossary, and
sixth review choice 7's reading that S51 was covered) are superseded by this one.

- **M1. S51 missing from the crossing classifier.** `S51` joins
  `CROSSING_MARK_TRANSITIONS_ON_CANCELLED`, the `CrossingMarkTransition` type and both records of
  `cancellation-crossing-rule.ts` (`:4`, `:9`, `:15-24`, `:92-98`); no frozen length exists, the
  test `it.each` lists gain it. The late credit stays on the old payer, children stay `CANCELLED`
  with no coverage and no event (crossing bullet of "Class gates", first-credit bullet, S51 row,
  new AC-5.9, risk row, Phase 4, test row).
- **M2. Dry run.** One definition, "Authorize dry run" under "Authorization flow": steps 1, 2 and
  step 3's checks without the declined re-read and without 2b; `PREVIOUS_ATTEMPT_CLOSING` only from
  the real authorize (AC-4.12, AC-4.14 row 7, schema comment, new AC-3.15, Phase 3, test row).
- **M3. Automatic retry while `APPLYING`.** Rule (2) of the single amount-retry rule ("After
  `FAILED`"): send only over the `ACTIVE` version's amount; a third amount -> no send, MOT:5
  (AC-8.1, DECREASE paragraph, edge case, new AC-8.19, Phase 4, test rows).
- **D26.** Binding row; the rule in the S1 bullet of "Writers that must refuse" (S1
  `start-subscription.service.ts:325-329`, manual start `start-manual-subscription.service.ts:72-76`,
  flag from `readBillingChoice` `:142-149`); new AC-7.10; i18n reuse; Phase 2; test row.
- **Minors.** (1) Glossary: third exclusion `replacingVersionId`. (2) `AgreementScopeLock` brand on
  `CANCELLED`/`CHARGE_DECLINED` (signature, rule 8, guards note, Phase 2). (3) Customer `users` row
  as the first lock level, taken by authorize and S13 only; MOT:10 of the existing grant fan-out
  check is the safety net (lock order, authorize step 1 and boundaries, selector inventory, S13
  site, new AC-9.4, phases, test row). (4) Step 5 23505 on
  `uq_subscription_live_payer_per_version` -> 409 `PREVIOUS_ATTEMPT_IN_PROGRESS` (test row). (5)
  `plan` row `FOR UPDATE` before a private version publish; 23505 on
  `uq_plan_version_one_current_per_plan` (`plan-catalog.dbschema.ts:128`) -> 409
  `PRIVATE_PLAN_CONCURRENT_PUBLISH` (Versioning, errors, API row, i18n, new AC-2.10, Phase 1, test
  row). (6) Withdraw/replace re-validation: a payer S3 abandoned meanwhile proceeds as no payer
  (AC-8.6, provider-call rule, test row). (7) "Cancel agreement" also in the GRACE_PERIOD and
  SUSPENDED card states (UX, AC-7.1, test row). (8) Covered by D26. (9) AC-5.5 test row cites the
  new MOT:26 catalog entry. (10) `/agreements/mine` `pendingVersion` (schema, UX, i18n key
  `card.PENDING_PRICE`, new AC-3.16, Phase 5, test row).

#### Choices made

1. **M1 keeps the covered period on the old payer.** `credit-payment.service.ts:169-178` writes it
   for every non-`LAPIDA` row; it is the money record the refund resolves against, and it grants
   nothing because the children are `CANCELLED` (not a title-emitting status,
   `subscription-sources.ts:60-82`) and the payer is never a coverage source. Skipping the insert
   would need a new branch in the credit path for no behavioural gain.
2. **M2 drops the declined re-read from the dry run rather than adding `PREVIOUS_ATTEMPT_CLOSING`
   to the block reasons**: a historical, already-cancelled declined row would block forever, and
   2b (which could clear it) calls the provider.
3. **M3 opens MOT:5 for a third amount while `APPLYING`** and leaves MOT:27 to its own rules (open
   from the publish or the stale check, lifted on exit from `APPLYING`), consistent with sixth
   review choice 2; the re-send over a third amount stays a staff confirmation (AC-8.17).
4. **D26 uses the D18 reason `AGREEMENT_TOURIST_VIP_REDUNDANT`**: the owner's "`TOURIST_VIP_REDUNDANT`
   ... same code as D18" read as that reason, which also makes the i18n reuse direct
   (`billing.agreements.blocked.AGREEMENT_TOURIST_VIP_REDUNDANT`). No `details`.
5. **D26 counts a tourist child in any live status, `PENDING_AUTHORIZATION` included**: a VIP plan
   bought while the agreement is pending would double the VIP charge at activation, and the live
   set is the one S1 already uses for `VERTICAL_IN_AGREEMENT`.
6. **D26 symmetric case: no new code.** `assertTouristVipPurchaseAllowed`
   (`start-subscription.service.ts:166-182`) already refuses a tourist purchase while a title row
   inherits VIP, and its title rows (`tourist-vip.model.ts:53-82`) include an `ACTIVE`,
   `GRACE_PERIOD` or `CANCEL_SCHEDULED` child. Consistent with D18 (refuse), with the existing
   409 `TOURIST_VIP_INHERITED`. A tourist plan bought while the VIP-inheriting child is still
   pending is cancelled at activation like for any VIP-inheriting activation.
7. **Minor 3 locks the customer's `users` row**, not the agreement scope: S13 has no agreement to
   lock, and the user row is the only row both acts own; it becomes the first level of the global
   order, taken only by authorize and S13.
8. **Minor 3 adds no consistency-job check and no new MOT**: the reconciliation sweep's grant
   fan-out check already selects a live child under a live grant anchor of its vertical
   (`reconciliation-zero-call.model.ts:108-162`) and opens MOT:10 `FAN_OUT_DE_GRANT_INCOMPLETO`
   (`grant-fan-out-check.ts:141-152`); a second check would duplicate it. No catalog count changes.
9. **Minor 10: `pendingVersion` is a nullable key**, always present (`null` unless an `ACTIVE`
   agreement has an `APPLYING` version), with only `amountMinor` and `status`; `version` keeps the
   amount actually charged.
10. **Minor 6 applies to replace too**, since replace runs the same AC-8.6 sequence; the act sends
    no cancel because S3 owns that payer's.

#### Not verified (seventh review)

- Whether any existing transaction locks a `users` row `FOR UPDATE` after subscription rows (which
  would invert the new first level against authorize or S13) was not searched across the codebase.
- Whether the plans-page checkout island maps a 422 from S1 to `billing.agreements.blocked.*` or
  needs a mapping entry was not traced in `apps/web`.
- Whether S3 always sends its own provider cancel for an abandoned payer (minor 6's "no cancel by
  the act") was not traced beyond the `AUTHORIZATION_EXPIRED` before-cancel kind.

### Scoped review of the seventh pass (2026-11-16)

Four fixes from a scoped review of the seventh pass:

1. **D26 covers the plan change and S37.** `requestPlanChange` reaches `startSuccession`
   (`request-plan-change.service.ts:29,293`), which already runs `assertTouristVipPurchaseAllowed`
   (`start-succession.service.ts:76-80`); `assertNoAgreementTouristLineForVipPlan` runs right
   after it there. An S37 cohort to a VIP-inheriting target excludes a customer with a live
   agreement tourist child (`AGREEMENT_TOURIST_VIP_REDUNDANT`; cohort read
   `plan-migration-cohort.ts`, classifiers in the preview and launch services). AC-7.10, the
   writers bullet, i18n row, Phase 7 and the test row extended.
2. **D26 row reworded** to "once the customer has a live agreement tourist child (pending
   authorization included)", matching AC-7.10 and choice 5; no change of substance.
3. **D26 versus D18 race.** S1 of a VIP plan and authorize of an agreement with a tourist line
   share no lock. No existing reason fits, so MOT:29 `VIP_TURISTA_DUPLICADO_POR_ACUERDO`
   (`refundConfirmation: false`, `NONE`) is opened by the new consistency-job check (e) (AC-6.18,
   Risks row, test row). Recounts: 24 -> 29, refund confirmations stay ten, `NONE` 14 -> 18;
   every "MOT:25-28" reads "MOT:25-29" except the admin detail's `openMarks` (payer and children only).
4. **`users` row lock is `FOR NO KEY UPDATE`** ("Lock order", AC-9.4, authorize step 1): it
   serializes authorize against S13 without conflicting with FK `KEY SHARE` locks; S13's grant
   insert and preview take `KEY SHARE` first, so "first lock" reads "first explicit lock".

#### Not verified (scoped review)

- Whether the S37 launch can read the target version's `inherits_tourist_vip` without a new
  query was not traced (`targetOptions` carries billing options, not the flag).
- The exact admin i18n path of the plan-migration exclusion labels beyond `admin-pages.json:1511`.
