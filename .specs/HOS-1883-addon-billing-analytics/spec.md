---
title: Billing analytics for add-ons (COMPLEMENTO subscriptions and one-time add-on payments)
linear: HOS-1883
statusSource: linear
created: 2026-11-17
decisionsResolvedOn: 2026-11-18
type: feature
areas:
  - billing
  - api
smokeLabels:
  - status-needs-smoke-staging
  - status-needs-smoke-prod
---

# Billing analytics for add-ons (COMPLEMENTO subscriptions and one-time add-on payments)

> Phase 1 (docs only). Every `path:line` was measured on `origin/staging` at `c8f6c14a70`
> (2026-11-17), after `epic/HOS-1352-post-mvp` merged (`96756adfc4`). This spec extends
> `.specs/HOS-1878-billing-analytics-events/spec.md` and reuses its principles P-1 … P-9 except
> where §2 says otherwise.
>
> **Status of decisions:** the owner resolved O-1 … O-5 on 2026-11-18 (§9). Each decision is
> recorded as a comment on Linear HOS-1883.

## 1. Problem and goal

HOS-1878 shipped billing analytics for **PRINCIPAL** subscriptions only (its D-4, owner
2026-10-25). Add-ons produce no analytics event today, for three measured reasons:

1. **The adapter drops them.** `createAnalyticsFactSink` returns early for any fact whose
   `subscriptionClass !== 'PRINCIPAL'` (`apps/api/src/utils/analytics/analytics-facts.ts:262-275`).
2. **No producer builds them.**
   - `creditPayment` builds its charge fact only when `payment.addonInstanceId === null` and
     `subscription.class === 'PRINCIPAL'`
     (`packages/service-core/src/services/billing/payment/credit-payment.service.ts:345-352`).
   - `recordChargeFact` applies the same filter to rejected charges
     (`payment/record-charge-fact.service.ts:347-352`).
   - No add-on transition calls `emitBillingFact`: not A1, A1-bis, A2, A3, A5, A6, A7, S12 on a
     complement, S20 or S21.
3. **The fact type cannot carry a one-time payment.** `BillingFact` requires `subscriptionId`
   (`billing/facts/billing-fact-sink.ts:7-14`). A one-time add-on payment has
   `subscription_id = NULL` and `addon_instance_id` set. The schema enforces exactly one of the
   two (`packages/db/src/schemas/vertical/payment.dbschema.ts:53-54`).

The add-on model has two charge kinds (`ADDON_CHARGE_KINDS`, `addon-product.dbschema.ts:20`):

- **`PERIODICO` (recurring).**
  - A1 inserts a `COMPLEMENTO` subscription with no plan anchor
    (`addon/purchase-addon-complement.ts:38-51`).
  - The price and cycle live on `addon_product` (`addon-product.dbschema.ts:46-55`).
  - The provider charges it like any preapproval.
- **`UNA_VEZ` (one-time).**
  - A1 inserts only the instance and an `ORDER_CREATE` key
    (`addon/purchase-addon.service.ts:196-202`).
  - The route places the order (`apps/api/src/routes/billing-addon/purchase.ts:124`).
  - `confirmOneTimeOrder` inserts the payment with `addonInstanceId` and credits it
    (`addon/addon-instance-a2-one-time.ts:109-124`, `:170-173`).

The production catalog has 4 recurring and 6 one-time products. Each is compatible with exactly
one vertical (`packages/db/src/migrations/0176_production_catalog_prices_addons.sql:66-76`).

**Goal.** Analytics can answer these questions per vertical and per add-on:

1. Funnel. How many add-on purchases start, how many activate, and how many die (window
   expired, order declined, closed before authorization)?
2. Charges. How many add-on charges succeed, each with its `amount_minor`? How many are first
   charges and how many are renewals?
3. Payment failures on recurring add-ons.
4. Churn. How many paid add-ons end early, and through which path (owner withdrew, principal
   ended, orphaned, grant revoked, listing purged)?
5. Courtesy. How many add-ons became free under a permanent grant? This counts both paid
   add-ons that S20 converted and add-ons chosen free under A1-bis. Courtesy is never counted
   as churn.

Principal metrics must not change. Every `billing_*` event stays PRINCIPAL-only, and a test pins
that (§5.4, AC-13).

**MRR is not in this spec.** By owner decision O-2, MRR including add-ons moved to **HOS-2354**,
an admin page that computes it from the DB. Two reasons: Umami boards cannot sum amounts, and
Umami does not deduplicate at ingestion.

### 1.1 What changed since HOS-1878 was written

- **The transport is Umami, not PostHog.** HOS-2119 replaced PostHog in a direct cut
  (`apps/api/src/lib/analytics-client.ts:1-20`).
  - The `uuid` that PostHog used to deduplicate is now forwarded only as `data.event_uuid`, "for
    dedup audits" (`packages/analytics/src/providers/umami-payload.ts:280`, `:342-344`;
    `.specs/HOS-2119-posthog-to-umami/spec.md:233-234`).
  - Umami does not deduplicate at ingestion. See §2, P-3'.
- **Umami boards cannot split an event by a custom property** (`scripts/umami/boards.ts:296-297`,
  `NO_EVENT_PROP`).
  - The board Goals and the subscription funnel bind to event names
    (`scripts/umami/definitions.ts:267-302`).
  - Reusing `billing_*` for add-ons would therefore have mixed add-ons into those Goals and that
    funnel. This drove O-1.

### 1.2 Premise of the issue that does not hold

The issue lists "grace" among the COMPLEMENTO events. **A COMPLEMENTO never enters grace.**

- `enterGraceOnRejectedCharge` returns `NOT_CARD_PRINCIPAL` for any non-principal row
  (`subscription/enter-grace.service.ts:88-89`).
- `declineFirstCharge` requires PRINCIPAL (`subscription/decline-first-charge.service.ts:100`).
- `suspendForArrears` requires PRINCIPAL (`subscription/suspend-for-arrears.service.ts:167-168`).

