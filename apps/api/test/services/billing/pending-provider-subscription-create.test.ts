/**
 * HOS-191 Path C — pending-provider-subscription-create.ts unit tests.
 *
 * Proves `createPendingProviderSubscription`:
 *  - inserts a `status='pending_provider'` row with NO mp_subscription_id and
 *    no promo_code_id, mapping `billingInterval` to the qzpay storage shape
 *    (`'monthly' -> 'month'`, `'annual' -> 'year'`).
 *  - stamps `product_domain` (default `'accommodation'`, override respected)
 *    via a typed UPDATE, mirroring `createCompSubscription`'s two-step stamp.
 *  - NEVER writes a trial window: `trialStart`/`trialEnd` are always NULL and
 *    no `trialGranted` metadata key is stamped (HOS-1012). A checkout is the
 *    paid path and nothing else; the local trial row is opened at the owner's
 *    first publish instead.
 *  - inserts the `billing_pending_checkouts` correlation row, INSIDE the same
 *    transaction, carrying `mpPreapprovalPlanId` / `payerEmail` /
 *    `pendingDiscount` (when supplied) / a 32-hex-char `nonce`.
 *  - returns `{ localSubscriptionId, nonce, expiresAt }`, with `expiresAt`
 *    ~30 minutes out.
 *  - propagates a failure from the correlation-row insert (so the whole
 *    transaction rolls back — a `pending_provider` subscription can never
 *    exist without a way to link it).
 *
 * DB + service-core transaction wrapper: `@repo/db` is mocked (a fake `tx`
 * stub records inserts/updates); `withServiceTransaction` from
 * `@repo/service-core` runs FOR REAL against that mocked `@repo/db`, so this
 * test also exercises the actual transaction-wiring contract, not just a
 * mocked pass-through.
 *
 * @module test/services/billing/pending-provider-subscription-create
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const txExecuteMock = vi.fn().mockResolvedValue(undefined);

/** A fake tx object passed to the withTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock })),
    execute: txExecuteMock
};

const withTransactionMock = vi.fn(
    async (cb: (tx: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

const pendingCheckoutCreateMock = vi.fn();
const supersedePendingMock = vi.fn().mockResolvedValue([]);

vi.mock('@repo/db', () => ({
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckoutModel: {
        create: (...args: unknown[]) => pendingCheckoutCreateMock(...args),
        supersedePendingForCustomerPlan: (...args: unknown[]) => supersedePendingMock(...args)
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    withTransaction: (...args: unknown[]) =>
        (withTransactionMock as (...a: unknown[]) => unknown)(...args)
}));

// importActual (not a full replace): `withServiceTransaction`'s real module
// graph (via @repo/service-core) transitively needs real @repo/schemas
// exports (e.g. PermissionEnum in permission.ts).
vi.mock('@repo/schemas', async () => {
    const actual = await vi.importActual('@repo/schemas');
    return {
        ...actual,
        ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' },
        SubscriptionStatusEnum: { PENDING_PROVIDER: 'pending_provider' }
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// `withServiceTransaction` (from @repo/service-core) is NOT mocked — it runs
// for real against the mocked `@repo/db.withTransaction` above, so this test
// exercises the actual transaction-wrapper contract the production code uses.
import { createPendingProviderSubscription } from '../../../src/services/billing/pending-provider-subscription-create';

const BASE_INPUT = {
    customerId: 'cust-1',
    planId: 'plan-uuid-1',
    priceId: 'price-m',
    billingInterval: 'monthly' as const,
    mpPreapprovalPlanId: 'mp-plan-1',
    payerEmail: 'host@hospeda.test',
    livemode: false
};

describe('createPendingProviderSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertValuesMock.mockResolvedValue(undefined);
        updateWhereMock.mockResolvedValue(undefined);
        pendingCheckoutCreateMock.mockResolvedValue({ id: 'pending-checkout-1' });
    });

    it('inserts a pending_provider row (no mp id, no promo id) + the correlation row atomically', async () => {
        const before = Date.now();
        const result = await createPendingProviderSubscription(BASE_INPUT);
        const after = Date.now();

        // Returns a UUID-shaped localSubscriptionId, a 32-hex-char nonce, and
        // an expiresAt roughly 3 hours out (HOS-191: raised from 30min so the
        // abandoned-pending reaper does not reap a Path C checkout still in progress).
        expect(result.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
        const expiresAtMs = new Date(result.expiresAt).getTime();
        const threeHours = 3 * 60 * 60 * 1000;
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + threeHours - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + threeHours + 2000);

        // Insert shape: status='pending_provider', no mp_subscription_id, no
        // promo_code_id (a pendingDiscount is not yet REDEEMED).
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.status).toBe('pending_provider');
        expect(inserted).not.toHaveProperty('mpSubscriptionId');
        expect(inserted).not.toHaveProperty('promoCodeId');
        expect(inserted.customerId).toBe('cust-1');
        expect(inserted.planId).toBe('plan-uuid-1');
        expect(inserted.billingInterval).toBe('month');
        expect(inserted.intervalCount).toBe(1);
        expect(inserted.livemode).toBe(false);
        expect(inserted.id).toBe(result.localSubscriptionId);

        // currentPeriodEnd is a placeholder bounded to the correlation TTL —
        // NOT NULL, and not before currentPeriodStart.
        const periodStart = inserted.currentPeriodStart as Date;
        const periodEnd = inserted.currentPeriodEnd as Date;
        expect(periodEnd.getTime()).toBeGreaterThanOrEqual(periodStart.getTime());

        // metadata carries traceability fields for the pending row.
        const metadata = inserted.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('start-paid-share-link');
        expect(metadata.intendedInterval).toBe('monthly');
        expect(metadata.priceId).toBe('price-m');
        expect(metadata.mpPreapprovalPlanId).toBe('mp-plan-1');
        // HOS-1012: the key is gone entirely, not written as 'false'.
        expect(metadata).not.toHaveProperty('trialGranted');

        // product_domain stamped via a typed UPDATE, defaulting to accommodation.
        expect(updateSetMock).toHaveBeenCalledWith({ productDomain: 'accommodation' });
        expect(updateWhereMock).toHaveBeenCalledWith({
            op: 'eq',
            col: 'id',
            val: result.localSubscriptionId
        });

        // Correlation row created INSIDE the same tx.
        expect(pendingCheckoutCreateMock).toHaveBeenCalledOnce();
        const [correlationArg, txArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).toMatchObject({
            localSubscriptionId: result.localSubscriptionId,
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            mpPreapprovalPlanId: 'mp-plan-1',
            nonce: result.nonce,
            payerEmail: 'host@hospeda.test',
            status: 'pending'
        });
        expect(txArg).toBe(txStub);
    });

    it('maps annual interval to billingInterval=year', async () => {
        await createPendingProviderSubscription({ ...BASE_INPUT, billingInterval: 'annual' });

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.billingInterval).toBe('year');
    });

    it('snapshots a pendingDiscount on the correlation row when supplied', async () => {
        await createPendingProviderSubscription({
            ...BASE_INPUT,
            pendingDiscount: { promoCodeId: 'pc-1', finalAmountCentavos: 5000 }
        });

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect((correlationArg as Record<string, unknown>).pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 5000
        });
    });

    it('omits pendingDiscount from the correlation row when not supplied', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).not.toHaveProperty('pendingDiscount');
    });

    it('respects an explicit productDomain override', async () => {
        await createPendingProviderSubscription({ ...BASE_INPUT, productDomain: 'commerce' });

        expect(updateSetMock).toHaveBeenCalledWith({ productDomain: 'commerce' });
    });

    it('stamps domainMetadata into the subscription metadata (the subscription → entity path)', async () => {
        // Path C creates one subscription per checkout CLICK while the domain
        // link row is UPSERTED per ENTITY, so the entity → subscription link is
        // destroyed by the second click. The only way a reconciler can recover
        // the orphaned first subscription is the INVERSE path: coordinates
        // carried on the subscription itself.
        await createPendingProviderSubscription({
            ...BASE_INPUT,
            productDomain: 'commerce',
            domainMetadata: { commerceEntityType: 'gastronomy', commerceEntityId: 'entity-1' }
        });

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = inserted.metadata as Record<string, unknown>;
        expect(metadata.commerceEntityType).toBe('gastronomy');
        expect(metadata.commerceEntityId).toBe('entity-1');
        // The pre-existing traceability fields are not clobbered by the merge.
        expect(metadata.source).toBe('start-paid-share-link');
        expect(metadata.mpPreapprovalPlanId).toBe('mp-plan-1');
    });

    it('leaves metadata free of domain coordinates when none are supplied', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = inserted.metadata as Record<string, unknown>;
        expect(metadata).not.toHaveProperty('commerceEntityId');
        expect(metadata).not.toHaveProperty('partnerId');
    });

    // HOS-1012: the pre-written trial window is GONE. `freeTrialDays` and
    // `trialGranted` were removed from this helper's input, so a checkout row is
    // born with a null window no matter what the caller does — the reason being
    // that MercadoPago reports a spent free trial identically to a live one
    // (HOS-522: ARS 18.000 charged 118 seconds after promising 14 free days).
    // `status` still stays `pending_provider`, unchanged.
    it('never writes a trial window, whatever the caller passes (HOS-1012)', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.status).toBe('pending_provider');
        expect(inserted.trialStart).toBeNull();
        expect(inserted.trialEnd).toBeNull();
    });

    it('generates a fresh nonce on every call (no accidental reuse)', async () => {
        const first = await createPendingProviderSubscription(BASE_INPUT);
        const second = await createPendingProviderSubscription(BASE_INPUT);

        expect(first.nonce).not.toBe(second.nonce);
    });

    it('propagates a failure from the correlation-row insert (rolls back the whole attempt)', async () => {
        pendingCheckoutCreateMock.mockRejectedValueOnce(new Error('unique constraint violation'));

        await expect(createPendingProviderSubscription(BASE_INPUT)).rejects.toThrow(
            'unique constraint violation'
        );
    });

    // ── Domain link row (commerce / partner) inside the SAME transaction ──────

    it('runs writeDomainLinkRow inside the same transaction, with the new subscription id', async () => {
        const seen: { tx?: unknown; localSubscriptionId?: string } = {};
        const result = await createPendingProviderSubscription({
            ...BASE_INPUT,
            productDomain: 'commerce',
            writeDomainLinkRow: async ({ tx, localSubscriptionId }) => {
                seen.tx = tx;
                seen.localSubscriptionId = localSubscriptionId;
            }
        });

        // The SAME tx object the subscription + correlation rows were written
        // with — that identity is what makes the domain link row atomic with them.
        expect(seen.tx).toBe(txStub);
        // The id is generated inside this helper, so the caller cannot know it
        // before the call returns: it MUST be handed to the callback.
        expect(seen.localSubscriptionId).toBe(result.localSubscriptionId);
    });

    it('aborts the whole attempt when writeDomainLinkRow throws', async () => {
        await expect(
            createPendingProviderSubscription({
                ...BASE_INPUT,
                writeDomainLinkRow: async () => {
                    throw new Error('link row upsert failed');
                }
            })
        ).rejects.toThrow('link row upsert failed');
    });

    it('omits payerEmail from the correlation row when the caller does not know the payer', async () => {
        // The partner checkout deliberately snapshots NO payer email: its billing
        // customer carries a synthetic `@partners.hospeda.invalid` address that
        // could never match a live MercadoPago payer email, and the linker's
        // payer-email check is a VETO (a confirmed mismatch refuses the link; an
        // absent snapshot does not).
        const { payerEmail: _unknownPayer, ...withoutEmail } = BASE_INPUT;
        await createPendingProviderSubscription(withoutEmail);

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).not.toHaveProperty('payerEmail');
    });

    // ── HOS-240: trial_extension redemption is DEFERRED — snapshotted, not recorded ──

    it('HOS-240: snapshots pendingTrialExtension on the correlation row (redemption deferred to link time)', async () => {
        await createPendingProviderSubscription({
            ...BASE_INPUT,
            pendingTrialExtension: { promoCodeId: 'pc-trial-1', code: 'FREEMONTH' }
        });

        // Deferred: no promo_code_id stamped here (only product_domain) — the
        // stamp + redemption happen at link time (link-preapproval.service.ts).
        expect(updateSetMock).toHaveBeenCalledWith({ productDomain: 'accommodation' });

        // The promo identity is snapshotted on the correlation row, like pendingDiscount.
        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect((correlationArg as Record<string, unknown>).pendingTrialExtension).toEqual({
            promoCodeId: 'pc-trial-1',
            code: 'FREEMONTH'
        });
    });

    it('HOS-240: omits pendingTrialExtension from the correlation row when not supplied', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).not.toHaveProperty('pendingTrialExtension');
    });
    /**
     * REGRESSION (HOS-276 follow-up).
     *
     * A customer who retries checkout after a declined card used to leave TWO
     * live correlation rows for the same customer + MercadoPago plan. The
     * webhook fallback (Tier 3) can only tell candidates apart by
     * `mp_preapproval_plan_id` + payer email + a 24h window, on which the two
     * rows are identical — so it refused to link, and the approved payment had
     * nowhere to land. Measured in staging on 2026-08-29 ($35.000 unrecorded).
     *
     * Retiring the earlier attempt at creation time is what keeps the candidate
     * set unambiguous, so this must happen on EVERY checkout, inside the same
     * transaction, and BEFORE the new row exists (otherwise it would supersede
     * itself).
     */
    it('supersedes the customer earlier in-flight checkouts for the same MP plan, in the same tx', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        expect(supersedePendingMock).toHaveBeenCalledOnce();
        const [args, txArg] = supersedePendingMock.mock.calls[0] ?? [];
        expect(args).toEqual({ customerId: 'cust-1', mpPreapprovalPlanId: 'mp-plan-1' });
        expect(txArg).toBe(txStub);
    });

    it('supersedes BEFORE inserting the new correlation row (never supersedes itself)', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const supersedeOrder = supersedePendingMock.mock.invocationCallOrder[0];
        const createOrder = pendingCheckoutCreateMock.mock.invocationCallOrder[0];
        expect(supersedeOrder).toBeDefined();
        expect(createOrder).toBeDefined();
        expect(supersedeOrder as number).toBeLessThan(createOrder as number);
    });

    it('scopes the supersede to the MP plan actually being checked out', async () => {
        await createPendingProviderSubscription({
            ...BASE_INPUT,
            mpPreapprovalPlanId: 'mp-plan-other'
        });

        expect(supersedePendingMock).toHaveBeenCalledWith(
            { customerId: 'cust-1', mpPreapprovalPlanId: 'mp-plan-other' },
            txStub
        );
    });
});
