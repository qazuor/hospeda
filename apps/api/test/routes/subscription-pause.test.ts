/**
 * Unit tests for the self-serve subscription pause handler (SPEC-194 T-023).
 *
 * Covers:
 * - Happy path: monthly active subscription is paused successfully.
 * - Annual guard: annual subscription → 400 PAUSE_NOT_SUPPORTED_FOR_ANNUAL.
 * - 503 when billing is not configured.
 * - 400 when no billing account found.
 * - 404 when no active subscription exists.
 *
 * @module test/routes/subscription-pause
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({ id: 'user-123' })
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/subscription-pause.service', () => ({
    setOwnerServiceSuspension: vi.fn().mockResolvedValue({ accommodationsUpdated: 0 })
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
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    }),
    billingSubscriptionEvents: { _: 'billingSubscriptionEvents' }
}));

vi.mock('@repo/schemas', () => ({
    SubscriptionStatusEnum: {
        PAUSED: 'paused',
        ACTIVE: 'active'
    },
    SubscriptionPauseResumeResponseSchema: {}
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handleSelfServePause } from '../../src/routes/billing/subscription-pause';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-abc';

interface ContextOptions {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
}

function createMockContext(opts: ContextOptions = {}) {
    const { billingEnabled = true, billingCustomerId = CUSTOMER_ID } = opts;
    const store = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);
    return { get: vi.fn((key: string) => store.get(key)) };
}

interface SubFixture {
    id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
}

function makeBillingMock(subs: SubFixture[] = []) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subs),
            pause: vi.fn().mockResolvedValue({ id: subs[0]?.id ?? 'sub-1', status: 'paused' })
        }
    };
}

function mockBilling(billing: ReturnType<typeof makeBillingMock> | null) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleSelfServePause', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path — monthly subscription
    // -----------------------------------------------------------------------

    it('pauses a monthly active subscription successfully', async () => {
        const sub = {
            id: 'sub-monthly-1',
            status: 'active',
            metadata: { billingInterval: 'monthly' }
        };
        mockBilling(makeBillingMock([sub]));
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBe('sub-monthly-1');
        expect(result.status).toBe('paused');
    });

    it('pauses a monthly trialing subscription successfully', async () => {
        const sub = { id: 'sub-trial-1', status: 'trialing', metadata: {} };
        const billing = makeBillingMock([sub]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.success).toBe(true);
        expect(billing.subscriptions.pause).toHaveBeenCalledWith('sub-trial-1');
    });

    // -----------------------------------------------------------------------
    // Annual guard (SPEC-194 T-023)
    // -----------------------------------------------------------------------

    it('rejects with 400 PAUSE_NOT_SUPPORTED_FOR_ANNUAL for annual active subscription', async () => {
        const annualSub = {
            id: 'sub-annual-1',
            status: 'active',
            metadata: { billingInterval: 'annual' }
        };
        const billing = makeBillingMock([annualSub]);
        mockBilling(billing);
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(400);
            expect(httpErr.message).toContain('PAUSE_NOT_SUPPORTED_FOR_ANNUAL');
        }
    });

    it('does not call billing.subscriptions.pause for annual subscriptions', async () => {
        const annualSub = {
            id: 'sub-annual-2',
            status: 'active',
            metadata: { billingInterval: 'annual' }
        };
        const billing = makeBillingMock([annualSub]);
        mockBilling(billing);
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Billing not configured
    // -----------------------------------------------------------------------

    it('throws 503 when billingEnabled is false', async () => {
        const ctx = createMockContext({ billingEnabled: false });

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(503);
        }
    });

    it('throws 400 when no billing customer id', async () => {
        mockBilling(makeBillingMock([]));
        const ctx = createMockContext({ billingCustomerId: null });

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(400);
        }
    });

    // -----------------------------------------------------------------------
    // No active subscription
    // -----------------------------------------------------------------------

    it('throws 404 when no active or trialing subscription exists', async () => {
        mockBilling(makeBillingMock([{ id: 'sub-paused', status: 'paused', metadata: {} }]));
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(404);
        }
    });
});