A rejected complement charge therefore leaves the row unchanged
(`record-charge-fact.service.ts:316-336`). This spec has no grace, suspension or recovery event
for add-ons.

## 2. Principles

HOS-1878 P-1, P-2, P-4 to P-9 apply unchanged, with these adjustments:

- **P-1' Same door.** All emission goes through this chain: `BillingFactSink` →
  `createAnalyticsFactSink` → `captureServerAnalyticsEvent` (`analytics-client.ts:169`).
  Nothing is emitted inside a transaction.
- **P-3' Idempotency comes from guarded emission plus a deterministic id. It does not come from
  ingestion dedupe.**
  - An event is emitted only from the branch that actually wrote the transition: a guarded
    `UPDATE … WHERE status = <from>` that returned a row.
  - Replays return `NOT_APPLICABLE`, `ALREADY_*` or `EXISTING`, and they emit nothing.
  - The `uuid` is still derived (`deriveAnalyticsEventUuid`, `analytics-facts.ts:283-286`) and
    lands in `data.event_uuid`. An exact count is `count(distinct event_uuid)`.
  - A crash between commit and emission loses the event (P-9).
- **P-4' Vertical when derivable.**
  - For a COMPLEMENTO, `vertical` is the row's `vertical`. A1 writes the title vertical
    (`purchase-addon.service.ts:204-212`).
  - For a one-time instance or a free choice with `LISTING` or `VERTICAL_SUBSCRIPTION` scope, it
    is the target's vertical (`addon/addon-coverage-verticals.ts:18-31`).
  - For `USER`/`GLOBAL` scope, it is the product's single compatible vertical. It is omitted when
    the product has more than one.
  - Add-on schemas therefore make `vertical` optional. Every product in production has exactly
    one vertical.
- **P-10 Add-on facts never reach `billing_*`.** The adapter keeps dropping non-PRINCIPAL facts of
  the HOS-1878 kinds (`analytics-facts.ts:262-275`). A unit test pins this (AC-13).
- **P-11 Schemas are additive.** Add-on event schemas are plain `z.object` and never `.strict()`.
  The adapter spreads optional properties conditionally, as HOS-1878 already does for `reason`
  (`analytics-facts.ts:195`, `:209`). This lets HOS-2355 add the optional `reason` to
  `addon_cancelled` without breaking any consumer.

## 3. Reference model (verified)

| Act | Function (`path:line`) | Writes | Called from |
|---|---|---|---|
| A1 purchase | `purchaseAddon` `addon/purchase-addon.service.ts:91`; `CREATED` `:234-238` | instance `PENDING_AUTHORIZATION`, plus a COMPLEMENTO in `PENDING_AUTHORIZATION` when `PERIODICO` | route `billing-addon/purchase.ts:88` |
| A1 provider refusal | `abandonRefusedComplement` `addon/purchase-addon-rejection.ts:44` (from `purchase-addon.service.ts:258-266`) | both rows `ABANDONED`; the error is rethrown | same |
| A1-bis free choice | `chooseFreeAddon` `addon/choose-free-addon.service.ts:63`; instance inserted `ACTIVE` with `titleAnchorId` and no complement `:145-158`; `CREATED` `:172`; post-commit block `:174-186` | instance `ACTIVE` at $0 | route `billing-addon/free-choice.ts:59` |
| A2 recurring | `applyA2Recurring` `addon/addon-instance-a2.ts:37`; `ACTIVATED` `:126-131` | COMPLEMENTO and instance `ACTIVE` | `activateAuthorizedPending` `notice/complement-authorized.ts:49-65` (webhook S2 dispatch `notice/process-provider-notice.service.ts:347-357`); A3 `addon/expire-addon-authorization-windows.service.ts:194-208` |
| A2 one-time | `confirmOneTimeOrder` `addon/addon-instance-a2-one-time.ts:26`; `ACTIVATED` `:178` | instance `ACTIVE`, plus a `PENDING` payment that goes to `creditPayment` | route `purchase.ts:135`; A3 `addon/expire-addon-authorization-windows-one-time.ts:76` |
| A3 recurring | `abandonRecurring` `expire-addon-authorization-windows.service.ts:50`; `wrote` `:214-222` | both rows `ABANDONED` | cron `subscription-window-expiry.job.ts:118` |
| A3 one-time | `abandonOneTimeAddon` `expire-addon-authorization-windows-one-time.ts:21` | instance `ABANDONED` | same cron |
| A7 declined order | `rejectOneTimeOrder` `addon/addon-instance-a7.ts:12`; `ABANDONED` `:91` | instance `ABANDONED` | route `purchase.ts:141`, `:144` |
| Charge credited | `creditPayment` `payment/credit-payment.service.ts:71`; post-commit emit `:389-391` | payment `SUCCEEDED` | `recordChargeFact` `record-charge-fact.service.ts:230`; `confirmOneTimeOrder` `:170` |
| Charge rejected | `recordChargeFact` rejected branch `record-charge-fact.service.ts:306-381` | payment detail; the complement is unchanged | webhook, reconciliation sweep |
| S11 rule | `cancelComplementsByS11Rule` `subscription/complement-s11-rule.ts:95`; write `:62-85` | COMPLEMENTO `ACTIVE` → `CANCEL_SCHEDULED` | `cancel-active-subscription.service.ts:253`, `reactivate-suspended.service.ts:342`, `cancel-paused-subscription.service.ts:123`, `notice/mirror-our-cancellation-on-active.ts:161` |
| S12 complement | `applyS12ToComplement` `subscription/service-end-s12.ts:247`; write `:256-258`; then A5 `WITHDRAWN` `:270-272` | COMPLEMENTO `CANCELLED`, instance `CANCELLED` | `end-scheduled-services.service.ts:302-307` |
| A5 | `applyA5` `addon/addon-instance-a5.ts:135`; clauses `ORPHANED\|WITHDRAWN\|GRANT_REVOKED` `:52`; S21 `:238` | instance `CANCELLED`; S21 sets the COMPLEMENTO to `CANCELLED` | owner withdrawal `withdraw-addon.service.ts:78`; `runOrphanhood` `:292` (S12 principal, revocation, direct cancel, paused cancel, S13, successor cut); grant revoke `grant/permanent-grant-revoke.ts:177` |
| A6 listing purged | `applyA6` `addon/addon-instance-a6.ts:51`; S21 `:108`; its result carries clause `'ORPHANED'` `:152` | instance and COMPLEMENTO `CANCELLED` | `cancelPurgedListingAddon` `:162` |
| S21 | `applyS21` `subscription/complement-s21.ts:118`; `CANCELLED` `:191`; `ALREADY_CANCELLED` `:149` | COMPLEMENTO `CANCELLED` | only from A5 and A6 |
| S20 | `runS20InTransaction` `grant/permanent-grant-s20.ts:267`; re-anchor `:216-224`; complement write `:233-249`; `S20Row` (`instanceId`, `instanceStatus`, `origin`, `subscriptionId`) `:45-58` | COMPLEMENTO `CANCELLED`; the instance stays in its state, re-anchored at $0 | **committing:** `grantPermanentGrant` `permanent-grant.service.ts:54` (S20 `:130`, post-commit `:165`), `anchorPermanentGrantVertical` `:198` (S20 `:305`, post-commit `:337`), `resumePermanentGrant` `permanent-grant-resume.ts:43` (S20 `:106`, post-commit `:175`). **Dry-run (never commits):** `permanent-grant-preview.ts:121`, `:246` |
| S32 / S33 | `pauseComplementsS32` `subscription/complement-pause-s32.ts:54` (`PAUSED` `:324`); `resumeComplementsS33` `complement-resume-s33.ts:44` (`ACTIVE` `:244`) | COMPLEMENTO pause and resume | 8 S32 callers, 3 S33 callers |
| Natural expiry | `expireAddonInstances` `addon/expire-addon-instances.service.ts:30`; `EXPIRED` `:67` | instance `EXPIRED` | cron `subscription-window-expiry.job.ts:134` |

