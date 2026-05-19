---
spec-id: SPEC-127
title: Migrate addon.checkout.ts to qzpay path (Phase E)
type: refactor
complexity: low
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 3-5
tags: [hospeda, addons, refactor, qzpay-migration]
parent: SPEC-122
phase: E
depends_on: [SPEC-125]
priority: low
target_repo: /home/qazuor/projects/WEBS/hospeda
first_allocated_via_engram_protocol: true
---

# SPEC-127: Migrate addon.checkout.ts to qzpay path (Phase E)

## Context

Hospeda's `apps/api/src/services/addon.checkout.ts` currently uses the raw `mercadopago` SDK directly (function `createMercadoPagoPreference` on lines 51-89 of the post-SPEC-109 version). The TODO comment on line 39 of that file explicitly states this is a temporary workaround until the qzpay checkout adapter supports preferences.

SPEC-125 brings the qzpay checkout adapter to feature parity with the direct path (payer fields, category_id, idempotency, statement_descriptor). This spec migrates `addon.checkout.ts` to use `billing.checkout.create()` and removes the direct `mercadopago` package import.

## Scope

### In

1. **Refactor `addon.checkout.ts`**:
   - Replace the inline `createMercadoPagoPreference` helper with a call to `billing.checkout.create()`.
   - Map the SPEC-109 Phase 1 fields (payer info, category_id, idempotency, statement_descriptor) to the new input shape from SPEC-125.
   - Remove the helper functions `extractPayerInfo` and the `MP_ITEM_CATEGORY_ID` constant — they live in qzpay now (or pass them as input).

2. **Remove the direct `mercadopago` import** from `addon.checkout.ts`. If no other file in `apps/api` uses it, also remove `mercadopago` from `apps/api/package.json` dependencies.

3. **Update tests**: the existing `addon.checkout.test.ts` mocks the `mercadopago` SDK directly. After migration, mocks should target `billing.checkout.create` instead. The behavior assertions (payer fields, category_id, idempotency key, statement_descriptor) remain the same — they just look up the SDK call indirectly.

4. **Validate no regression**: all 32 existing tests in `addon.checkout.test.ts` (post-Phase 1) should still pass, just with new mock targets.

### Out

- Changes to the qzpay checkout adapter itself (handled in SPEC-125).
- Changes to the addon model, entitlement application, or any business logic in `confirmAddonPurchase` — only the checkout creation path is touched.
- Changes to the subscription flow (handled in SPEC-126).

## Implementation details

### Before (post-SPEC-109 Phase 1)

```typescript
import { MercadoPagoConfig, Preference } from 'mercadopago';

async function createMercadoPagoPreference({ accessToken, preferenceData, idempotencyKey }) {
    const mpClient = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(mpClient);
    return preferenceClient.create({
        ...preferenceData,
        requestOptions: { ...preferenceData.requestOptions, idempotencyKey }
    });
}

export async function createAddonCheckout(billing, input) {
    // ... validation, customer fetch ...

    const payer = extractPayerInfo(customer);
    const checkoutUuid = randomUUID();
    const orderId = `addon_${addon.slug}_${checkoutUuid}`;

    const preference = await createMercadoPagoPreference({
        accessToken: mpAccessToken,
        idempotencyKey: checkoutUuid,
        preferenceData: {
            body: {
                items: [{ id: addon.slug, title: addon.name, ..., category_id: MP_ITEM_CATEGORY_ID }],
                payer,
                metadata: { ... },
                external_reference: orderId,
                back_urls: { ... },
                auto_return: 'approved',
                notification_url: `${apiUrl}/api/v1/webhooks/mercadopago`,
                statement_descriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR,
                expires: true,
                expiration_date_from: ...,
                expiration_date_to: ...
            }
        }
    });
}
```

### After (SPEC-127)

```typescript
// No direct mercadopago import. billing.checkout.create() returns the preference data.

export async function createAddonCheckout(billing, input) {
    // ... validation, customer fetch ...

    const checkoutUuid = randomUUID();
    const orderId = `addon_${addon.slug}_${checkoutUuid}`;

    const result = await billing.checkout.create({
        mode: 'payment',
        customerId: input.customerId,
        customerEmail: customer.email,
        customerName: customer.metadata?.name as string | undefined,
        lineItems: [{
            description: addon.name,
            quantity: 1,
            categoryId: 'services'
        }],
        unitPrice: finalPrice / 100, // centavos → ARS
        currency: 'ARS',
        successUrl: `${webUrl}/mi-cuenta/addons?status=success&addon=${addon.slug}`,
        cancelUrl: `${webUrl}/mi-cuenta/addons?status=failure&addon=${addon.slug}`,
        notificationUrl: `${apiUrl}/api/v1/webhooks/mercadopago`,
        externalReference: orderId,
        idempotencyKey: checkoutUuid,
        statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR,
        expiresInMinutes: 30,
        metadata: { addonSlug: addon.slug, addon_slug: addon.slug, customer_id: input.customerId, ... }
    });

    if (!result.checkoutUrl) {
        return { success: false, error: { code: 'CHECKOUT_ERROR', message: 'Failed to get checkout URL' } };
    }

    return {
        success: true,
        data: {
            checkoutUrl: result.checkoutUrl,
            orderId,
            addonId: addon.slug,
            amount: finalPrice,
            currency: 'ARS',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
    };
}
```

### Tests migration

`apps/api/test/services/addon.checkout.test.ts`:
- Remove `vi.mock('mercadopago', ...)` — no longer needed.
- Remove `mockPreferenceCreate` and direct SDK assertions.
- Replace with mock of `billing.checkout.create` on the qzpay billing instance fixture.
- Assertions become: "the billing.checkout.create call had `payer.first_name = 'Juan'`", same conceptually but on different mock target.

All 32 existing tests should map 1:1 to the new mock structure.

## Acceptance criteria

- [ ] `addon.checkout.ts` no longer imports from `mercadopago` package
- [ ] `addon.checkout.ts` uses `billing.checkout.create()` for preference creation
- [ ] `mercadopago` removed from `apps/api/package.json` if no other file imports it (verify with grep)
- [ ] All 32 existing tests in `addon.checkout.test.ts` pass with the new mocks
- [ ] All quality fields (payer, category_id, idempotency, statement_descriptor) verified to flow through correctly
- [ ] `pnpm typecheck` clean, `pnpm lint` clean
- [ ] qzpay dep includes SPEC-125 version
- [ ] PR merged to staging

## Engram references

- `spec/spec-122/master-plan-decisions` — Decision 8 (migrate addon.checkout to qzpay)
- `spec/spec-109/state` — Phase 1 work being migrated
