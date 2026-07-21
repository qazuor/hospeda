/**
 * Unit tests for the GET trial-eligibility billing route (HOS-226).
 *
 * Covers:
 * - Success: eligible customer (no prior subscription) -> `{ eligible: true }`.
 * - Success: ineligible customer (has a prior subscription) -> `{ eligible: false }`.
 * - `planSlug` query param is echoed back verbatim; omitted -> `null`.
 * - Billing not configured -> 503.
 * - No `billingCustomerId` on session -> 400.
 * - `getQZPayBilling()` returning null (misconfigured) -> 503.
 *
 * Mocking strategy mirrors `downgrade-preview.test.ts`:
 * - `resolveTrialEligibility` is mocked at module level so the test stays
 *   unit-level (the service has its own dedicated test suite).
 * - `createCRUDRoute` / `createRouter` are mocked to expose the raw handler.
 *
 * @module test/routes/billing/trial-eligibility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../src/services/billing/trial-eligibility.service', () => ({
    resolveTrialEligibility: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handleTrialEligibility } from '../../../src/routes/billing/trial-eligibility';
import { resolveTrialEligibility } from '../../../src/services/billing/trial-eligibility.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000099';
const FAKE_BILLING = { subscriptions: { getByCustomerId: vi.fn() } };

/**
 * Build a minimal Hono context stub for direct handler invocation.
 * `billingEnabled` / `billingCustomerId` default to the "happy path" —
 * individual tests override via the map before invoking the handler.
 */
function makeContext(
    overrides: { billingEnabled?: boolean; billingCustomerId?: string | null } = {}
) {
    const store = new Map<string, unknown>([
        ['billingEnabled', overrides.billingEnabled ?? true],
        [
            'billingCustomerId',
            'billingCustomerId' in overrides ? overrides.billingCustomerId : CUSTOMER_ID
        ]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        set: vi.fn((k: string, v: unknown) => store.set(k, v))
    };
}

function makeQuery(planSlug?: string): Record<string, unknown> {
    return planSlug === undefined ? {} : { planSlug };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleTrialEligibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getQZPayBilling).mockReturnValue(FAKE_BILLING as never);
    });

    describe('success', () => {
        it('returns eligible: true for a customer with no prior subscription', async () => {
            vi.mocked(resolveTrialEligibility).mockResolvedValue({ eligible: true });

            const ctx = makeContext();
            const result = await handleTrialEligibility(ctx as never, {}, {}, makeQuery());

            expect(result).toEqual({ eligible: true, planSlug: null });
        });

        it('returns eligible: false for a customer with a prior subscription', async () => {
            vi.mocked(resolveTrialEligibility).mockResolvedValue({ eligible: false });

            const ctx = makeContext();
            const result = await handleTrialEligibility(ctx as never, {}, {}, makeQuery());

            expect(result).toEqual({ eligible: false, planSlug: null });
        });

        it('echoes the planSlug query param back on the response', async () => {
            vi.mocked(resolveTrialEligibility).mockResolvedValue({ eligible: true });

            const ctx = makeContext();
            const result = await handleTrialEligibility(
                ctx as never,
                {},
                {},
                makeQuery('owner-basico')
            );

            expect(result).toEqual({ eligible: true, planSlug: 'owner-basico' });
        });

        it('calls resolveTrialEligibility with the resolved billing instance and customer id', async () => {
            vi.mocked(resolveTrialEligibility).mockResolvedValue({ eligible: true });

            const ctx = makeContext();
            await handleTrialEligibility(ctx as never, {}, {}, makeQuery());

            expect(resolveTrialEligibility).toHaveBeenCalledOnce();
            expect(resolveTrialEligibility).toHaveBeenCalledWith({
                billing: FAKE_BILLING,
                customerId: CUSTOMER_ID
            });
        });
    });

    describe('error paths', () => {
        it('throws 503 when billing is not configured', async () => {
            const ctx = makeContext({ billingEnabled: false });

            await expect(
                handleTrialEligibility(ctx as never, {}, {}, makeQuery())
            ).rejects.toMatchObject({ status: 503 });
            expect(resolveTrialEligibility).not.toHaveBeenCalled();
        });

        it('throws 400 when the caller has no billing customer on session', async () => {
            const ctx = makeContext({ billingCustomerId: null });

            await expect(
                handleTrialEligibility(ctx as never, {}, {}, makeQuery())
            ).rejects.toMatchObject({ status: 400 });
            expect(resolveTrialEligibility).not.toHaveBeenCalled();
        });

        it('throws 503 when getQZPayBilling() returns null', async () => {
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            const ctx = makeContext();

            await expect(
                handleTrialEligibility(ctx as never, {}, {}, makeQuery())
            ).rejects.toMatchObject({ status: 503 });
            expect(resolveTrialEligibility).not.toHaveBeenCalled();
        });

        it('propagates unexpected service errors as-is', async () => {
            vi.mocked(resolveTrialEligibility).mockRejectedValue(
                new Error('DB connection refused')
            );

            const ctx = makeContext();

            await expect(handleTrialEligibility(ctx as never, {}, {}, makeQuery())).rejects.toThrow(
                'DB connection refused'
            );
        });
    });
});