Two post-commit choke points already exist, and every A2 and A5/A6 path goes through one of them:

- **`emitAddonCoverageAdded`** (`addon-instance-a2.ts:135`). It is called by:
  - `complement-authorized.ts:61`;
  - `expire-addon-authorization-windows.service.ts:205`;
  - `addon-instance-a2-one-time.ts:174`;
  - and by A1-bis at `choose-free-addon.service.ts:175`, which is a free add-on and not a paid
    activation (§5.2).
- **`emitAddonCoverageRemoved`** (`addon-instance-a5.ts:367`). Its production call sites are:
  - `withdraw-addon.service.ts:98`;
  - `addon-instance-a6.ts:190`;
  - `expire-addon-instances.service.ts:100`;
  - `permanent-grant.service.ts:156` and `:328`;
  - `permanent-grant-revoke.ts:211`;
  - `permanent-grant-resume.ts:177`;
  - `revoke-subscription.service.ts:389`;
  - `service-end-s12-chargeback.ts:263`;
  - `end-scheduled-services.service.ts:156` (`afterA5Commit`);
  - `cancel-direct-subscription.service.ts:352`;
  - `cancel-paused-subscription-support.ts:269`;
  - `successor-cut-after-commit.ts:157`.

## 4. Event catalog (O-1 = dedicated `addon_*` family)

### 4.1 Conventions

- Event names use `snake_case` and the prefix `addon_`, and stay within 50 characters (the Umami
  limit, `umami-payload.ts:22-23`).
