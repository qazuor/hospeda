/**
 * HOS-2328 AC-P1 — `GET /protected/billing-subscription/` answers exactly as it
 * did before the own-subscriptions read moved into the service-core plan-state
 * reader (`readOwnPlanState`).
 *
 * The reader is mocked with the rows it returns, including the `planVersionId`
 * it gained for `get_my_plan`. The `data` of the response is compared as
 * SERIALIZED TEXT against the frozen body the route produced before the move,
 * so a new key, a missing key or a reordered key all fail.
 *
 * @module test/routes/billing-subscription/read-mine.snapshot
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedBillingSubscriptionReadRoutes } from '../../../src/routes/billing-subscription/index';
import type { AppBindings } from '../../../src/types';
import { injectClock } from '../../../src/utils/clock';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';
const SUCCESSOR_ID = '44444444-4444-4444-8444-444444444444';
const COURTESY_ID = '55555555-5555-4555-8555-555555555555';
const PLAN_VERSION_ID = '66666666-6666-4666-8666-666666666666';
const OPTION_ID = '77777777-7777-4777-8777-777777777777';

const mocks = vi.hoisted(() => ({
    readOwnPlanState: vi.fn(),
    readOwnDeclinedSignups: vi.fn(),
    readOwnExpiredDeclinedSignupNotices: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readOwnPlanState: mocks.readOwnPlanState
}));
vi.mock('../../../src/routes/billing-subscription/read-own-declined-signups', () => ({
    readOwnDeclinedSignups: mocks.readOwnDeclinedSignups,
    readOwnExpiredDeclinedSignupNotices: mocks.readOwnExpiredDeclinedSignupNotices
}));

/** The two rows the reader returns, exactly as `readOwnSubscriptions` builds them. */
function readerRows() {
    return [
        {
            id: SUBSCRIPTION_ID,
            predecessorId: null,
            vertical: 'accommodation',
            status: 'ACTIVE',
            paymentMethod: 'CARD',
            serviceEndsAt: null,
            graceEndsAt: null,
            createdAt: new Date('2026-10-01T10:00:00.000Z'),
            planVersionId: PLAN_VERSION_ID,
            plan: {
                slug: 'owner-pro',
                name: 'owner-pro',
                amount: 1000,
                currency: 'ARS',
                cycle: 'monthly'
            },
            nextCharge: { at: new Date('2026-12-01T10:00:00.000Z'), amount: 1000, currency: 'ARS' },
            paidAfterCancellation: null,
            pause: null,
            promo: null,
            liveCourtesyMonths: 0,
            scheduledChange: null,
            succession: null
        },
        {
            id: SUCCESSOR_ID,
            predecessorId: SUBSCRIPTION_ID,
            vertical: 'venue',
            status: 'CANCEL_SCHEDULED',
            paymentMethod: 'MANUAL',
            serviceEndsAt: new Date('2026-12-15T03:00:00.000Z'),
            graceEndsAt: new Date('2026-12-20T03:00:00.000Z'),
            createdAt: new Date('2026-10-02T10:00:00.000Z'),
            planVersionId: PLAN_VERSION_ID,
            plan: {
                slug: 'venue-basico',
                name: 'venue-basico',
                amount: 500,
                currency: 'ARS',
                cycle: 'annual'
            },
            nextCharge: null,
            paidAfterCancellation: { recurringAddonsCut: true },
            pause: { reason: 'COURTESY', expectedEndAt: '2027-01-01T03:00:00.000Z' },
            promo: { endsAt: null },
            liveCourtesyMonths: 2,
            scheduledChange: { effectiveAt: '2026-12-15T03:00:00.000Z' },
            succession: {
                checkoutOpen: true,
                checkoutDeadline: '2026-11-30T03:00:00.000Z',
                successorId: SUCCESSOR_ID,
                checkoutUrl: null
            }
        }
    ];
}

/**
 * The `data` the route answered before the reader moved, serialized key for key
 * (the response schema fixes the key order). Captured by running this request
 * against the pre-extraction route (`read-own-subscriptions.ts`).
 */
const FROZEN_BODY = JSON.stringify({
    subscriptions: [
        {
            id: SUBSCRIPTION_ID,
            predecessorId: null,
            vertical: 'accommodation',
            status: 'ACTIVE',
            paymentMethod: 'CARD',
            serviceEndsAt: null,
            graceEndsAt: null,
            createdAt: '2026-10-01T10:00:00.000Z',
            paidAfterCancellation: null,
            pause: null,
            promo: null,
            liveCourtesyMonths: 0,
            succession: null,
            scheduledChange: null,
            plan: {
                slug: 'owner-pro',
                name: 'owner-pro',
                amount: 1000,
                currency: 'ARS',
                cycle: 'monthly'
            },
            nextCharge: { at: '2026-12-01T10:00:00.000Z', amount: 1000, currency: 'ARS' }
        },
        {
            id: SUCCESSOR_ID,
            predecessorId: SUBSCRIPTION_ID,
            vertical: 'venue',
            status: 'CANCEL_SCHEDULED',
            paymentMethod: 'MANUAL',
            serviceEndsAt: '2026-12-15T03:00:00.000Z',
            graceEndsAt: '2026-12-20T03:00:00.000Z',
            createdAt: '2026-10-02T10:00:00.000Z',
            paidAfterCancellation: { recurringAddonsCut: true },
            pause: { reason: 'COURTESY', expectedEndAt: '2027-01-01T03:00:00.000Z' },
            promo: { endsAt: null },
            liveCourtesyMonths: 2,
            succession: {
                checkoutOpen: true,
                checkoutDeadline: '2026-11-30T03:00:00.000Z',
                successorId: SUCCESSOR_ID,
                checkoutUrl: null
            },
            scheduledChange: { effectiveAt: '2026-12-15T03:00:00.000Z' },
            plan: {
                slug: 'venue-basico',
                name: 'venue-basico',
                amount: 500,
                currency: 'ARS',
                cycle: 'annual'
            },
            nextCharge: null
        }
    ],
    deferredCourtesies: [
        { courtesyGrantId: COURTESY_ID, vertical: 'accommodation', balanceMonths: 3 }
    ],
    declinedSignups: [
        {
            subscriptionId: SUBSCRIPTION_ID,
            vertical: 'venue',
            billingOptionId: OPTION_ID,
            declaredPayerEmail: null,
            declinedAt: '2026-11-01T10:00:00.000Z',
            plan: { slug: 'venue-pro', name: 'venue-pro' }
        }
    ],
    expiredDeclinedSignups: []
});

