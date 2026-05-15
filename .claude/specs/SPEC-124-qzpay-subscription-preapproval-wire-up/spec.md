---
spec-id: SPEC-124
title: qzpay subscription preapproval wire-up (Phase B)
type: feat
complexity: high
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 16-24
tags: [qzpay, mercadopago, subscriptions, preapproval, recurring, billing]
parent: SPEC-122
phase: B
depends_on: [SPEC-123]
priority: high
target_repo: /home/qazuor/projects/PACKAGES/qzpay
first_allocated_via_engram_protocol: true
---

# SPEC-124: qzpay subscription preapproval wire-up (Phase B)

## Context

Today `billing.subscriptions.create()` in qzpay-core only persists a subscription record to storage. It never calls the payment adapter to create a real preapproval in MercadoPago. The qzpay-mercadopago `subscription.adapter.ts` has `create()`/`update()` methods but they are dead code — no caller reaches them.

This spec wires the subscription adapter into the core, expands its capabilities to cover all the MP preapproval quality fields (payer info, idempotency, free_trial, etc.), and adds the writeback path so consumers (Hospeda) can link MP-generated `mp_subscription_id` to their local subscription via a webhook handler.

This is the meat of SPEC-122. It enables recurring monthly subscriptions to actually be created in MercadoPago.

## Scope

### In

1. **Enhanced `qzpay-mercadopago/subscription.adapter.ts:create()`**: accept all the MP preapproval quality fields and return enough data for the consumer to redirect the user to MP's hosted page.

2. **`qzpay-mercadopago/subscription.adapter.ts:update()`**: support changing `transaction_amount` and `auto_recurring` config for plan changes.

3. **Wire `paymentAdapter.subscriptions.create()` into `qzpay-core/billing.ts`**: when an opt-in `mode: 'paid'` is passed AND a payment adapter is configured, invoke the adapter after persisting the local record. Default `mode: 'trial'` keeps the current storage-only behavior.

4. **New `billing.subscriptions.linkProviderId()` method in qzpay-core**: for webhook handlers to write back the `mp_subscription_id` to the local subscription after MP confirms the preapproval was created.

5. **Drizzle mappers writeback support**: `mapCoreSubscriptionCreateToDrizzle` and `mapCoreSubscriptionUpdateToDrizzle` accept and persist `mpSubscriptionId`.

6. **Type extensions in qzpay-core**: `QZPayCreateSubscriptionInput` gets new optional fields (`mode`, `billingInterval`, `intervalCount`, `paymentMethodReturnUrl`, `promoCodeId`, `freeTrialDays`).

### Out

- Foundation fixes (handled in SPEC-123).
- Checkout adapter improvements (handled in SPEC-125).
- Hospeda routes and webhook handlers (handled in SPEC-126).
- Trial → paid conversion logic in Hospeda (handled in SPEC-126).
- One-time payments via preference (not preapproval) — those go through the checkout adapter, not this one.

## Implementation details

### Task B1 — Rewrite `subscription.adapter.ts:create()`

**File**: `packages/mercadopago/src/adapters/subscription.adapter.ts`

Target signature:
```typescript
interface CreatePreapprovalInput {
    readonly payerEmail: string;
    readonly payerFirstName: string;
    readonly payerLastName: string;
    readonly externalReference: string; // local subscription ID (UUID)
    readonly transactionAmount: number; // in major currency unit (ARS), not cents
    readonly currency: string; // 'ARS'
    readonly intervalFrequency: number; // e.g. 1
    readonly intervalType: 'days' | 'months'; // monthly = months/1
    readonly reason: string; // user-facing description, shown in MP dashboard + bank statement
    readonly backUrl: string;
    readonly notificationUrl: string;
    readonly idempotencyKey: string;
    readonly freeTrialDays?: number; // optional, for promo: extra free days before first charge
    readonly cardTokenId?: string; // optional, if pre-tokenized (uncommon for ad-hoc)
}

interface CreatePreapprovalResult {
    readonly providerSubscriptionId: string; // MP preapproval ID
    readonly initPoint: string; // MP-hosted URL for user to authorize
    readonly sandboxInitPoint: string;
    readonly status: string; // 'pending' typically until user authorizes
}
```

