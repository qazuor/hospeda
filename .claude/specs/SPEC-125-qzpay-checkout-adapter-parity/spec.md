---
spec-id: SPEC-125
title: qzpay checkout adapter parity with Hospeda Phase 1 (Phase C)
type: feat
complexity: low
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 4-6
tags: [qzpay, mercadopago, checkout, preference, quality-fields]
parent: SPEC-122
phase: C
depends_on: []
priority: medium
target_repo: /home/qazuor/projects/PACKAGES/qzpay
first_allocated_via_engram_protocol: true
---

# SPEC-125: qzpay checkout adapter parity with Hospeda Phase 1 (Phase C)

## Context

Hospeda's `addon.checkout.ts` (apps/api) bypassed qzpay's checkout adapter and used the raw MercadoPago SDK directly. SPEC-109 Phase 1 (PR #1102) added the MP quality fields (payer, category_id, idempotency, statement_descriptor) to that direct path. To eliminate the direct SDK usage in Hospeda (handled in SPEC-127), qzpay's checkout adapter must offer the same quality.

This phase brings the qzpay `checkout.adapter.ts` to parity. Pure additive enhancement — no breaking changes. Can be bundled in the same PR as SPEC-123 to save a release cycle.

## Scope

### In

1. **Add `items[].category_id`** support to `qzpay-mercadopago/checkout.adapter.ts:20-83`. Accept it via input (e.g., `lineItems[i].categoryId`) with a sensible default of `'services'` (the MP code for digital SaaS).

2. **Add full `payer` fields**: `email` + `firstName` + `lastName`. Currently only `email` is set (`checkout.adapter.ts:64`). Mirror the logic from Hospeda Phase 1 (`addon.checkout.ts:extractPayerInfo`) — accept `customerName` and derive first/last from it, with email-local-part fallback. Or accept `payerFirstName`/`payerLastName` explicitly if the caller has them.

3. **Add `statement_descriptor`**: accept as input parameter. Validate format at adapter level (≤11 chars, ASCII uppercase) — throw if violates. Document this in the JSDoc.

4. **Add idempotency key support**: accept `idempotencyKey` as input parameter (caller-controlled, no autogeneration here). Forward via `requestOptions: { idempotencyKey }` to MP SDK.

5. **Update return type** to surface MP preference IDs and URLs cleanly.

### Out

- Direct migration of Hospeda's `addon.checkout.ts` to use this adapter (handled in SPEC-127, which depends on this).
- Subscription preapproval support (handled in SPEC-124).
- Foundation fixes (handled in SPEC-123).

## Implementation details

**File**: `packages/mercadopago/src/adapters/checkout.adapter.ts`

Updated `create()` signature accepts:

```typescript
interface QZPayCreateCheckoutInput {
    mode: 'payment' | 'subscription';
    customerId?: string;
    customerEmail?: string;
    /** New in SPEC-125 */
    customerName?: string;
    /** New in SPEC-125 — overrides splitting customerName */
    payerFirstName?: string;
    payerLastName?: string;

    lineItems?: Array<{
        description?: string;
        quantity?: number;
        /** New in SPEC-125 — defaults to 'services' if unset */
        categoryId?: string;
    }>;

    successUrl: string;
    cancelUrl: string;
    notificationUrl?: string;
    expiresInMinutes?: number;

    /** New in SPEC-125 — caller-controlled idempotency */
    idempotencyKey?: string;

    /** New in SPEC-125 — MP-side label on cardholder bank statement (≤11 ASCII upper) */
    statementDescriptor?: string;

    metadata?: Record<string, unknown>;
}
```

Body construction:

```typescript
const payer = buildPayer({ customerEmail, customerName, payerFirstName, payerLastName });

const body: Parameters<Preference['create']>[0]['body'] = {
    items: enrichedItems,  // each item has category_id
    payer,
    back_urls: { success: successUrl, failure: cancelUrl, pending: successUrl },
    auto_return: 'approved',
    metadata,
    ...(notificationUrl && { notification_url: notificationUrl }),
    ...(input.customerId && { external_reference: input.customerId }),
    ...(input.expiresInMinutes !== undefined && {
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString()
    }),
    ...(input.statementDescriptor && { statement_descriptor: validateDescriptor(input.statementDescriptor) })
};

const response = await this.preferenceApi.create({
    body,
    ...(input.idempotencyKey && { requestOptions: { idempotencyKey: input.idempotencyKey } })
});
```

Helper `buildPayer` mirrors Hospeda's logic:
```typescript
function buildPayer({ customerEmail, customerName, payerFirstName, payerLastName }: ...) {
    if (payerFirstName && payerLastName) {
        return { email: customerEmail, first_name: payerFirstName, last_name: payerLastName };
    }
    if (customerName) {
        const trimmed = customerName.trim();
        const firstSpace = trimmed.indexOf(' ');
        if (firstSpace === -1) {
            return { email: customerEmail, first_name: trimmed, last_name: ' ' };
        }
        return {
            email: customerEmail,
            first_name: trimmed.slice(0, firstSpace),
            last_name: trimmed.slice(firstSpace + 1).trim() || ' '
        };
    }
    if (customerEmail) {
        const localPart = customerEmail.split('@')[0] || customerEmail;
        return { email: customerEmail, first_name: localPart, last_name: ' ' };
    }
    return undefined; // no payer info available
}
```

Helper `validateDescriptor`:
```typescript
function validateDescriptor(value: string): string {
    if (!/^[A-Z0-9 ]{1,11}$/.test(value)) {
        throw new Error(`Invalid statement_descriptor "${value}". Must be 1-11 ASCII uppercase / digits / spaces.`);
    }
    return value;
}
```

Backwards compatibility: every new field is optional. Callers passing only the existing fields see no behavior change except that `category_id` defaults to `'services'` if `lineItems[].categoryId` is unset — which is the right default and matches MP's recommendation for SaaS.

## Tests required

1. `buildPayer` unit tests: same coverage as Hospeda Phase 1 — name with space, multi-space name, single-word name, missing name (email fallback), missing email entirely.
2. `validateDescriptor`: rejects lowercase, >11 chars, empty, non-ASCII; accepts valid examples.
3. Adapter `create()` happy path: assert body sent to MP includes payer, category_id, statement_descriptor, idempotency.
4. Adapter `create()` with no statement_descriptor: assert it's omitted (not sent as empty/null).
5. Regression: existing call patterns (no new fields) still work and produce a valid preference.

## Acceptance criteria

- [ ] All 5 input fields above implemented with defaults preserving backwards compat
- [ ] `buildPayer` and `validateDescriptor` helpers extracted with JSDoc
- [ ] Unit tests covering all paths
- [ ] `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` green
- [ ] Changeset added (`minor` bump: new optional API surface)
- [ ] PR merged + published to npm (bundled with SPEC-123)
- [ ] SPEC-127 can consume the new fields once published

## Engram references

- `spec/spec-122/master-plan-decisions` — Decision 8 (migrate addon.checkout to qzpay)
- `spec/spec-109/state` — Phase 1 patterns we're replicating here
