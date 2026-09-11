/**
 * accommodation-winback-republish.service.test.ts (HOS-1181)
 *
 * The regression this file exists for, in one sentence: a host's trial
 * expired, the cron took their listing down, they paid days later — and
 * nothing ever brought the listing back, while two win-back emails promised
 * it would come back on its own.
 *
 * What has to hold, in the order the tests pin it:
 *
 * 1. A billing-unpublished listing IS republished once the owner's
 *    re-derived accommodation subscription is entitlement-granting (they
 *    paid).
 * 2. The owner's OWN unpublish never comes back — the selection requires the
 *    billing marker, which only the trial-expiry cron sets.
 * 3. A DRAFT the owner deliberately kept back never appears online because
 *    they paid — even one carrying a stale marker, which is cleared instead.
 * 4. The gate re-derives the owner's subscription from the database; the
 *    status the reconciler was handed never decides anything here.
 * 5. A refusal (incomplete listing) is loud and keeps the marker for a retry,
 *    and the whole pass never throws, no matter what breaks.
 *
 * `isEntitlementGrantingStatus` is the REAL implementation — mocking the gate
 * would make test 4 assert its own stub.
 *
 * @module test/services/accommodation-winback-republish.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { accommodationsTable } = vi.hoisted(() => ({
    accommodationsTable: {
        id: 'id',
        ownerId: 'owner_id',
        lifecycleState: 'lifecycle_state',
        deletedAt: 'deleted_at',
        billingUnpublishedAt: 'billing_unpublished_at'
    }
}));

/**
 * The marked-rows read of one pass. Handed to `.from(accommodations).where()`.
 * A single slot rather than a per-call queue: the service runs exactly one
 * marked-rows query per pass, and a queue would let an extra query pass
 * unnoticed.
 */
const markedRowsWhereMock = vi.fn();

/** The stale-marker bulk clear: `update(accommodations).set(...).where(...)`. */
const staleClearSetMock = vi.fn();
const staleClearWhereMock = vi.fn(() => Promise.resolve());

vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    isNotNull: vi.fn((col: unknown) => ({ op: 'isNotNull', col })),
    inArray: vi.fn((col: unknown, val: unknown) => ({ op: 'inArray', col, val })),
    accommodations: accommodationsTable,
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({ where: (...args: unknown[]) => markedRowsWhereMock(...args) }))
        })),
        update: vi.fn(() => ({
            set: (data: Record<string, unknown>) => {
                staleClearSetMock(data);
                return { where: staleClearWhereMock };
            }
        }))
    }))
}));

const resolveSubscriptionOwnerIdMock = vi.fn();
const deriveOwnerAccommodationSubscriptionMock = vi.fn();

vi.mock('../../src/services/entity-subscription-cache.service', () => ({
    resolveSubscriptionOwnerId: (...args: unknown[]) => resolveSubscriptionOwnerIdMock(...args),
    deriveOwnerAccommodationSubscription: (...args: unknown[]) =>
        deriveOwnerAccommodationSubscriptionMock(...args)
}));

const publishMock = vi.fn();

vi.mock('@repo/service-core', () => ({
    AccommodationService: class {
        publish(...args: unknown[]) {
            return publishMock(...args);
        }
    }
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: () => null
}));

vi.mock('../../src/services/accommodation-publish-deps', () => ({
    buildAccommodationPublishDeps: () => ({})
}));

