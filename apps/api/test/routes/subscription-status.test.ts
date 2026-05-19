/**
 * Unit tests for the subscription status polling route (SPEC-126 D2).
 *
 * Covers:
 * - Happy path for each terminal status.
 * - Ownership enforcement (cross-customer 403).
 * - 503 when billing is not configured.
 * - 400 when the caller has no billing customer.
 * - 404 when the subscription does not exist.
 * - 500 when the subscription status is unknown (data integrity).
 * - mpSubscriptionId extraction from providerSubscriptionIds.
 * - activatedAt derivation rules.
 *
 * @module test/routes/subscription-status
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handleGetSubscriptionStatus } from '../../src/routes/billing/subscription-status';

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

    const contextStore = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);

    return {
        get: vi.fn((key: string) => contextStore.get(key))
    };
}

interface SubscriptionFixture {
    id: string;
    customerId: string;
    status: string;
    providerSubscriptionIds?: Record<string, string>;
    currentPeriodStart?: Date | string | null;
}

function createBillingMock(sub: SubscriptionFixture | null) {
    return {
        subscriptions: {
            get: vi.fn().mockResolvedValue(sub)
        }
    };
}

function mockBilling(billing: ReturnType<typeof createBillingMock> | null) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleGetSubscriptionStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns active status with mpSubscriptionId and activatedAt', async () => {
        const periodStart = new Date('2026-05-15T12:00:00.000Z');
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'active',
                providerSubscriptionIds: { mercadopago: 'mp-preapproval-abc' },
                currentPeriodStart: periodStart
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            status: SubscriptionStatusEnum.ACTIVE,
            mpSubscriptionId: 'mp-preapproval-abc',
            activatedAt: periodStart.toISOString()
        });
    });

    it('returns pending_provider with null mpSubscriptionId before webhook arrives', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'pending_provider',
                providerSubscriptionIds: {},
                currentPeriodStart: null
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result).toEqual({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            mpSubscriptionId: null,
            activatedAt: null
        });
    });

    it('returns abandoned for subs marked by the TTL cron', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'abandoned'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.ABANDONED);
        expect(result.activatedAt).toBeNull();
        expect(result.mpSubscriptionId).toBeNull();
    });

    it('returns active status but null activatedAt when currentPeriodStart is missing', async () => {
        // Data-integrity edge: an active sub without periodStart cannot derive
        // an accurate activation timestamp, so we surface null rather than guess.
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'active',
                providerSubscriptionIds: { mercadopago: 'mp-x' }
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.ACTIVE);
        expect(result.activatedAt).toBeNull();
    });

    it('accepts currentPeriodStart as an ISO string and normalises it', async () => {
        const isoStart = '2026-05-15T08:30:00.000Z';
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'active',
                providerSubscriptionIds: { mercadopago: 'mp-x' },
                currentPeriodStart: isoStart
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.activatedAt).toBe(isoStart);
    });

    it('treats non-active statuses as having null activatedAt even with currentPeriodStart', async () => {
        // past_due keeps the period dates from when the sub was last active, but
        // the polling endpoint should NOT surface activatedAt for any non-active status.
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'past_due',
                currentPeriodStart: new Date('2026-04-01T00:00:00.000Z')
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.PAST_DUE);
        expect(result.activatedAt).toBeNull();
    });

    it('rejects cross-customer access with 403', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OTHER_CUSTOMER_ID,
                status: 'active'
            })
        );

        const ctx = createMockContext({ billingCustomerId: OWNER_CUSTOMER_ID });

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 403
        });
    });

    it('returns 404 when the subscription is not found', async () => {
        mockBilling(createBillingMock(null));

        const ctx = createMockContext();

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 404
        });
    });

    it('returns 503 when billing is not enabled', async () => {
        mockBilling(null);
        const ctx = createMockContext({ billingEnabled: false });

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 503
        });
    });

    it('returns 503 when the billing client is not initialised', async () => {
        mockBilling(null);
        const ctx = createMockContext();

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 503
        });
    });

    it('returns 400 when the caller has no billing customer', async () => {
        // Even with a mock subscription configured, this should short-circuit
        // before the lookup because the actor cannot own anything yet.
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'active'
            })
        );

        const ctx = createMockContext({ billingCustomerId: null });

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 400
        });
    });

    it('returns 500 when the subscription is stored with an unknown status', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'mystery_state_not_in_enum'
            })
        );

        const ctx = createMockContext();

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toMatchObject({
            status: 500
        });
    });

    // -------------------------------------------------------------------
    // qzpay-vocabulary → Hospeda enum mapping (subs written by qzpay-core
    // arrive with the qzpay vocabulary; we map them at the boundary so the
    // front always sees Hospeda values).
    // -------------------------------------------------------------------

    it('maps qzpay "incomplete" to PENDING_PROVIDER', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'incomplete'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);
    });

    it('maps qzpay "incomplete_expired" to ABANDONED', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'incomplete_expired'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.ABANDONED);
    });

    it('maps qzpay single-L "canceled" to Hospeda double-L CANCELLED', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'canceled'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.CANCELLED);
    });

    it('also accepts already-Hospeda "cancelled" (idempotent re-mapping)', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'cancelled'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.CANCELLED);
    });

    it('maps qzpay "unpaid" to Hospeda PAST_DUE', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'unpaid'
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.status).toBe(SubscriptionStatusEnum.PAST_DUE);
    });

    it('ignores non-mercadopago entries in providerSubscriptionIds', async () => {
        mockBilling(
            createBillingMock({
                id: LOCAL_SUB_ID,
                customerId: OWNER_CUSTOMER_ID,
                status: 'pending_provider',
                providerSubscriptionIds: { stripe: 'stripe-sub-xyz' }
            })
        );

        const ctx = createMockContext();
        const result = await handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID });

        expect(result.mpSubscriptionId).toBeNull();
    });

    it('throws HTTPException instances (not generic Errors)', async () => {
        mockBilling(createBillingMock(null));
        const ctx = createMockContext();

        await expect(
            handleGetSubscriptionStatus(ctx as never, { localId: LOCAL_SUB_ID })
        ).rejects.toBeInstanceOf(HTTPException);
    });
});
