---
spec-id: SPEC-123
title: qzpay foundation fixes (Phase A)
type: fix
complexity: medium
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 8-12
tags: [qzpay, mercadopago, idempotency, webhook, promo-codes, foundation]
parent: SPEC-122
phase: A
depends_on: []
priority: high
target_repo: /home/qazuor/projects/PACKAGES/qzpay
first_allocated_via_engram_protocol: true
---

# SPEC-123: qzpay foundation fixes (Phase A)

## Context

Five isolated bug fixes and hardening tasks in the qzpay library. Discovered during the 2026-05-15 audit (see engram `spec/spec-122/audit-summary`). All changes are non-breaking and can ship together as a single patch/minor release to npm.

Bundled into one PR to qzpay along with SPEC-125 (checkout adapter parity) because both are safe and additive — saves a release cycle and reduces consumer bump friction.

## Scope

### In

1. **Fix idempotency key regenerated on retry** in `qzpay-mercadopago/payment.adapter.ts:110`. The key is currently generated INSIDE the `withRetry()` callback, so each retry uses a new key. If the first attempt times out after MP processed the payment, the retry charges again. Move the key generation OUTSIDE the retry loop so all retries reuse the same key.

2. **Fix webhook signature fail-open** in `qzpay-mercadopago/webhook.adapter.ts:88-91`. Add a `failClosed: boolean` config option (default `false` for backwards compatibility). When `true` and `webhookSecret` is unset → throw an `Error` instead of returning `true`.

3. **Drop stale `TEST-` prefix check** in `qzpay-mercadopago/mercadopago.adapter.ts:32-33`. Current MercadoPago never issues access tokens with a `TEST-` prefix (both sandbox and prod use `APP_USR-` — see engram gotcha_mercadopago_credentials). Remove the dead branch in the validator.

4. **Atomic promo code redemption** in `qzpay-core` + `qzpay-drizzle`. Currently the validate (READ) and `incrementRedemptions` (WRITE) are not atomic. Two concurrent redeems near `max_redemptions` can both pass validation. Implement an atomic compare-and-swap in the drizzle repository: `UPDATE promo_codes SET redemptions = redemptions + 1 WHERE id = ? AND redemptions < max_redemptions RETURNING *`. If 0 rows affected → throw `PromoCodeLimitReachedError`.

5. **`isSandbox()` detection fix** in `qzpay-mercadopago/mercadopago.adapter.ts:81`. Current logic uses `accessToken.includes('TEST')` which is always `false` for current MP tokens. Replace with an explicit `sandbox: boolean` field in `QZPayMercadoPagoConfig`, defaulting to `false`. Document that callers should set this explicitly based on their own env detection.

### Out

- Subscription preapproval wiring (SPEC-124).
- Checkout adapter quality fields (SPEC-125).
- Any Hospeda-side changes (handled in SPEC-126 / SPEC-127).
- Marketplace / split payment cleanup (deferred; dead code stays for now, removed in SPEC-128 if confirmed unused).

## Implementation details

### Task A1 — Idempotency key outside retry loop

**File**: `packages/mercadopago/src/adapters/payment.adapter.ts`

