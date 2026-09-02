/**
 * Unit tests for the replace-payment-method recovery route (HOS-348 Part B).
 *
 * Covers:
 * - Error order (`apps/api/docs/error-contract.md`): 503 → 400 → 404 (never
 *   403 for a foreign row) → 422 (wrong status, annual interval).
 * - Success path: the row lookup's `id`/`planId` are forwarded to the
 *   service verbatim, and the service's `{checkoutUrl, reused}` result is
 *   returned as-is.
 * - A `SubscriptionCheckoutError` from the service (e.g. plan resolution
 *   failure) is mapped to the right HTTP status via the shared mapper.
 *
 * @module test/routes/billing/replace-payment-method
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

const mockLimit = vi.fn();
vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id-col',
        customerId: 'customer-id-col',
        planId: 'plan-id-col',
        status: 'status-col',
        billingInterval: 'billing-interval-col'
    },
    eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ limit: mockLimit }))
            }))
        }))
    }))
}));

vi.mock('../../../src/middlewares/billing.js', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../src/middlewares/idempotency-key.js', () => ({
    idempotencyKeyMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../../src/utils/create-app.js', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn(), use: vi.fn() }))
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

const mockReplacePastDuePaymentMethod = vi.fn();
vi.mock('../../../src/services/billing/past-due-payment-method-replacement.service.js', () => ({
    replacePastDuePaymentMethod: (...args: unknown[]) => mockReplacePastDuePaymentMethod(...args)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing.js';
import { handleReplacePaymentMethod } from '../../../src/routes/billing/replace-payment-method.js';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_CUSTOMER_ID = 'cust_owner';
const OTHER_CUSTOMER_ID = 'cust_intruder';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';

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
    return { get: vi.fn((key: string) => store.get(key)), req: { header: vi.fn() } };
}

function mockRow(row: Record<string, unknown> | null) {
    mockLimit.mockResolvedValue(row ? [row] : []);
}

function baseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: LOCAL_SUB_ID,
        customerId: OWNER_CUSTOMER_ID,
        planId: 'plan-001',
        status: SubscriptionStatusEnum.PAST_DUE,
        billingInterval: 'month',
        ...overrides
    };
}

describe('handleReplacePaymentMethod', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getQZPayBilling).mockReturnValue({} as never);
    });

    it('returns 503 when billing is not enabled', async () => {
        const ctx = createMockContext({ billingEnabled: false });
        await expect(
            handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 400 when the caller has no billing customer', async () => {
        const ctx = createMockContext({ billingCustomerId: null });
        await expect(
            handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 400 });
    });

    it('returns 404 (never 403) when the subscription does not exist', async () => {
        mockRow(null);
        const ctx = createMockContext();
        await expect(
            handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 (never 403) when the subscription belongs to a different customer', async () => {
        mockRow(baseRow({ customerId: OTHER_CUSTOMER_ID }));
        const ctx = createMockContext({ billingCustomerId: OWNER_CUSTOMER_ID });
        const error = await handleReplacePaymentMethod(ctx as never, {
            localId: LOCAL_SUB_ID
        }).catch((e) => e);
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
    });

    it('returns 422 when the subscription is not past_due', async () => {
        mockRow(baseRow({ status: SubscriptionStatusEnum.ACTIVE }));
        const ctx = createMockContext();
        await expect(
            handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 422 });
        expect(mockReplacePastDuePaymentMethod).not.toHaveBeenCalled();
    });

    it('returns 422 for an annual subscription (Part B scope is monthly only)', async () => {
        mockRow(baseRow({ billingInterval: 'year' }));
        const ctx = createMockContext();
        await expect(
            handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({ status: 422 });
        expect(mockReplacePastDuePaymentMethod).not.toHaveBeenCalled();
    });

    it('forwards the row id/planId to the service and returns its result verbatim', async () => {
        mockRow(baseRow());
        mockReplacePastDuePaymentMethod.mockResolvedValue({
            localSubscriptionId: 'sub-new-001',
            checkoutUrl: 'https://mercadopago.example/checkout/sub-new-001',
            reused: false
        });
        const ctx = createMockContext();

        const result = await handleReplacePaymentMethod(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            checkoutUrl: 'https://mercadopago.example/checkout/sub-new-001',
            reused: false
        });
        expect(mockReplacePastDuePaymentMethod).toHaveBeenCalledTimes(1);
        expect(mockReplacePastDuePaymentMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: OWNER_CUSTOMER_ID,
                pastDueSubscription: { id: LOCAL_SUB_ID, planId: 'plan-001' }
            })
        );
    });

    it('maps a SubscriptionCheckoutError from the service to its HTTP status', async () => {
        mockRow(baseRow());
        mockReplacePastDuePaymentMethod.mockRejectedValue(
            new SubscriptionCheckoutError('PLAN_NOT_FOUND', 'nope')
        );
        const ctx = createMockContext();

        const error = await handleReplacePaymentMethod(ctx as never, {
            localId: LOCAL_SUB_ID
        }).catch((e) => e);

        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
    });
});