Implementation calls `preapprovalApi.create()` with body:
```typescript
{
    payer_email: payerEmail,
    payer: { email: payerEmail, first_name: payerFirstName, last_name: payerLastName },
    external_reference: externalReference,
    reason,
    back_url: backUrl,
    notification_url: notificationUrl,
    auto_recurring: {
        frequency: intervalFrequency,
        frequency_type: intervalType,
        transaction_amount: transactionAmount,
        currency_id: currency,
        ...(freeTrialDays ? {
            free_trial: { frequency: freeTrialDays, frequency_type: 'days' }
        } : {})
    },
    ...(cardTokenId ? { card_token_id: cardTokenId } : {})
}
```

with `requestOptions: { idempotencyKey }`.

Response mapping returns `{ providerSubscriptionId, initPoint, sandboxInitPoint, status }`.

### Task B2 — `subscription.adapter.ts:update()`

Support changing `transaction_amount` (for plan change scenarios). Body:
```typescript
{
    auto_recurring: {
        transaction_amount: newAmount
    }
}
```

Also support pause/resume/cancel via status changes (mostly already there, just polish).

### Task B3 — Wire adapter into `billing.ts:subscriptions.create()`

**File**: `packages/core/src/billing.ts` (around line 1090)

Updated logic:
```typescript
create: async (input) => {
    const createInput = buildCreateInput(input);
    const subscription = await storage.subscriptions.create(createInput);

    // NEW: when mode === 'paid' and payment adapter present, also create in provider
    if (input.mode === 'paid' && this.paymentAdapter?.subscriptions) {
        const customer = await storage.customers.findById(input.customerId);
        if (!customer) throw new QZPayNotFoundError('Customer', input.customerId);

        const plan = planMap.get(input.planId);
        const price = plan?.prices.find((p) => p.id === input.priceId) ?? plan?.prices[0];
        if (!price) throw new QZPayNotFoundError('Price', input.priceId ?? `default for ${input.planId}`);

        try {
            const providerResult = await this.paymentAdapter.subscriptions.create({
                payerEmail: customer.email,
                payerFirstName: customer.firstName ?? deriveFromEmail(customer.email),
                payerLastName: customer.lastName ?? ' ',
                externalReference: subscription.id,
                transactionAmount: price.amount / 100, // centavos → ARS
                currency: price.currency,
                intervalFrequency: price.intervalCount ?? 1,
                intervalType: price.interval === 'month' ? 'months' : 'days',
                reason: `${plan?.name ?? input.planId} - ${input.billingInterval ?? 'Mensual'}`,
                backUrl: input.paymentMethodReturnUrl ?? '',
                notificationUrl: input.notificationUrl ?? '',
                idempotencyKey: subscription.id, // local sub ID doubles as idempotency key
                freeTrialDays: input.freeTrialDays
            });

            // Return enriched subscription with provider info for the caller to redirect
            return wrapWithHelpers({
                ...subscription,
                providerInitPoint: providerResult.initPoint,
                providerSubscriptionId: providerResult.providerSubscriptionId
            });
        } catch (error) {
            // Decide based on providerSyncErrorStrategy
            if (this.providerSyncErrorStrategy === 'throw') {
                // Roll back the local sub
                await storage.subscriptions.delete(subscription.id);
                throw error;
            }
            // 'log' strategy: keep local sub in pending_provider state, return as-is
            logger.warn('Failed to create provider preapproval', { error: error.message, subscriptionId: subscription.id });
        }
    }

    await emitter.emit('subscription.created', subscription);
    return wrapWithHelpers(subscription);
}
```

Key design decisions:
- `mode: 'paid'` is an opt-in. Default is `undefined` (interpreted as trial-style storage-only, preserving backwards compat).
- Idempotency key = local subscription UUID. Stable across retries by construction.
- `external_reference` = local subscription UUID. Webhooks can find the local sub by this.
- The return type extends with `providerInitPoint` and `providerSubscriptionId` for the caller's convenience.

### Task B4 — `billing.subscriptions.linkProviderId()` method

**File**: `packages/core/src/billing.ts`

```typescript
linkProviderId: async ({ localSubscriptionId, provider, providerSubscriptionId }) => {
    const subscription = await storage.subscriptions.update(localSubscriptionId, {
        providerSubscriptionIds: { [provider]: providerSubscriptionId }
    });
    await emitter.emit('subscription.linked', subscription);
    return wrapWithHelpers(subscription);
}
```

This is what Hospeda's webhook handler (SPEC-126) will call when `subscription_preapproval.created` arrives.

### Task B5 — Drizzle mapper updates