Current (line ~110, inside `create()` method):
```typescript
return withRetry(
    async () => {
        // ... build body ...
        const idempotencyKey = `qzpay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const response = await this.paymentApi.create({
            body,
            requestOptions: { idempotencyKey }
        });
        // ...
    },
    this.retryConfig,
    'Create payment'
);
```

Target:
```typescript
async create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment> {
    // Generate idempotency key ONCE per logical create call so retries hit the same key.
    // MP treats the same idempotencyKey within a dedup window as the same operation
    // and returns the same payment instead of creating a new one.
    const idempotencyKey = input.idempotencyKey ?? `qzpay_${randomUUID()}`;

    return withRetry(
        async () => {
            // ... build body ...
            const response = await this.paymentApi.create({
                body,
                requestOptions: { idempotencyKey }
            });
            // ...
        },
        this.retryConfig,
        'Create payment'
    );
}
```

- Accept `idempotencyKey` as an optional input field (consumers like Hospeda can pass their own UUID for traceability).
- Use `randomUUID()` from `node:crypto` instead of timestamp + Math.random for proper UUID format.
- Update `QZPayCreatePaymentInput` type in qzpay-core to include the optional `idempotencyKey` field.

### Task A2 — Webhook signature fail-closed (config-aware)

**File**: `packages/mercadopago/src/adapters/webhook.adapter.ts`

Add to `QZPayMercadoPagoWebhookConfig`:
```typescript
export interface QZPayMercadoPagoWebhookConfig {
    webhookSecret?: string;
    timestampToleranceSeconds?: number;
    /**
     * When true, `verifySignature()` THROWS if `webhookSecret` is not set.
     * When false (default, for backwards compat), it returns true (pass-through with a warning).
     * Set to true in production environments.
     */
    failClosedWhenSecretMissing?: boolean;
}
```

Update `verifySignature()`:
```typescript
verifySignature(payload: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) {
        if (this.failClosedWhenSecretMissing) {
            throw new Error('QZPay webhook secret is not configured — refusing to accept unverified webhook');
        }
        // Backwards-compatible warning path (logged once at startup ideally)
        return true;
    }
    // ... existing HMAC verification logic
}
```

Also update the `QZPayMercadoPagoConfig` (top-level adapter config) to pass `failClosedWhenSecretMissing` through to the webhook adapter constructor.

### Task A3 — Drop stale TEST- prefix

**File**: `packages/mercadopago/src/mercadopago.adapter.ts`

Current (lines 32-33):
```typescript
if (!config.accessToken.startsWith('APP_USR-') && !config.accessToken.startsWith('TEST-')) {
    throw new Error("Invalid MercadoPago access token format. Expected token starting with 'APP_USR-' or 'TEST-'");
}
```

Target:
```typescript
if (!config.accessToken.startsWith('APP_USR-')) {
    throw new Error("Invalid MercadoPago access token format. Expected token starting with 'APP_USR-' (current MercadoPago format for both sandbox and production).");
}
```

Update the JSDoc on `QZPayMercadoPagoConfig.accessToken` (types.ts) to reflect that `TEST-` is not a valid prefix in current MP.

### Task A4 — Atomic promo code redemption

**Files**:
- `packages/drizzle/src/repositories/promo-codes.repository.ts`
- `packages/core/src/billing.ts` (around line 1569-1573)
- `packages/core/src/errors/index.ts` (new error type)

New error:
```typescript
export class QZPayPromoCodeLimitReachedError extends Error {
    constructor(public readonly promoCodeId: string, public readonly currentRedemptions: number, public readonly maxRedemptions: number) {
        super(`Promo code ${promoCodeId} has reached its redemption limit (${currentRedemptions}/${maxRedemptions})`);
        this.name = 'QZPayPromoCodeLimitReachedError';
    }
}
```

New repository method:
```typescript
async atomicIncrement(promoCodeId: string): Promise<QZPayPromoCode> {
    const result = await this.db
        .update(billingPromoCodes)
        .set({ currentRedemptions: sql`${billingPromoCodes.currentRedemptions} + 1` })
        .where(
            and(
                eq(billingPromoCodes.id, promoCodeId),
                or(
                    isNull(billingPromoCodes.maxRedemptions),
                    lt(billingPromoCodes.currentRedemptions, billingPromoCodes.maxRedemptions)
                )
            )
        )
        .returning();

    if (result.length === 0) {
        const current = await this.findById(promoCodeId);
        throw new QZPayPromoCodeLimitReachedError(
            promoCodeId,
            current?.currentRedemptions ?? 0,
            current?.maxRedemptions ?? 0
        );
    }

    return mapDrizzleToQZPay(result[0]);
}
```

Core `billing.ts` replaces the existing non-atomic increment with this method.

### Task A5 — Sandbox detection via explicit config

**Files**:
- `packages/mercadopago/src/types.ts`
- `packages/mercadopago/src/mercadopago.adapter.ts`

Add `sandbox: boolean` to `QZPayMercadoPagoConfig` (default `false`). Replace `this.isSandbox(accessToken)` in the constructor with `config.sandbox ?? false`. Document that callers set this from their own environment detection.

## Tests required

1. **A1**: Mock `payment.adapter.ts:create()` with a retry-triggering error sequence. Assert that all retry attempts called MP with the SAME idempotencyKey.
2. **A2**: Mock webhook.adapter with `failClosedWhenSecretMissing: true` and no secret → expect throw. With `false` (default) → expect `true` returned.
3. **A3**: Token validation tests: `APP_USR-foo` passes, `TEST-foo` rejects, `bad-prefix` rejects.
4. **A4**: Integration test (against real Postgres) with two concurrent `Promise.all([atomicIncrement(id), atomicIncrement(id)])` where the promo has `maxRedemptions: 1, currentRedemptions: 0`. One promise should resolve, the other should throw `QZPayPromoCodeLimitReachedError`.
5. **A5**: Constructor tests with `sandbox: true` and `sandbox: false`; verify the checkout adapter receives the right value.

## Acceptance criteria

- [ ] All 5 fixes implemented with named exports + JSDoc + RO-RO style
- [ ] All 5 tasks have unit (and integration where applicable) tests passing
- [ ] `pnpm typecheck` clean on all touched packages
- [ ] `pnpm lint` clean (biome)
- [ ] `pnpm test` green
- [ ] Changeset file added under `.changeset/` describing the changes (most likely a `patch` for bug fixes + a `minor` for new config fields like `failClosedWhenSecretMissing` and `sandbox`)
- [ ] PR merged to qzpay `main`
- [ ] New version published to npm via the changesets release workflow
- [ ] No breaking changes to existing consumers (defaults preserve old behavior)

## Notes for execution

- Branch name in qzpay: `feat/spec-123-foundation-fixes` (or whatever the operator prefers).
- Will be bundled with SPEC-125 in a single PR for efficiency.
- All commits use conventional commits: `fix(mp): ...`, `feat(core): ...`, etc.
- Changeset entries should be separate per concern: one `fix` for A1+A3, one `feat` for A2+A5 (new config), one `fix` for A4 (race condition).

## Engram references

- `spec/spec-122/audit-summary` — root cause analysis for each fix
- `spec/spec-122/master-plan-decisions` — Decision 7 (qzpay split) + Decision Sub-2 (race condition fix)
- `gotcha_mercadopago_credentials` — APP_USR- vs TEST- prefix history