/** The protected read router behind a fixed, permitted owner. */
function app() {
    const result = new Hono<AppBindings>();
    result.use('*', (c, next) => {
        c.set('actor', {
            id: OWNER_ID,
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.BILLING_VIEW_OWN],
            emailVerified: true
        });
        return next();
    });
    result.route('/api/v1/protected/billing-subscription', protectedBillingSubscriptionReadRoutes);
    return result;
}

describe('GET /protected/billing-subscription/ after the reader extraction (AC-P1)', () => {
    beforeAll(() => {
        injectClock({ clock: { now: () => new Date('2026-11-19T12:00:00.000Z') } });
    });

    beforeEach(() => {
        mocks.readOwnExpiredDeclinedSignupNotices.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('answers byte for byte what it answered before, without the reader-only planVersionId', async () => {
        // Arrange
        mocks.readOwnPlanState.mockResolvedValue({
            subscriptions: readerRows(),
            deferredCourtesies: [
                { courtesyGrantId: COURTESY_ID, vertical: 'accommodation', balanceMonths: 3 }
            ]
        });
        mocks.readOwnDeclinedSignups.mockResolvedValue([
            {
                subscriptionId: SUBSCRIPTION_ID,
                vertical: 'venue',
                billingOptionId: OPTION_ID,
                declaredPayerEmail: null,
                declinedAt: new Date('2026-11-01T10:00:00.000Z'),
                plan: { slug: 'venue-pro', name: 'venue-pro' }
            }
        ]);

        // Act
        const response = await app().request('/api/v1/protected/billing-subscription', {
            headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' }
        });
        const body = (await response.json()) as { data?: unknown };

        // Assert
        expect(response.status).toBe(200);
        expect(mocks.readOwnPlanState).toHaveBeenCalledWith({
            userId: OWNER_ID,
            now: expect.any(Date),
            // HOS-2553: Mi suscripcion also shows the two unsettled states.
            includeUnsettled: true
        });
        expect(JSON.stringify(body.data)).toBe(FROZEN_BODY);
        expect(JSON.stringify(body.data)).not.toContain('planVersionId');
    });

    it('tells a declined signup once, through declinedSignups, never as a subscription row (HOS-2553)', async () => {
        // Arrange: the reader lists the decline (it passed the rule) and so does the notice
        const [active] = readerRows();
        mocks.readOwnPlanState.mockResolvedValue({
            subscriptions: [
                { ...active, id: SUCCESSOR_ID, status: 'CHARGE_DECLINED', nextCharge: null },
                active
            ],
            deferredCourtesies: []
        });
        mocks.readOwnDeclinedSignups.mockResolvedValue([
            {
                subscriptionId: SUCCESSOR_ID,
                vertical: 'accommodation',
                billingOptionId: OPTION_ID,
                declaredPayerEmail: null,
                declinedAt: new Date('2026-11-18T10:00:00.000Z'),
                plan: { slug: 'owner-pro', name: 'owner-pro' }
            }
        ]);

        // Act
        const response = await app().request('/api/v1/protected/billing-subscription', {
            headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' }
        });
        const body = (await response.json()) as {
            data: {
                subscriptions: { id: string; status: string }[];
                declinedSignups: { subscriptionId: string }[];
            };
        };

        // Assert
        expect(response.status).toBe(200);
        expect(body.data.subscriptions.map((row) => row.status)).toEqual(['ACTIVE']);
        expect(body.data.declinedSignups.map((notice) => notice.subscriptionId)).toEqual([
            SUCCESSOR_ID
        ]);
    });

    it('exposes the expired declined signups with an ISO declinedAt (HOS-2193)', async () => {
        // Arrange
        mocks.readOwnPlanState.mockResolvedValue({ subscriptions: [], deferredCourtesies: [] });
        mocks.readOwnDeclinedSignups.mockResolvedValue([]);
        mocks.readOwnExpiredDeclinedSignupNotices.mockResolvedValue([
            {
                subscriptionId: SUBSCRIPTION_ID,
                vertical: 'venue',
                declinedAt: new Date('2026-11-01T10:00:00.000Z'),
                plan: { slug: 'venue-pro', name: 'Pro' }
            }
        ]);

        // Act
        const response = await app().request('/api/v1/protected/billing-subscription', {
            headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' }
        });
        const body = (await response.json()) as { data: { expiredDeclinedSignups: unknown } };

        // Assert
        expect(response.status).toBe(200);
        expect(mocks.readOwnExpiredDeclinedSignupNotices).toHaveBeenCalledWith(OWNER_ID);
        expect(body.data.expiredDeclinedSignups).toEqual([
            {
                subscriptionId: SUBSCRIPTION_ID,
                vertical: 'venue',
                declinedAt: '2026-11-01T10:00:00.000Z',
                plan: { slug: 'venue-pro', name: 'Pro' }
            }
        ]);
    });
});
