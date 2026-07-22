/**
 * Unit tests for the self-serve subscription pause handler (SPEC-194 T-023).
 *
 * Covers:
 * - Happy path: monthly active subscription is paused successfully.
 * - Annual guard: annual subscription → 400 PAUSE_NOT_SUPPORTED_FOR_ANNUAL.
 * - 503 when billing is not configured.
 * - 400 when no billing account found.
 * - 404 when no active subscription exists.
 * - Soft-cancel guard (HOS-246): a soft-cancelled (cancelAtPeriodEnd=true)
 *   active/trialing sub → 409 PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED, and the
 *   409 takes precedence over the 400 annual error when both apply.
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
import {
    handleSelfServePause,
    handleSelfServeResume
} from '../../src/routes/billing/subscription-pause';

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
    cancelAtPeriodEnd?: boolean;
}

function makeBillingMock(subs: SubFixture[] = []) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subs),
            pause: vi.fn().mockResolvedValue({ id: subs[0]?.id ?? 'sub-1', status: 'paused' }),
            resume: vi
                .fn()
                .mockImplementation((id: string) => Promise.resolve({ id, status: 'active' }))
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

    // -----------------------------------------------------------------------
    // Soft-cancel guard (HOS-246) — mirror of the resume guard from HOS-236
    // -----------------------------------------------------------------------

    // ── THE regression guard: a soft-cancelled active sub must NOT be pausable ──
    it('rejects with 409 when the only active sub is scheduled for cancellation (HOS-246)', async () => {
        const softCancelled = {
            id: 'sub-softcancel-1',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelled]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED');
        }
        // Pausing a soft-cancelled sub would cut short the grace window — the MP
        // preapproval must NEVER be paused for a cancellation in progress.
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    it('rejects with 409 for a soft-cancelled trialing subscription (HOS-246)', async () => {
        const softCancelledTrial = {
            id: 'sub-softcancel-trial',
            status: 'trialing',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelledTrial]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect((err as HTTPException).status).toBe(409);
            expect((err as HTTPException).message).toContain(
                'PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED'
            );
        }
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    it('pauses the genuinely-active sub and skips the soft-cancelled one when both exist', async () => {
        const softCancelled = {
            id: 'sub-softcancel-2',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: true
        };
        const pausable = {
            id: 'sub-active-2',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: false
        };
        // Ordered soft-cancelled first so the filter must actively skip it.
        const billing = makeBillingMock([softCancelled, pausable]);
        // pause() resolves the id it was called with so the assertion is exact.
        billing.subscriptions.pause = vi
            .fn()
            .mockImplementation((id: string) => Promise.resolve({ id, status: 'paused' }));
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.subscriptionId).toBe('sub-active-2');
        expect(billing.subscriptions.pause).toHaveBeenCalledWith('sub-active-2');
        expect(billing.subscriptions.pause).not.toHaveBeenCalledWith('sub-softcancel-2');
    });

    // Precedence: a sub that is BOTH annual AND soft-cancelled must surface the
    // 409 cancellation-scheduled error, NOT the 400 annual error. The soft-cancel
    // guard runs first, so the annual sub is excluded from target selection before
    // the annual check is ever reached. Documented decision (HOS-246), not accident.
    it('returns 409 (not 400 annual) for a subscription that is both annual and soft-cancelled', async () => {
        const annualSoftCancelled = {
            id: 'sub-annual-softcancel',
            status: 'active',
            metadata: { billingInterval: 'annual' },
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([annualSoftCancelled]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED');
            expect(httpErr.message).not.toContain('PAUSE_NOT_SUPPORTED_FOR_ANNUAL');
        }
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// handleSelfServeResume (HOS-236)
// ---------------------------------------------------------------------------

describe('handleSelfServeResume', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resumes a genuinely user-paused subscription (no pending cancellation)', async () => {
        const sub = {
            id: 'sub-paused-1',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: false
        };
        const billing = makeBillingMock([sub]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServeResume(ctx as never);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBe('sub-paused-1');
        expect(billing.subscriptions.resume).toHaveBeenCalledWith('sub-paused-1');
    });

    // ── THE regression guard: a soft-cancelled paused sub must NOT be resumable ──
    it('rejects with 409 when the only paused sub is scheduled for cancellation (HOS-236)', async () => {
        const softCancelled = {
            id: 'sub-softcancel-1',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelled]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServeResume(ctx as never);
            throw new Error('expected handleSelfServeResume to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('RESUME_NOT_ALLOWED_CANCELLATION_SCHEDULED');
        }
        // The MP preapproval must NEVER be resumed for a cancelled subscription.
        expect(billing.subscriptions.resume).not.toHaveBeenCalled();
    });

    it('resumes the genuinely-paused sub and skips the soft-cancelled one when both exist', async () => {
        const softCancelled = {
            id: 'sub-softcancel-2',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const resumable = {
            id: 'sub-paused-2',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: false
        };
        const billing = makeBillingMock([softCancelled, resumable]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServeResume(ctx as never);

        expect(result.subscriptionId).toBe('sub-paused-2');
        expect(billing.subscriptions.resume).toHaveBeenCalledWith('sub-paused-2');
        expect(billing.subscriptions.resume).not.toHaveBeenCalledWith('sub-softcancel-2');
    });

    it('throws 404 when no paused subscription exists', async () => {
        mockBilling(makeBillingMock([{ id: 'sub-active', status: 'active', metadata: {} }]));
        const ctx = createMockContext();

        try {
            await handleSelfServeResume(ctx as never);
            throw new Error('expected handleSelfServeResume to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
    });
});
