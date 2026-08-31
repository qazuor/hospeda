/**
 * Unit tests for the checkout-retry recovery route (HOS-937 step 3).
 *
 * Covers:
 * - Error order (`apps/api/docs/error-contract.md`): 503 → 400 → 404 (never
 *   403 for a foreign row) → 422.
 * - The `authorized`/`pending`/`cancelled` classification-to-response
 *   mapping, and that `pending`/`cancelled` are never confused (spec §6.4
 *   — the pair most expensive to swap).
 * - Already-activated rows short-circuit WITHOUT a MercadoPago call.
 * - An already-cancelled-and-minted row replays the stored checkout URL
 *   without calling MercadoPago or the recovery orchestration again.
 *
 * @module test/routes/billing/checkout-retry
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

const mockRetrieve = vi.fn();

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: vi.fn(() => ({
        subscriptions: { retrieve: mockRetrieve }
    }))
}));

const mockLimit = vi.fn();
vi.mock('@repo/db', () => ({
    billingSubscriptions: { id: 'id-col', metadata: 'metadata-col' },
    eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ limit: mockLimit }))
            }))
        }))
    }))
}));

vi.mock('../../../src/lib/qzpay-logger.js', () => ({ qzpayLogger: {} }));

vi.mock('../../../src/middlewares/billing.js', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/create-app.js', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

vi.mock('../../../src/utils/route-factory.js', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/routes/billing/checkout-return-urls.js', () => ({
    buildPaymentMethodReturnUrl: vi.fn(
        () => 'https://hospeda.test/es/suscriptores/checkout/success/'
    ),
    buildNotificationUrl: vi.fn(() => 'https://api.hospeda.test/webhooks/mercadopago'),
    resolveReturnUrlLocale: vi.fn(() => 'es')
}));

const mockRecoverCancelledPreapproval = vi.fn();
const mockClassifyPreapprovalStatus = vi.fn();
vi.mock('../../../src/services/billing/preapproval-recovery.service.js', () => ({
    classifyPreapprovalStatus: (...args: unknown[]) => mockClassifyPreapprovalStatus(...args),
    recoverCancelledPreapproval: (...args: unknown[]) => mockRecoverCancelledPreapproval(...args)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing.js';
import { handleCheckoutRetry } from '../../../src/routes/billing/checkout-retry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_CUSTOMER_ID = 'cust_owner';
const OTHER_CUSTOMER_ID = 'cust_intruder';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_abc';

interface ContextOptions {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
}

function createMockContext(opts: ContextOptions = {}) {
    const { billingEnabled = true, billingCustomerId = OWNER_CUSTOMER_ID } = opts;
    const store = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);
    return { get: vi.fn((key: string) => store.get(key)) };
}

function mockRow(row: Record<string, unknown> | null) {
    mockLimit.mockResolvedValue(row ? [row] : []);
}

function baseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: LOCAL_SUB_ID,
        customerId: OWNER_CUSTOMER_ID,
        planId: 'plan-001',
        productDomain: null,
        status: SubscriptionStatusEnum.PENDING_PROVIDER,
        mpSubscriptionId: MP_SUBSCRIPTION_ID,
        metadata: {},
        ...overrides
    };
}

describe('handleCheckoutRetry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getQZPayBilling).mockReturnValue({} as never);
    });

    it('returns 503 when billing is not enabled', async () => {
        const ctx = createMockContext({ billingEnabled: false });
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 400 when the caller has no billing customer', async () => {
        const ctx = createMockContext({ billingCustomerId: null });
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 400 });
    });

    it('returns 404 (never 403) when the subscription does not exist', async () => {
        mockRow(null);
        const ctx = createMockContext();
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 (never 403) when the subscription belongs to a different customer', async () => {
        mockRow(baseRow({ customerId: OTHER_CUSTOMER_ID }));
        const ctx = createMockContext({ billingCustomerId: OWNER_CUSTOMER_ID });
        const error = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID }).catch(
            (e) => e
        );
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
    });

    it('short-circuits to authorized WITHOUT any MercadoPago call when the row is already ACTIVE', async () => {
        mockRow(baseRow({ status: SubscriptionStatusEnum.ACTIVE }));
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({ recovery: 'authorized', checkoutUrl: null });
        expect(mockRetrieve).not.toHaveBeenCalled();
    });

    it('returns 422 for a state this endpoint does not apply to (e.g. PAUSED)', async () => {
        mockRow(baseRow({ status: SubscriptionStatusEnum.PAUSED }));
        const ctx = createMockContext();
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 422 });
    });

    it('returns 422 when the row has no mpSubscriptionId to check', async () => {
        mockRow(baseRow({ mpSubscriptionId: null }));
        const ctx = createMockContext();
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 422 });
    });

    it('classification=authorized: returns authorized with null checkoutUrl', async () => {
        mockRow(baseRow());
        mockRetrieve.mockResolvedValue({ status: 'active' });
        mockClassifyPreapprovalStatus.mockReturnValue('authorized');
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({ recovery: 'authorized', checkoutUrl: null });
        expect(mockRecoverCancelledPreapproval).not.toHaveBeenCalled();
    });

    it('classification=pending: returns the SAME object`s init_point from metadata.checkoutUrl — never mints', async () => {
        mockRow(baseRow({ metadata: { checkoutUrl: 'https://mp.test/checkout/same' } }));
        mockRetrieve.mockResolvedValue({ status: 'pending' });
        mockClassifyPreapprovalStatus.mockReturnValue('pending');
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            recovery: 'pending',
            checkoutUrl: 'https://mp.test/checkout/same'
        });
        expect(mockRecoverCancelledPreapproval).not.toHaveBeenCalled();
    });

    it('classification=cancelled + minted: returns a FRESH checkoutUrl via recoverCancelledPreapproval — never the old one', async () => {
        mockRow(baseRow({ metadata: { checkoutUrl: 'https://mp.test/checkout/old' } }));
        mockRetrieve.mockResolvedValue({ status: 'canceled' });
        mockClassifyPreapprovalStatus.mockReturnValue('cancelled');
        mockRecoverCancelledPreapproval.mockResolvedValue({
            kind: 'minted',
            localSubscriptionId: 'sub-new',
            checkoutUrl: 'https://mp.test/checkout/fresh'
        });
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            recovery: 'cancelled',
            checkoutUrl: 'https://mp.test/checkout/fresh'
        });
        expect(result.checkoutUrl).not.toBe('https://mp.test/checkout/old');
    });

    it('classification=cancelled but NOT YET confirmed (R-3): returns confirming, not cancelled', async () => {
        mockRow(baseRow());
        mockRetrieve.mockResolvedValue({ status: 'canceled' });
        mockClassifyPreapprovalStatus.mockReturnValue('cancelled');
        mockRecoverCancelledPreapproval.mockResolvedValue({
            kind: 'not_confirmed',
            classification: 'pending'
        });
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({ recovery: 'confirming', checkoutUrl: null });
    });

    it('classification=cancelled but the claim was lost to a concurrent winner: returns confirming', async () => {
        mockRow(baseRow());
        mockRetrieve.mockResolvedValue({ status: 'canceled' });
        mockClassifyPreapprovalStatus.mockReturnValue('cancelled');
        mockRecoverCancelledPreapproval.mockResolvedValue({ kind: 'claim_lost' });
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({ recovery: 'confirming', checkoutUrl: null });
    });

    it('classification=cancelled but minting is unsupported: returns 422', async () => {
        mockRow(baseRow());
        mockRetrieve.mockResolvedValue({ status: 'canceled' });
        mockClassifyPreapprovalStatus.mockReturnValue('cancelled');
        mockRecoverCancelledPreapproval.mockResolvedValue({
            kind: 'unsupported',
            reason: 'no mpPreapprovalPlanId'
        });
        const ctx = createMockContext();

        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 422 });
    });

    it('an already-cancelled-and-minted row replays the SAME stored checkout URL, without any MercadoPago call', async () => {
        mockRow(
            baseRow({
                status: SubscriptionStatusEnum.CANCELLED,
                metadata: {
                    retryMintedLocalSubscriptionId: 'sub-new',
                    retryMintedCheckoutUrl: 'https://mp.test/checkout/already'
                }
            })
        );
        const ctx = createMockContext();

        const result = await handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            recovery: 'cancelled',
            checkoutUrl: 'https://mp.test/checkout/already'
        });
        expect(mockRetrieve).not.toHaveBeenCalled();
        expect(mockRecoverCancelledPreapproval).not.toHaveBeenCalled();
    });

    it('throws HTTPException instances (not generic Errors)', async () => {
        mockRow(null);
        const ctx = createMockContext();
        await expect(
            handleCheckoutRetry(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toBeInstanceOf(HTTPException);
    });
});