**File**: `packages/drizzle/src/mappers/subscription.mapper.ts`

`mapCoreSubscriptionCreateToDrizzle`: accept `providerSubscriptionIds` from input and split into `stripeSubscriptionId` / `mpSubscriptionId` for the DB.

`mapCoreSubscriptionUpdateToDrizzle`: include `providerSubscriptionIds` in the update params. When `providerSubscriptionIds.mercadopago` is present → set `mpSubscriptionId`. Similar for Stripe.

### Task B6 — Type extensions

**File**: `packages/core/src/types/subscription.types.ts`

Extend `QZPayCreateSubscriptionInput`:
```typescript
interface QZPayCreateSubscriptionInput {
    customerId: string;
    planId: string;
    priceId?: string;
    quantity?: number;
    trialDays?: number;
    metadata?: QZPayMetadata;
    /** New in SPEC-124: 'trial' (default, storage-only) or 'paid' (invokes provider adapter) */
    mode?: 'trial' | 'paid';
    /** New in SPEC-124: billing interval, used by provider adapter */
    billingInterval?: 'monthly' | 'annual'; // for label/reason; provider config comes from price
    /** New in SPEC-124: where MP redirects the user back after authorizing */
    paymentMethodReturnUrl?: string;
    /** New in SPEC-124: where MP sends webhooks for this specific preapproval */
    notificationUrl?: string;
    /** New in SPEC-124: extra free trial days from promo (additive to existing trial logic) */
    freeTrialDays?: number;
    /** New in SPEC-124: promo code being applied */
    promoCodeId?: string;
}
```

Add new return type info via helpers (since we're extending the subscription helper wrapper, not the base type).

## Tests required

1. **Unit tests for adapter `create()`**: with various combinations of input (with/without freeTrialDays, with/without cardTokenId), assert the body sent to MP has the right shape.
2. **Unit tests for adapter `update()`**: amount change scenario, status change scenario.
3. **Unit tests for `billing.subscriptions.create({ mode: 'paid' })`**: 
   - Happy path: storage created + adapter called + return value enriched
   - Adapter failure with `providerSyncErrorStrategy: 'throw'` → local sub rolled back
   - Adapter failure with `providerSyncErrorStrategy: 'log'` → local sub remains, error logged
   - `mode: 'trial'` (default) → adapter NOT called (regression guard)
4. **Unit tests for `linkProviderId()`**: writes mpSubscriptionId correctly, emits event.
5. **Integration tests against real Postgres**: drizzle mapper writes mp_subscription_id when input has it.
6. **Idempotency test**: two concurrent `subscriptions.create({ mode: 'paid', customerId: 'X', planId: 'Y' })` with the same input should result in only ONE preapproval (idempotency key = local sub ID prevents duplicate at MP level; first-writer-wins at our DB level).

## Acceptance criteria

- [ ] `subscription.adapter.ts:create()` accepts all 11 input fields listed above
- [ ] `subscription.adapter.ts:update()` supports `transaction_amount` updates
- [ ] `billing.subscriptions.create({ mode: 'paid' })` invokes the adapter and persists the link
- [ ] `billing.subscriptions.linkProviderId()` exposed as a public API
- [ ] Drizzle mappers handle `mpSubscriptionId` on both create + update
- [ ] All new code has JSDoc + named exports + RO-RO style
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all green
- [ ] Changeset added (likely `minor` bump since this adds new API surface but preserves backwards compat for trial-only consumers)
- [ ] PR merged to qzpay `main`
- [ ] New version published to npm
- [ ] Hospeda can `pnpm update @qazuor/qzpay-core @qazuor/qzpay-mercadopago` and consume the new APIs (validated via SPEC-126)

## Notes for execution

- Single large PR. Break commits internally by task (B1, B2, B3, B4, B5, B6) for review clarity.
- Branch in qzpay: `feat/spec-124-subscription-preapproval-wire-up`.
- This is THE high-risk PR of the master plan. Allocate extra review time.
- Backwards-compat preservation is paramount — anyone consuming `billing.subscriptions.create()` today (without `mode`) must see zero behavior change.

## Engram references

- `spec/spec-122/master-plan-decisions` — Decisions 1, 5, Sub-3 (preapproval, plan changes, proration)
- `spec/spec-122/audit-summary` — root cause of why this work is needed
- `spec/spec-109/state` — bridge spec that ships Phase 1 hardening separately