vi.mock('../../src/utils/actor', () => ({
    createSystemActor: () => ({ id: 'system', roles: [], permissions: [] })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Import after mocks.
import { LifecycleStatusEnum } from '@repo/schemas';
import { republishBillingUnpublishedAccommodations } from '../../src/services/accommodation-winback-republish.service';

const SUBSCRIPTION_ID = 'sub-paid-1';

/** A marked row as the marked-rows query returns it. */
function markedRow(id: string, lifecycleState: string) {
    return { id, lifecycleState };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: an owner with one billing-unpublished listing, and a paid
    // (entitlement-granting) accommodation subscription.
    resolveSubscriptionOwnerIdMock.mockResolvedValue('owner-1');
    markedRowsWhereMock.mockResolvedValue([markedRow('acc-1', LifecycleStatusEnum.INACTIVE)]);
    deriveOwnerAccommodationSubscriptionMock.mockResolvedValue({
        id: 'sub-live-1',
        status: 'active',
        planId: 'plan-1'
    });
    publishMock.mockResolvedValue({ data: { id: 'acc-1' } });
    staleClearWhereMock.mockResolvedValue(undefined);
});

describe('republishBillingUnpublishedAccommodations (HOS-1181)', () => {
    it('republishes a billing-unpublished listing once the owner pays', async () => {
        // THE regression: expired trial → cron took the listing down → the
        // owner converts days later → the payment's reconcile must bring the
        // listing back. Before HOS-1181 nothing did, and the win-back emails
        // had already promised it would.
        const result = await republishBillingUnpublishedAccommodations({
            subscriptionId: SUBSCRIPTION_ID,
            source: 'mp-webhook'
        });

        expect(publishMock).toHaveBeenCalledTimes(1);
        expect(publishMock.mock.calls[0]?.[1]).toBe('acc-1');
        expect(result.republished).toBe(1);
        expect(result.failed).toBe(0);
        expect(result.pending).toBe(0);
    });

    it('publishes with the SYSTEM actor, so a suspended-owner guard cannot block the republish', async () => {
        await republishBillingUnpublishedAccommodations({
            subscriptionId: SUBSCRIPTION_ID,
            source: 'mp-webhook'
        });

        // Same reason the expiry cron unpublishes with a system actor:
        // checkCanUpdate would otherwise let a billing guard block a billing
        // action.
        expect(publishMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ id: 'system' }));
    });

    it('selects ONLY marker rows — the owner-paused listing is invisible to the win-back', async () => {
        // The load-bearing filter. An INACTIVE row without the marker is the
        // one its OWNER paused on purpose; it must never come back because
        // they paid. This pins the WHERE itself, not the mock's return: delete
        // the isNotNull condition in the service and this goes red.
        await republishBillingUnpublishedAccommodations({
            subscriptionId: SUBSCRIPTION_ID,
            source: 'mp-webhook'
        });

        const conditions = (markedRowsWhereMock.mock.calls[0]?.[0] as { args: unknown[] }).args as {
            op: string;
            col: unknown;
            val?: unknown;
        }[];

        expect(conditions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    op: 'eq',
                    col: accommodationsTable.ownerId,
                    val: 'owner-1'
                }),
                expect.objectContaining({
                    op: 'isNotNull',
                    col: accommodationsTable.billingUnpublishedAt
                }),
                expect.objectContaining({ op: 'isNull', col: accommodationsTable.deletedAt })
            ])
        );
    });

    it('never reads the owner at all when the subscription resolves to nobody', async () => {
        resolveSubscriptionOwnerIdMock.mockResolvedValue(null);

        const result = await republishBillingUnpublishedAccommodations({
            subscriptionId: 'sub-ghost',
            source: 'mp-webhook'
        });

        expect(markedRowsWhereMock).not.toHaveBeenCalled();
        expect(result).toEqual({
            republished: 0,
            failed: 0,
            clearedStale: 0,
            pending: 0
        });
    });

    it('returns before deriving anything when the owner has no marked rows (the common case)', async () => {
        markedRowsWhereMock.mockResolvedValue([]);

        const result = await republishBillingUnpublishedAccommodations({
            subscriptionId: SUBSCRIPTION_ID,
            source: 'dunning-cron'
        });

        // The cheap path that makes it safe to hang the win-back off EVERY
        // reconcile, not just the payment: no markers → no derivation, no
        // publish, nothing.
        expect(deriveOwnerAccommodationSubscriptionMock).not.toHaveBeenCalled();
        expect(publishMock).not.toHaveBeenCalled();
        expect(result.republished).toBe(0);
    });

    describe('the re-derived gate', () => {
        it('does NOT republish while the owner holds no entitlement-granting accommodation subscription', async () => {
            // They have not paid yet (or the payment's webhook has not
            // landed): the markers stay pending and the next reconcile
            // re-evaluates.
            deriveOwnerAccommodationSubscriptionMock.mockResolvedValue({
                id: 'sub-expired-1',
                status: 'expired',
                planId: 'plan-1'
            });

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: SUBSCRIPTION_ID,
                source: 'mp-webhook'
            });

            expect(publishMock).not.toHaveBeenCalled();
            expect(result.pending).toBe(1);
            expect(result.republished).toBe(0);
            // No marker was cleared either — a pending candidate stays one.
            expect(staleClearSetMock).not.toHaveBeenCalled();
        });

        it('ignores the status the caller handed the bridge — only the re-derived answer decides', async () => {
            // A caller-driven status cannot be passed today (the input is
            // subscriptionId + source only), so the way to pin "the handed
            // status never decides" is the reverse: the reconciler may be
            // running for ANY subscription event of this owner — including a
            // down-transition like a cancellation — and the win-back still
            // republishes if the re-derived subscription is granting. That is
            // the self-healing property: a dropped activation webhook is
            // corrected by whatever lifecycle event arrives next.
            deriveOwnerAccommodationSubscriptionMock.mockResolvedValue({
                id: 'sub-live-1',
                status: 'active',
                planId: 'plan-1'
            });

            // The subscriptionId points at a DIFFERENT, cancelled
            // subscription of the same owner — the derive mock answers from
            // the owner, which is what the real derivation does.
            resolveSubscriptionOwnerIdMock.mockResolvedValue('owner-1');

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: 'sub-cancelled-other',
                source: 'finalize-cancelled-cron'
            });

            expect(publishMock).toHaveBeenCalledTimes(1);
            expect(result.republished).toBe(1);
        });
    });

    describe('stale markers on rows billing no longer owns', () => {
        it('clears a marker left on a DRAFT and does NOT publish it', async () => {
            // The "worse bug" the issue names: a listing the owner had in
            // draft ON PURPOSE cannot appear online because they paid. The
            // strong form: even a draft that somehow carries a stale marker is
            // treated as deliberately withdrawn — cleared, never published.
            markedRowsWhereMock.mockResolvedValue([
                markedRow('acc-live', LifecycleStatusEnum.INACTIVE),
                markedRow('acc-draft', LifecycleStatusEnum.DRAFT)
            ]);

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: SUBSCRIPTION_ID,
                source: 'mp-webhook'
            });

            expect(publishMock).toHaveBeenCalledTimes(1);
            expect(publishMock.mock.calls[0]?.[1]).toBe('acc-live');
            expect(result.clearedStale).toBe(1);
            expect(result.republished).toBe(1);

            // The bulk clear wrote a null marker, scoped to the stale row.
            expect(staleClearSetMock).toHaveBeenCalledWith({
                billingUnpublishedAt: null
            });
            expect(staleClearWhereMock).toHaveBeenCalledOnce();
        });

        it('clears a marker left on an ACTIVE row and never derives or publishes', async () => {
            // A publish should have cleared it (the marker's own invariant);
            // if one survives anyway, the sweep is what keeps it from later
            // republishing a listing its owner has since deliberately
            // unpublished.
            markedRowsWhereMock.mockResolvedValue([
                markedRow('acc-active', LifecycleStatusEnum.ACTIVE)
            ]);

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: SUBSCRIPTION_ID,
                source: 'mp-webhook'
            });

            expect(publishMock).not.toHaveBeenCalled();
            expect(deriveOwnerAccommodationSubscriptionMock).not.toHaveBeenCalled();
            expect(result.clearedStale).toBe(1);
        });
    });

    describe('when publish refuses', () => {
        it('counts the refusal, keeps the marker and never throws', async () => {
            // A listing whose photos were removed while paused: publish()'s
            // completeness gate refuses, and that is the right outcome — a
            // broken public page would be worse. The refusal is loud and the
            // marker survives for the next reconcile to retry.
            publishMock.mockResolvedValue({
                error: { code: 'VALIDATION_ERROR', message: 'missing main image' }
            });

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: SUBSCRIPTION_ID,
                source: 'mp-webhook'
            });

            expect(result.republished).toBe(0);
            expect(result.failed).toBe(1);
            // No marker was cleared for the refused row.
            expect(staleClearSetMock).not.toHaveBeenCalled();
        });

        it('swallows an unexpected throw and reports zero — the bridge must not break', async () => {
            // The reconciler runs from the MP webhook and every billing cron;
            // a broken republish pass must never break the caller that
            // triggered it. The markers are intact, so the next pass retries.
            publishMock.mockRejectedValue(new Error('db connection lost'));

            const result = await republishBillingUnpublishedAccommodations({
                subscriptionId: SUBSCRIPTION_ID,
                source: 'mp-webhook'
            });

            expect(result).toEqual({
                republished: 0,
                failed: 0,
                clearedStale: 0,
                pending: 0
            });
        });
    });

    it('republishes every marked listing of the owner, not just one', async () => {
        // A multi-property host: the trial took the whole portfolio down, and
        // the whole portfolio comes back.
        markedRowsWhereMock.mockResolvedValue([
            markedRow('acc-1', LifecycleStatusEnum.INACTIVE),
            markedRow('acc-2', LifecycleStatusEnum.INACTIVE),
            markedRow('acc-3', LifecycleStatusEnum.INACTIVE)
        ]);

        const result = await republishBillingUnpublishedAccommodations({
            subscriptionId: SUBSCRIPTION_ID,
            source: 'mp-webhook'
        });

        expect(publishMock).toHaveBeenCalledTimes(3);
        expect(publishMock.mock.calls.map((call) => call[1])).toEqual(['acc-1', 'acc-2', 'acc-3']);
        expect(result.republished).toBe(3);
    });
});
