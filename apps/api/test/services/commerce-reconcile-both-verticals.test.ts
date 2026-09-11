/**
 * commerce-reconcile-both-verticals.test.ts (HOS-1181 vertical coverage)
 *
 * The win-back fix itself is accommodation-only (commerce visibility is
 * DERIVED from the subscription status, so a commerce listing never needs a
 * republish marker). What this file proves is the neighbouring half of the
 * same user journey: a gastronomy AND an experience listing that a trial
 * expiry took down BOTH come back through the one bridge when the payment's
 * reconcile arrives — the wiring half of the three-vertical coverage, with
 * the visibility flip itself pinned in
 * `packages/service-core/test/services/commerce/commerce-visibility.test.ts`
 * ("active status → PUBLIC + ACTIVE from an INACTIVE listing").
 *
 * Without this file, an accommodation-only regression suite could sit next
 * to a commerce half that silently stopped reconciling one of its two
 * verticals — `resolveCommerceEntityModel`'s switch has a `default` that
 * throws, but nothing here at the call-site level would notice a dropped
 * entityType in the link-row query.
 *
 * @module test/services/commerce-reconcile-both-verticals
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { entitySubscriptionsTable, gastronomyIdentity, experienceIdentity } = vi.hoisted(() => ({
    entitySubscriptionsTable: {
        entityType: 'entity_type',
        entityId: 'entity_id',
        subscriptionId: 'subscription_id',
        planRestricted: 'plan_restricted',
        status: 'status'
    },
    gastronomyIdentity: { model: 'gastronomy' },
    experienceIdentity: { model: 'experience' }
}));

/** The link-row read: `select(...).from(entitySubscriptions).where(...)`. */
const linkRowsWhereMock = vi.fn();

/** The link-row status sync: `update(entitySubscriptions).set(...).where(...)`. */
const linkStatusSetMock = vi.fn();

vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({ where: (...args: unknown[]) => linkRowsWhereMock(...args) }))
        })),
        update: vi.fn(() => ({
            set: (data: Record<string, unknown>) => {
                linkStatusSetMock(data);
                return { where: vi.fn(() => Promise.resolve()) };
            }
        }))
    })),
    entitySubscriptions: entitySubscriptionsTable,
    gastronomyModel: gastronomyIdentity,
    experienceModel: experienceIdentity
}));

/** Captures every visibility reconcile, so each vertical's call can be told apart. */
const visibilityReconcileMock = vi.fn().mockResolvedValue({
    updated: true,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE'
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        reconcileCommerceListingVisibility: (...args: unknown[]) => visibilityReconcileMock(...args)
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Import after mocks.
import { reconcileCommerceListingForSubscription } from '../../src/services/commerce-reconcile.service';

beforeEach(() => {
    vi.clearAllMocks();
    // The recovery path (no link rows) is NOT under test here — every call
    // below has link rows, so `readSubscriptionDomainMetadata` never runs.
    visibilityReconcileMock.mockResolvedValue({
        updated: true,
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE'
    });
});

describe('a paid subscription drives BOTH commerce verticals back through the bridge', () => {
    it('reconciles the GASTRONOMY listing with the gastronomy model and the new status', async () => {
        linkRowsWhereMock.mockResolvedValue([
            { entityType: 'gastronomy', entityId: 'gastro-1', planRestricted: false }
        ]);

        await reconcileCommerceListingForSubscription({
            subscriptionId: 'sub-paid-gastro',
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        expect(visibilityReconcileMock).toHaveBeenCalledTimes(1);
        const input = visibilityReconcileMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(input.entityType).toBe('gastronomy');
        expect(input.entityId).toBe('gastro-1');
        expect(input.subscriptionStatus).toBe('active');
        // The model resolved for the vertical, not a shared one.
        expect(visibilityReconcileMock.mock.calls[0]?.[1]).toBe(gastronomyIdentity);
    });

    it('reconciles the EXPERIENCE listing with the experience model — same payment, same pass', async () => {
        linkRowsWhereMock.mockResolvedValue([
            { entityType: 'gastronomy', entityId: 'gastro-1', planRestricted: false },
            { entityType: 'experience', entityId: 'exp-1', planRestricted: false }
        ]);

        await reconcileCommerceListingForSubscription({
            subscriptionId: 'sub-paid-both',
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        // One owner can hold both verticals; both listings come back in the
        // SAME reconcile pass.
        expect(visibilityReconcileMock).toHaveBeenCalledTimes(2);
        const byType = visibilityReconcileMock.mock.calls.map(
            (call) => (call[0] as Record<string, unknown>).entityType
        );
        expect(byType).toEqual(['gastronomy', 'experience']);

        const experienceModel = visibilityReconcileMock.mock.calls[1]?.[1];
        expect(experienceModel).toBe(experienceIdentity);
    });

    it('syncs the link rows to the NEW status before reconciling visibility', async () => {
        linkRowsWhereMock.mockResolvedValue([
            { entityType: 'gastronomy', entityId: 'gastro-1', planRestricted: false }
        ]);

        await reconcileCommerceListingForSubscription({
            subscriptionId: 'sub-paid-gastro',
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        // The denormalized status is what the fast public reads see; it must
        // not keep saying `expired` for a listing whose owner just paid.
        expect(linkStatusSetMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'active' })
        );
    });
});