- **Properties common to every event:**
  - `addon_instance_id`, `addon_id`, `addon_version_id`, `addon_product_id`;
  - `charge_kind` (`UNA_VEZ|PERIODICO`);
  - `scope_type` (`LISTING|VERTICAL_SUBSCRIPTION|USER|GLOBAL`, `addon-catalog.dbschema.ts:27`);
  - `actor_kind` (`USER|ADMIN|SYSTEM`);
  - `vertical`, optional (P-4');
  - `subscription_id`, the COMPLEMENTO id. It is present only on a paid `PERIODICO` add-on.
- **`distinct_id`** is `addon_instance.owner_id` (`addon-product.dbschema.ts:101-104`). This is
  the same rule as HOS-1878 D-5.
- **Money:**
  - `amount_minor` is an integer and `currency` is `'ARS'` (enforced by
    `ck_addon_product_currency`, `addon-product.dbschema.ts:67`).
  - `cycle` takes the 4 values of `ADDON_CYCLES` (`:21`) and is present only on `PERIODICO`.

### 4.2 Events

| Event | Emitted when (function `path:line`) | Own required properties | Own optional properties | Dedupe key |
|---|---|---|---|---|
| `addon_checkout_started` | `purchaseAddon` returns `outcome:'CREATED'`. The route `billing-addon/purchase.ts` emits right after `:88`. For `PERIODICO`, this is reached only after the provider authorization succeeded: a refusal throws (`purchase-addon.service.ts:243-284`) and emits nothing, as in HOS-1878 AC-1. `EXISTING` and `PENDING_ELSEWHERE` do not emit | `amount_minor`, `currency` | `cycle` | `addon_instance_id` |
| `addon_checkout_abandoned` | Any of: (a) A3 recurring, when `abandonRecurring` returned `true` (`expire-addon-authorization-windows.service.ts:214-222`); (b) A3 one-time, when `abandonOneTimeAddon` wrote (`…-one-time.ts:21`); (c) A7, when `rejectOneTimeOrder` returned `ABANDONED` (`addon-instance-a7.ts:91`); (d) an A5, A6 or S20 act on an instance whose origin was `PENDING_AUTHORIZATION` (§5.3) | `reason` (`WINDOW_EXPIRED\|ORDER_DECLINED\|OWNER_WITHDREW\|CLOSED_BY_SYSTEM`) | `seconds_in_pending` | `addon_instance_id` |
| `addon_activated` | A **paid** activation: `applyA2Recurring` or `confirmOneTimeOrder` returned `ACTIVATED`. It is emitted after commit through `emitAddonCoverageAdded` (§5.2), **once per instance**, outside that function's per-vertical `seen` dedupe (`addon-instance-a2.ts:139-144`). A1-bis never emits it | `amount_minor`, `currency` | `cycle`, `seconds_in_pending` | `addon_instance_id` |
| `addon_charge_succeeded` | `creditPayment` returns `CREDITED` for a payment that has `addonInstanceId` set (one-time) or whose subscription is a `COMPLEMENTO`. This is a new branch next to `credit-payment.service.ts:345-373`, emitted at `:389-391` | `payment_id`, `amount_minor`, `currency` | `is_first_charge` (`PERIODICO` only, T-1), `cycle`, `promo_applied` | `payment_id` |
| `addon_charge_declined` | The `recordChargeFact` rejected branch for a COMPLEMENTO row, a new branch next to `record-charge-fact.service.ts:347-380`. **One-time declines create no payment row** (`addon-instance-a2-one-time.ts:59`, `:109-124`). They are reported as `addon_checkout_abandoned{reason:'ORDER_DECLINED'}` | `payment_id`, `amount_minor`, `currency`, `is_first_charge` | `has_retry_window` | `payment_id` |
| `addon_cancelled` | A **paid, live** add-on ends before its natural end (§5.3). That is one of: S21 returned `CANCELLED` from a non-pending state (A5 or A6); S12 cancelled the complement (`service-end-s12.ts:256-258`); or A5/A6 cancelled an `ACTIVE` one-time instance. It is emitted after commit through `emitAddonCoverageRemoved`. **It ships without `reason`** (O-4): HOS-2355 adds an optional `reason` later (P-11) | `path` (`OWNER_WITHDREW\|SERVICE_END\|ORPHANED\|GRANT_REVOKED\|LISTING_PURGED`), `was_scheduled` | `lifetime_days` | `addon_instance_id` |
| `addon_granted_free` | An add-on becomes free under a permanent grant (O-5). (a) **S20 conversion:** for each row in the committed `S20Result.rows` whose `instanceStatus` is `ACTIVE`. It is emitted post-commit by the three committing callers only, right after `cancelS20AtProvider`: `permanent-grant.service.ts:165`, `:337` and `permanent-grant-resume.ts:175`. (b) **A1-bis free choice:** `chooseFreeAddon` returned `CREATED`, emitted in its post-commit block (`choose-free-addon.service.ts:174`) regardless of the `coverageNotices` gate on that line. The dry-run in `permanent-grant-preview.ts:121`, `:246` **never** emits. `EXISTING` and `REFUSED` do not emit. It is never counted as `addon_cancelled` | `source` (`S20_CONVERSION\|FREE_CHOICE`) | `previous_amount_minor`, `previous_cycle` (S20 only, read from `addon_product` and `currency:'ARS'`), `previous_subscription_id` (S20 only, the cancelled COMPLEMENTO) | `addon_instance_id` |

### 4.3 `actor_kind` per event or path

| Event or path | `actor_kind` |
|---|---|
| `addon_checkout_started`, `addon_cancelled{OWNER_WITHDREW}`, `addon_granted_free{FREE_CHOICE}` | `USER` |
| `addon_cancelled{GRANT_REVOKED}`, `addon_granted_free{S20_CONVERSION}` | `ADMIN` (a SUPER_ADMIN act: grant, anchor, resume) |
| Everything else (provider outcomes, crons, orphanhood) | `SYSTEM` |

`was_scheduled` is true when the COMPLEMENTO row was `CANCEL_SCHEDULED` before the end. That
happens through the S11 rule (`complement-s11-rule.ts:62-85`) or through the mirror
(`mirror-our-cancellation-on-active.ts:155`).

### 4.4 Not emitted

- Pause and resume (S32/S33). Owner decision O-3: charges stop and restart on their own, and
  principals have no pause events either.
- `addon_cancel_scheduled` (T-3).
- Natural `FIXED_DAYS` expiry (T-4).
- Chargebacks and refunds on add-on payments. Out of scope, as in HOS-1878 §10.
- The A1 provider refusal (`abandonRefusedComplement`). It never emitted `started`, so it emits
  no `abandoned` either.

## 5. Mechanism

### 5.1 Fact type

- Add an `AddonFact` union to service-core in a new file, `billing/facts/addon-fact.ts`, so that
  `billing-fact-sink.ts` stays small.
  - Kinds: `ADDON_CHECKOUT_STARTED`, `ADDON_CHECKOUT_ABANDONED`, `ADDON_ACTIVATED`,
    `ADDON_CHARGE_CREDITED`, `ADDON_CHARGE_REJECTED`, `ADDON_CANCELLED`, `ADDON_GRANTED_FREE`.
  - Common shape: `{ userId, addonInstanceId, addonId, addonVersionId, addonProductId,
    chargeKind, scopeType, actorKind, occurredAt, vertical?, subscriptionId? }`.
- Widen `BillingFactSink.emit` to accept `BillingFact | AddonFact`.
- The two log calls in `billing-fact-sink.ts:128-131` and `:142-145` log `addonInstanceId` when
  the fact has no `subscriptionId`.
- The HOS-1878 kinds do not change.

### 5.2 Producers

- **Checkout started.** The route emits it, as HOS-1878 does for S1
  (`routes/billing-subscription/index.ts:83-110`).
  - `PurchaseAddonResult.CREATED` gains `complementSubscriptionId?` plus the product fields the
    fact needs: ids, `price`, `currency`, `cycle` and scope.
  - The service already holds the complement id at `purchase-addon.service.ts:217-221`, and the
    full product row and policy at `:96-102`.
  - The route reads only `chargeKind` (`purchase.ts:43-46`), so it must not re-read the price.
    A read after the call could differ from the price that was authorized.
- **Activated.** `emitAddonCoverageAdded` gains a **required** parameter,
  `fact: { billingFacts }` or `fact: 'NOT_A_PAID_ACTIVATION'`. TypeScript then forces every
  caller to choose:
  - The three A2 callers pass the sink.
  - A1-bis (`choose-free-addon.service.ts:175`) passes `'NOT_A_PAID_ACTIVATION'`. Its event is
    `addon_granted_free`.
  - `ActivatedAddon` (`addon-instance-a2.ts:29-34`) gains what the fact needs: product id,
    version, addon id, scope, charge kind and `seconds_in_pending`.
  - `confirmOneTimeOrder` returns the same shape.
- **Charges.** `creditPayment` and `recordChargeFact` gain the add-on branches of §4.
  - For a COMPLEMENTO, `firstPayment` uses the same ledger read that PRINCIPAL uses today
    (`credit-payment.service.ts:120-126`).
  - `cycle` and `addon_product_id` are read in the same transaction, through
    `addon_instance.complement_subscription_id` (`addon-product.dbschema.ts:114-116`) for a
    recurring payment, or through `payment.addon_instance_id` for a one-time payment.
  - `confirmOneTimeOrder` passes `billingFacts` to `creditPayment`. Today it passes only `clock`
    and `coverageNotices` (`addon-instance-a2-one-time.ts:170-173`).
  - `buildAddonPurchasePorts` (`apps/api/src/routes/billing-addon/purchase-ports.ts`) and the A3
    ports (`subscription-window-expiry.job.ts:118-124`) gain
    `billingFacts: getAnalyticsFactSink()`.
- **Abandoned.**
  - `abandonRecurring` and `abandonOneTimeAddon` return enough data to build the fact.
    `expireAddonAuthorizationWindows` emits after each committed row.
  - A7 emits after its own commit.
- **Cancelled.** `emitAddonCoverageRemoved` gains a **required** discriminated parameter:
  `end: { path, actorKind, billingFacts }` or `end: 'NOT_AN_END'`.
  - `expire-addon-instances.service.ts:100` passes `'NOT_AN_END'` (natural expiry, T-4).
  - Each other call site states its path.
  - `afterA5Commit` (`end-scheduled-services.service.ts:151`) takes a path argument: `ORPHANED`
    from phase 1 (`:253`) and `SERVICE_END` from phase 2 (`:307`).
  - `CancelledAddon` (`addon-instance-a5.ts:64-77`) gains:
    - `origin`, the instance's from-state;
    - `complementOutcome`: `CANCELLED` with its `from`, or `ALREADY_CANCELLED`, or `null`;
    - `wasScheduled`, `chargeKind`, the product, version and addon ids, and `startsAt`.
  - A6 labels its result `'ORPHANED'` (`addon-instance-a6.ts:152`), so its caller passes
    `LISTING_PURGED` explicitly.
- **Granted free.**
  - **S20.** `S20Row` (`permanent-grant-s20.ts:53-58`) gains the fields the fact needs.
    `readS20Instances` already reads `productId` and joins `addon_product` (`:139`, `:148`); add
    `addonVersionId`, `addonId`, `price`, `cycle`, `scopeType` and the owner.
    - A new helper, `emitS20GrantedFreeFacts({ rows, billingFacts })`, is called by the three
      committing callers right after `cancelS20AtProvider`. This means
      `permanent-grant.service.ts:165`, `:337` and `permanent-grant-resume.ts:175`.
    - These functions gain a **required** `billingFacts` port, so the composition roots of the
      grant routes must wire it.
    - A row whose `instanceStatus` is `PENDING_AUTHORIZATION` was never paid, so it emits
      `addon_checkout_abandoned{reason:'CLOSED_BY_SYSTEM'}` instead (§5.3).
    - **No fact is built inside `runS20InTransaction`.** That function also runs inside the
      preview's dry-run transaction (`permanent-grant-preview.ts:121`, `:246`). AC-21 pins that
      the preview emits nothing.
  - **A1-bis.** `chooseFreeAddon` emits after its transaction returns `CREATED`.
    - Its ports gain a **required** `billingFacts`. The route wires it at
      `billing-addon/free-choice.ts:59`; today it passes only
      `{ clock, addonPolicy, listing, coverageNotices }`.
    - The data comes from the inserted row and the product already read at
      `choose-free-addon.service.ts:73`.

### 5.3 Which event an ending or conversion emits

| Instance origin | Complement | Act | Emits |
|---|---|---|---|
| `PENDING_AUTHORIZATION` | any | withdrawal | `addon_checkout_abandoned{reason:'OWNER_WITHDREW'}` |
| `PENDING_AUTHORIZATION` | any | orphanhood, grant revoked, listing purged, S20 | `addon_checkout_abandoned{reason:'CLOSED_BY_SYSTEM'}` |
| `ACTIVE`, `PERIODICO` | S21 `CANCELLED` from `ACTIVE`, `PAUSED` or `CANCEL_SCHEDULED` | A5 or A6 | `addon_cancelled` with the call site's `path` |
| `ACTIVE`, `PERIODICO` | `ALREADY_CANCELLED` after an S12 write in the same transaction | S12 then A5 | `addon_cancelled{path:'SERVICE_END', was_scheduled:true}` (`service-end-s12.ts:256-272`) |
| `ACTIVE`, `PERIODICO` | live; S20 cancels it and the instance stays `ACTIVE` | S20 | `addon_granted_free{source:'S20_CONVERSION'}`, **never** `addon_cancelled` |
| `ACTIVE`, `PERIODICO` | `ALREADY_CANCELLED` because an earlier S20 ended its billing | A5 later | nothing: the instance was already free |
| `ACTIVE`, free choice (no complement, `titleAnchorId` set) | none | A5 later | nothing: the instance was never paid |
| `ACTIVE`, `UNA_VEZ` | none | A5 or A6 | `addon_cancelled` with the call site's `path` |

### 5.4 Adapter

- `createAnalyticsFactSink` (`analytics-facts.ts:259`) routes the `ADDON_*` kinds to a new
  translator, `analytics-facts-addon.ts`. The current file has 349 lines and the limit is 500.
- The PRINCIPAL filter for the HOS-1878 kinds stays.
- The dedupe keys are those of §4, hashed with the event name by `deriveAnalyticsEventUuid`.
- Optional properties are spread only when present (P-11).

### 5.5 Catalog, docs and guard

- `packages/analytics/src/catalog-billing.ts` gains an `AddonAnalyticsEventSchemas` map with
  closed enums and no `.strict()`.
- `catalog.ts` gains the seven keys (`addonCheckoutStarted` … `addonGrantedFree`) next to
  `:86-99`.
- `docs/analytics/event-catalog.md` gains seven rows with their real trigger locations.
- **Guard G20** (`scripts/check-analytics-catalog-emitters.ts`) needs a second predicate.
  - G20 is lexical, and the adapter's `switch` mentions every event, so G20 cannot see a fact
    kind that no domain code produces (§10, item 5).
  - The new predicate, in the same script: every `kind: '<FACT>'` literal declared in
    `billing-fact-sink.ts` and `addon-fact.ts` must appear in at least one production file other
    than the declaring files and `analytics-facts*.ts`.
  - A mutation test covers it.

## 6. PII rules

- `distinct_id` is the owner's user id. No other identity field is emitted.
- These are never emitted:
  - `declared_payer_email` (`subscription.dbschema.ts:78-84`);
  - the purchase `payerEmail` (`purchase.ts:68-75`);
  - the free-text preapproval `reason` (`purchase-addon-complement.ts:89`);
  - `order_request_id` and `provider_order_id`;
  - provider payment ids;
  - receipt payer data (`credit-payment.service.ts:169`).
- `target_id` (a listing or subscription id) is not emitted, by YAGNI: `scope_type` and
  `vertical` cover the slicing.
- For `addon_granted_free`, these are also never emitted:
  - the beneficiary's grant data;
  - `permanentGrantId`;
  - the anchor id;
  - the acting admin's id (`actorId`, `permanent-grant-s20.ts:275`).

  `actor_kind:'ADMIN'` is the only trace of the act.
- New property names must not match `FORBIDDEN_PROPERTY_KEY_REGEX`
  (`packages/analytics/src/shared.ts:8-9`). None of the §4 names does. AC-14 pins this.

## 7. Technical decisions taken here (not owner forks)

| # | Decision | Why |
|---|---|---|
| T-1 | `is_first_charge` of a COMPLEMENTO means "no credited payment on this COMPLEMENTO row yet". It is omitted for `UNA_VEZ` | It is the same ledger read as PRINCIPAL (`credit-payment.service.ts:120-126`). A re-purchase is a new row and counts as first again, like a new principal. A one-time add-on has exactly one charge |
| T-2 | `vertical` follows the rule of P-4' | Avoids inventing a vertical for a multi-vertical `USER`/`GLOBAL` product |
| T-3 | No `addon_cancel_scheduled` event | A complement is scheduled only as a consequence of its principal being scheduled, which `billing_cancel_scheduled` already records. The effective end carries `was_scheduled` |
| T-4 | No event for natural `FIXED_DAYS` expiry | It is fully determined by `addon_activated` plus the version's `validity_days`. It is not churn |
| T-5 | Add-on activation and ending are emitted through the two existing post-commit choke points, with **required** parameters. S20 and A1-bis also get required ports | HOS-1994 showed that optional wiring silently misses a path. With a required parameter, `tsc` fails at every call site |
| T-6 | `addon_granted_free` is built only after commit, outside `runS20InTransaction` | The same function runs inside the preview's dry-run (`permanent-grant-preview.ts:121`, `:246`) |
| T-7 | An S20 on a pending instance emits `addon_checkout_abandoned{CLOSED_BY_SYSTEM}`, not `addon_granted_free` | Nothing was paid. After S20 cancels the complement, `abandonRecurring` no longer writes (`expire-addon-authorization-windows.service.ts:69-75`), so without this event the funnel would have a start with no end |
| T-8 | `addon_charge_declined` has no `next_state` | For a COMPLEMENTO it would always be `UNCHANGED` (§1.2) |

## 8. Acceptance criteria

| # | Given / When / Then | Test type |
|---|---|---|
| AC-1 | **Given** a recurring product, **when** `POST` purchase returns `CREATED` with a checkout URL, **then** exactly one `addon_checkout_started` is captured, with `charge_kind:'PERIODICO'`, `subscription_id`, `cycle`, `amount_minor = addon_product.price` and `currency:'ARS'`. **When** the provider refuses the authorization, **then** nothing is captured | Integration (route + sink spy via `setAnalyticsFactSinkForTests`) |
| AC-2 | **Given** a one-time product, **when** purchase returns `CREATED`, **then** `addon_checkout_started` has `charge_kind:'UNA_VEZ'` and has neither `cycle` nor `subscription_id`. **When** the same `orderRequestId` is replayed (`EXISTING`), **then** nothing is captured | Integration (route) |
| AC-3 | **Given** a pending complement, **when** the webhook S2 dispatch runs `applyA2Recurring` and it returns `ACTIVATED`, **then** one `addon_activated` with `actor_kind:'SYSTEM'` is captured. **When** A3 activates it instead (the provider read is `active`), **then** the same single event is captured. **When** the result is `NOT_APPLICABLE`, **then** nothing is captured | Integration (service-core, both callers) |
| AC-4 | **Given** an approved one-time order, **when** `confirmOneTimeOrder` returns `ACTIVATED`, **then** `addon_activated` and `addon_charge_succeeded{payment_id}` are each captured once. **When** the order is confirmed a second time, **then** nothing is captured | Integration |
| AC-5 | **Given** a COMPLEMENTO with no credited payment, **when** its first charge is credited, **then** `addon_charge_succeeded{is_first_charge:true}` is captured, and the next credited renewal has `is_first_charge:false`. **When** the result is `ALREADY_CREDITED` or `NOT_PENDING`, or the credit is rolled back, **then** nothing is captured | Integration + rollback test |
| AC-6 | **Given** a rejected charge on a COMPLEMENTO, **when** `recordChargeFact` runs, **then** one `addon_charge_declined` is captured, the row keeps its state, and no `billing_charge_declined` or `billing_grace_entered` is captured | Integration |
| AC-7 | **Given** a pending add-on whose window expired, **when** the cron runs A3, **then** `addon_checkout_abandoned{reason:'WINDOW_EXPIRED'}` is captured once per abandoned row. **When** A3 skips a row (`wrote:false`), **then** nothing is captured | Integration (cron) |
| AC-8 | **Given** a declined one-time order, **when** A7 returns `ABANDONED`, **then** `addon_checkout_abandoned{reason:'ORDER_DECLINED'}` is captured | Integration (route) |
| AC-9 | **Given** an active recurring add-on, **when** its owner withdraws it, **then** `addon_cancelled{path:'OWNER_WITHDREW', actor_kind:'USER', was_scheduled:false}` is captured with no `reason` property. **When** the owner withdraws a pending add-on, **then** `addon_checkout_abandoned{reason:'OWNER_WITHDREW'}` is captured and no `addon_cancelled` is captured | Integration (route `billing-addon/withdrawal.ts`) |
| AC-10 | **Given** a principal cancelled by its owner, **when** S11 schedules its complement and S12 later ends both, **then** exactly one `addon_cancelled{path:'SERVICE_END', was_scheduled:true}` is captured, in phase 2 of `endScheduledServices` | Integration (cron) |
| AC-11 | **When** A5 cancels an active add-on because it is orphaned, because a grant was revoked, or because A6 purged its listing, **then** `addon_cancelled` has path `ORPHANED`, `GRANT_REVOKED` (with `actor_kind:'ADMIN'`) or `LISTING_PURGED` | Integration (3 paths) |
| AC-12 | **When** `expireAddonInstances` expires a one-time add-on, **then** no `addon_*` event is captured | Integration |
| AC-13 | **Given** any add-on fact, **when** the adapter runs, **then** no `billing_*` event is captured. A HOS-1878 kind with `subscriptionClass:'COMPLEMENTO'` is still dropped | Unit (adapter) |
| AC-14 | Every new schema rejects forbidden keys (`shared.ts:8-9`) and fits Umami limits: name ≤ 50 characters and no number ≥ 1e15 | Unit (`packages/analytics/test/`) |
| AC-15 | The same fact emitted twice yields the same `data.event_uuid` | Unit |
| AC-16 | **When** a sink throws, **then** the transition stays committed and only a log line is written | Unit (`emitBillingFact`) |
| AC-17 | **When** a fact kind has no producer outside its declaring files and the adapter, **then** the G20 producer predicate fails and names that kind. **When** a new catalog event has no row in `event-catalog.md`, **then** G20 also fails | Guard unit (mutation) + CI |
| AC-18 | **When** a call site of `emitAddonCoverageAdded` or `emitAddonCoverageRemoved`, or a caller of the S20 committing functions or of `chooseFreeAddon`, omits the new parameter or port, **then** `tsc` fails | Typecheck (CI) |
| AC-19 | **Given** a beneficiary with an active paid recurring add-on, **when** `grantPermanentGrant`, `anchorPermanentGrantVertical` or `resumePermanentGrant` commits an S20 with `includesAddons:true`, **then** exactly one `addon_granted_free{source:'S20_CONVERSION', actor_kind:'ADMIN', previous_amount_minor, previous_cycle, previous_subscription_id}` is captured per converted instance, and no `addon_cancelled` is captured. A later A5 on that now-free instance captures nothing | Integration (3 committing callers) |
| AC-20 | **Given** a pending recurring add-on, **when** S20 runs on it, **then** `addon_checkout_abandoned{reason:'CLOSED_BY_SYSTEM'}` is captured and no `addon_granted_free` is captured | Integration |
| AC-21 | **Given** the same fixtures as AC-19, **when** the grant preview runs its dry-run (`permanent-grant-preview.ts:121`, `:246`), **then** zero facts are captured | Integration (preview) |
| AC-22 | **Given** an owner with a live includes-addons anchor, **when** `chooseFreeAddon` returns `CREATED`, **then** exactly one `addon_granted_free{source:'FREE_CHOICE', actor_kind:'USER'}` is captured, with no money properties and no `subscription_id`, and no `addon_activated` is captured. **When** the result is `EXISTING` or `REFUSED`, **then** nothing is captured. The event is captured even when `coverageNotices` is absent | Integration (route `billing-addon/free-choice.ts`) |
| AC-23 | `addon_cancelled` accepts an extra optional `reason` key without failing validation, so its schema is not strict. Its payload today carries no `reason` | Unit (schema) |

## 9. Owner decisions (resolved 2026-11-18)

| # | Question | Decision | Date |
|---|---|---|---|
| O-1 | Reuse `billing_*` with `subscription_class:'COMPLEMENTO'`, use a dedicated `addon_*` family, or a hybrid? | **Dedicated `addon_*` family.** `billing_*` stays PRINCIPAL-only, pinned by a test (AC-13). Umami cannot split an event by property (`boards.ts:296-297`), so reusing the names would mix add-ons into the subscription goals and funnel. One-time add-ons have no subscription | 2026-11-18 |
| O-2 | Where does "MRR including add-ons" live? | **Outside this spec, in HOS-2354:** an admin page that computes it from the DB. Umami boards cannot sum amounts and do not deduplicate at ingestion | 2026-11-18 |
| O-3 | Emit pause and resume events for complements (S32/S33)? | **No.** This is consistent with principals. A pause is an effect of the principal's debt, and its money effect already shows as missing `addon_charge_succeeded` | 2026-11-18 |
| O-4 | Capture a closed-list withdrawal reason? | **A follow-up: HOS-2355.** `addon_cancelled` ships with no reason. HOS-2355 adds an optional `reason`, and this spec keeps the schema additive so it can (P-11, AC-23) | 2026-11-18 |
| O-5 | Do grant-driven free add-ons emit anything? | **A dedicated event, `addon_granted_free`.** It fires when S20 converts a paid complement to $0 and when an add-on is chosen free under a grant. It is never counted as `addon_cancelled`. The S20 dry-run inside the grant preview never emits | 2026-11-18 |

## 10. Findings about HOS-1878 (for its spec and follow-ups)

1. **The P-3 dedupe premise is obsolete.** It assumed PostHog `uuid` dedupe. On Umami the uuid is
   only `data.event_uuid` (`umami-payload.ts:280`, `:342-344`).
2. **D-4 "extend without migrating" holds only for the schema.**
   - The adapter drops non-PRINCIPAL facts (`analytics-facts.ts:262-275`).
   - No test pins this: `apps/api/test/utils/analytics/analytics-facts.test.ts` only uses
     `PRINCIPAL`.
   - Under Umami, reusing the names would also have mixed metrics (O-1).
3. **The §4 note "for COMPLEMENTO `is_first_charge` stays `false`" is wrong.** No fact is built at
   all for COMPLEMENTO (`credit-payment.service.ts:345-352`).
4. **Two principal transitions emit nothing.**
   - S13 (a permanent grant cancels paying principals, `grant/permanent-grant-s13.ts:134`) emits
     no `billing_subscription_cancelled`. No file under `billing/grant/` references
     `billingFacts`.
   - `mirrorOurCancellationOnActive` writes `CANCEL_SCHEDULED`
     (`notice/mirror-our-cancellation-on-active.ts:155`) without `billing_cancel_scheduled`. Its
     S12 later emits the effective cancellation.
5. **G20 is satisfied by the adapter alone.** The adapter's `switch` (`analytics-facts.ts:82-247`)
   mentions every event, so a fact kind with no producer passes. §5.5 adds a producer predicate.
6. **Stale references in the HOS-1878 spec.**
   - P-1 cites `apps/api/src/lib/posthog.ts:137`. The door is now `analytics-client.ts:169`.
   - `gastronomy` is now `venue` (`catalog-billing.ts:13`).
   - `path` gained `DIRECT_FROM_PAUSED` and `INHERITED_BY_PLAN` (`catalog-billing.ts:125-132`),
     which the spec does not list.
   - Trial dedupe keys are `user:vertical` (`analytics-facts.ts:216`, `:227`, `:240`), not
     `trial.id` as §4 of that spec says.

## 11. Out of scope

- MRR including add-ons (HOS-2354, O-2).
- A withdrawal reason on `addon_cancelled` (HOS-2355, O-4).
- Umami boards, goals and funnels for add-ons. They belong to HOS-2119's `scripts/umami/` and are
  added there once these events exist.
- Chargebacks and refunds of add-on payments.
- Fixing the HOS-1878 gaps of §10, item 4. They go to a separate issue under HOS-1352, unless the
  owner folds them in here.
- Backfill of add-on history. The DB is its source of truth.

## 12. Smoke

Labels: `status-needs-smoke-staging` and `status-needs-smoke-prod`, the same as HOS-1878. This
spec touches the webhook-driven credit path (`creditPayment`, `recordChargeFact`), a billing cron
(`subscription-window-expiry`), the add-on purchase and free-choice routes, and the permanent-grant
acts.

**Staging** (MP sandbox, Umami staging):

1. Buy a recurring add-on, for example `max_accommodations` monthly (product `9236170b…`,
   `0176_…sql:67`). Expect `addon_checkout_started`, `addon_activated` and
   `addon_charge_succeeded{is_first_charge:true}`.
2. Withdraw it. Expect `addon_cancelled{path:'OWNER_WITHDREW'}` with no `reason`.
3. Buy a one-time add-on. Expect `addon_checkout_started`, `addon_activated` and
   `addon_charge_succeeded`.
4. Buy a one-time add-on with a declined test card. Expect
   `addon_checkout_abandoned{reason:'ORDER_DECLINED'}`.
5. As SUPER_ADMIN, grant a Free Forever with `includesAddons:true` to an owner who has an active
   recurring add-on. Expect `addon_granted_free{source:'S20_CONVERSION'}` and no
   `addon_cancelled`. Before granting, open the grant preview and check that it produced no event.
6. As that owner, choose a free add-on. Expect `addon_granted_free{source:'FREE_CHOICE'}`.
7. Check that the `billing_*` counts did not move.

**Prod:** passive observation of the first real add-on purchase and renewal. This will likely
need `status-smoke-waits-external`, as HOS-1878 did.

## 13. Linear

- HOS-1883 is a child of HOS-1352. It is blocked by HOS-1878 and related to HOS-2066, HOS-2354 and
  HOS-2355.
- Owner, 2026-11-06: the work is done against `staging` first thing after the post-MVP epic
  merges. That merge happened (`96756adfc4`).
- Owner, 2026-11-17: implementation starts only once HOS-1352 has its staging smoke signed.
- Its label moves from `kind-needs-spec` to `kind-spec` when this document's PR opens.
