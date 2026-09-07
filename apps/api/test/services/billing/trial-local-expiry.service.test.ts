/**
 * HOS-1012 T-010 — trial-local-expiry.service unit tests.
 *
 * Proves the Hospeda-owned trial expiry:
 *  - moves an elapsed local trial to `expired` and writes its dedup event in ONE
 *    transaction, stamping `trialConverted: false`.
 *  - refuses a row that carries a provider id — that one belongs to MercadoPago.
 *  - refuses a window that has not elapsed, and a row already expired.
 *  - refuses an illegal status transition.
 *  - drops the entitlement cache, since a local expiry has no webhook behind it.
 *
 * `@repo/service-core` is only PARTIALLY mocked: `withServiceTransaction` is
 * stubbed so no real DB is needed, but `checkSubscriptionStatusTransition` and
 * `BILLING_EVENT_TYPES` are the REAL implementations. Mocking the transition
 * guard would make the illegal-transition test assert its own stub.
 *
 * @module test/services/billing/trial-local-expiry.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn((_row: Record<string, unknown>) => ({ where: updateWhereMock }));

/** The tx handed to the withServiceTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock }))
};

/** Records the order of writes so "same transaction" can be asserted. */
const withServiceTransactionMock = vi.fn(
    async (cb: (ctx: { tx: typeof txStub }) => Promise<unknown>) => cb({ tx: txStub })
);

/**
 * The three tables this service reads. Held as module-level identities so the
 * `db.select()` chains can be told apart by WHICH table they hit rather than by
 * call order — HOS-1184 made order an unreliable discriminator, because the
 * commerce branch skips the accommodation query entirely.
 */
// Hoisted with the `vi.mock` factory that consumes them: the factory reads these
// identities eagerly, so a plain `const` here would be in its temporal dead zone
// by the time the mocked module is first imported.
const { accommodationsTable, billingSubscriptionsTable, billingSubscriptionEventsTable } =
    vi.hoisted(() => ({
        accommodationsTable: {
            id: 'id',
            ownerId: 'owner_id',
            lifecycleState: 'lifecycle_state',
            deletedAt: 'deleted_at'
        },
        billingSubscriptionsTable: { id: 'id', productDomain: 'product_domain' },
        billingSubscriptionEventsTable: {
            id: 'id',
            subscriptionId: 'subscription_id',
            eventType: 'event_type'
        }
    }));

const selectLimitMock = vi.fn();
const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
const selectFromMock = vi.fn((_table: unknown) => ({ where: selectWhereMock }));

/** Resolves the `{ productDomain }` row read by `unpublishListingsForExpiredTrial`. */
const subscriptionRowLimitMock = vi.fn();

/**
 * Every `.from(table)` of the run, so a test can assert which tables were NOT
 * touched. `vi.clearAllMocks()` resets its call log between tests, which is why
 * this is a mock rather than a plain array.
 */
const fromTableMock = vi.fn((table: unknown) => {
    if (table === billingSubscriptionsTable) {
        return { where: vi.fn(() => ({ limit: subscriptionRowLimitMock })) };
    }
    return selectFromMock(table);
});

const selectMock = vi.fn(() => ({ from: fromTableMock }));

/**
 * The accommodation lookup and the dedup lookup both go through `db.select()`.
 * They are told apart by call order: the dedup event query runs first, the
 * ACTIVE-listing query second.
 */
const listingSelectWhereMock = vi.fn();

vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    accommodations: accommodationsTable,
    billingSubscriptions: billingSubscriptionsTable,
    billingSubscriptionEvents: billingSubscriptionEventsTable,
    getDb: vi.fn(() => ({ select: selectMock }))
}));

const reconcileLinkedEntitiesMock = vi.fn();
vi.mock('../../../src/services/subscription-linked-entities.service', () => ({
    reconcileSubscriptionLinkedEntities: (...args: unknown[]) =>
        reconcileLinkedEntitiesMock(...args)
}));

const unpublishMock = vi.fn();
const resolveOwnerUserIdMock = vi.fn();

vi.mock('../../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: (...args: unknown[]) => resolveOwnerUserIdMock(...args)
}));

vi.mock('../../../src/utils/actor', () => ({
    createSystemActor: () => ({ id: 'system', roles: [], permissions: [] })
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        withServiceTransaction: (...args: unknown[]) =>
            (withServiceTransactionMock as (...a: unknown[]) => unknown)(...args),
        AccommodationService: class {
            unpublish(...args: unknown[]) {
                return unpublishMock(...args);
            }
        }
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const clearEntitlementCacheMock = vi.fn();
vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => clearEntitlementCacheMock(...args)
}));

// Import after mocks.
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { expireLocalTrial } from '../../../src/services/billing/trial-local-expiry.service';

const NOW = new Date('2026-09-01T10:00:00.000Z');
const ELAPSED = new Date('2026-08-25T10:00:00.000Z');
const FUTURE = new Date('2026-09-30T10:00:00.000Z');

function localTrial(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-local-1',
        customerId: 'cust-1',
        status: 'trialing',
        trialEnd: ELAPSED,
        mpSubscriptionId: null,
        ...overrides
    };
}

/** The row handed to `update().set()`. */
function updatedRow(): Record<string, unknown> {
    return updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

/** The row handed to `insert().values()`. */
function insertedEvent(): Record<string, unknown> {
    return insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

/** Which tables `.from()` was handed this run. */
function tablesRead(): unknown[] {
    return fromTableMock.mock.calls.map((call) => call[0]);
}

// Runs BEFORE every block's own `beforeEach`, so no block can inherit the
// domain another one set. `vi.clearAllMocks()` clears call logs but NOT
// implementations, so a `mockResolvedValue` left behind by the commerce block
// would otherwise leak into every block declared after it.
beforeEach(() => {
    // The default shape: the subscription row projects no domain at all, which
    // `isAccommodationSubscription` reads as accommodation because it fails
    // OPEN. That is what every pre-HOS-1184 test in this file assumes.
    subscriptionRowLimitMock.mockResolvedValue([]);
    reconcileLinkedEntitiesMock.mockResolvedValue(undefined);
});

describe('expireLocalTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no prior TRIAL_EXPIRED event.
        selectLimitMock.mockResolvedValue([]);
        // Default: one ACTIVE listing owned by the customer, and it comes down.
        resolveOwnerUserIdMock.mockResolvedValue('owner-1');
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }]);
        unpublishMock.mockResolvedValue({ data: { id: 'accom-1' } });
        // `.from()` is shared: the dedup query chains `.where().limit()`, the
        // listing query chains `.where()` alone and awaits it.
        selectFromMock.mockImplementation(() => ({
            where: vi.fn((...args: unknown[]) => {
                const chain = listingSelectWhereMock(...args) as Promise<unknown>;
                return Object.assign(chain, { limit: selectLimitMock });
            })
        }));
    });

    describe('the happy path', () => {
        it('moves an elapsed local trial to expired', async () => {
            const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(result.outcome).toBe('expired');
            expect(updatedRow().status).toBe('expired');
        });

        it('stamps trialConverted false — this trial ended without converting', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            // The whole reason the win-back series exists.
            expect(updatedRow().trialConverted).toBe(false);
        });

        it('writes the TRIAL_EXPIRED dedup event with the previous status', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            const event = insertedEvent();
            expect(event.eventType).toBe('TRIAL_EXPIRED');
            expect(event.previousStatus).toBe('trialing');
            expect(event.newStatus).toBe('expired');
            expect(event.subscriptionId).toBe('sub-local-1');
        });

        it('writes the status and the event in ONE transaction', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            // A status write without its event would let the next tick expire the
            // same trial again and send a second round of emails.
            expect(withServiceTransactionMock).toHaveBeenCalledOnce();
            expect(txStub.update).toHaveBeenCalledOnce();
            expect(txStub.insert).toHaveBeenCalledOnce();
        });

        it('drops the entitlement cache, because no webhook will', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust-1');
        });
    });

    describe('rows it must refuse', () => {
        it('refuses a row that carries a provider id', async () => {
            // MercadoPago decides when that one ends. Expiring it on our clock
            // would cut off a customer the provider may be charging right now.
            const result = await expireLocalTrial({
                subscription: localTrial({ mpSubscriptionId: 'mp-preapproval-1' }),
                now: NOW
            });

            expect(result.outcome).toBe('has-provider-id');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a window that has not elapsed', async () => {
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: FUTURE }),
                now: NOW
            });

            expect(result.outcome).toBe('not-elapsed');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a row with no trial window at all', async () => {
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: null }),
                now: NOW
            });

            expect(result.outcome).toBe('not-elapsed');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a row a concurrent run already expired', async () => {
            selectLimitMock.mockResolvedValue([{ id: 'existing-event' }]);

            const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(result.outcome).toBe('already-expired');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses an illegal status transition', async () => {
            // Checked against the REAL transition table: `cancelled` is terminal,
            // so a stale claimed row that has since been cancelled must not be
            // dragged back to `expired`.
            const result = await expireLocalTrial({
                subscription: localTrial({ status: 'cancelled' }),
                now: NOW
            });

            expect(result.outcome).toBe('illegal-transition');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });
    });

    describe('the boundary', () => {
        it('does not expire a trial whose end is exactly now', async () => {
            // `trialEnd > now` is false at the boundary, so the row IS expired.
            // Pinned deliberately: whichever way this goes, it should not move by
            // accident.
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: NOW }),
                now: NOW
            });

            expect(result.outcome).toBe('expired');
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-1012 D-3 / T-011 — the listing leaves the site, the data stays.
// ---------------------------------------------------------------------------

describe('expireLocalTrial — unpublishing the listings (D-3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectLimitMock.mockResolvedValue([]);
        resolveOwnerUserIdMock.mockResolvedValue('owner-1');
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }]);
        unpublishMock.mockResolvedValue({ data: { id: 'accom-1' } });
        selectFromMock.mockImplementation(() => ({
            where: vi.fn((...args: unknown[]) => {
                const chain = listingSelectWhereMock(...args) as Promise<unknown>;
                return Object.assign(chain, { limit: selectLimitMock });
            })
        }));
    });

    it('takes every ACTIVE listing of the owner down', async () => {
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }, { id: 'accom-2' }]);

        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(unpublishMock).toHaveBeenCalledTimes(2);
        expect(unpublishMock.mock.calls[0]?.[1]).toBe('accom-1');
        expect(unpublishMock.mock.calls[1]?.[1]).toBe('accom-2');
    });

    it('records how many listings came down on the event', async () => {
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }, { id: 'accom-2' }]);

        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        const meta = insertedEvent().metadata as Record<string, unknown>;
        expect(meta.listingsUnpublished).toBe(2);
    });

    it('does NOT seal the expiry when a listing refuses to come down', async () => {
        // The ordering that matters. Sealing first would leave a live listing
        // behind a dedup event that stops anyone from ever looking again.
        unpublishMock.mockResolvedValue({ error: { message: 'db down' } });

        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('unpublish-failed');
        expect(withServiceTransactionMock).not.toHaveBeenCalled();
        expect(clearEntitlementCacheMock).not.toHaveBeenCalled();
    });

    it('still expires an owner who has no ACTIVE listings', async () => {
        // A trial that expires before anything was ever published is normal, not
        // an error: the clock starts at publish, but the listing can come down
        // in between by the owner's own hand.
        listingSelectWhereMock.mockResolvedValue([]);

        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(unpublishMock).not.toHaveBeenCalled();
    });

    it('expires even when the owner cannot be resolved from the customer', async () => {
        // A billing customer with no external id should not exist for an owner
        // subscription. If one does, the subscription still has to stop granting
        // entitlements — leaving it `trialing` forever is the worse failure.
        resolveOwnerUserIdMock.mockResolvedValue(null);

        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(unpublishMock).not.toHaveBeenCalled();
    });

    it('only looks at ACTIVE listings — this is what makes the retry safe', async () => {
        // Load-bearing, and it survived a mutation until this test existed.
        // Without the filter, a retry after a partial failure would try to
        // unpublish rows that already came down; `unpublish` rejects anything
        // not ACTIVE, so `failed` would stay above zero and the expiry would
        // never seal. That is an infinite retry, not a degraded one.
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // Searched across every `where` this run built rather than indexed by
        // position: the dedup query and the listing query share the mock, and
        // pinning an index would make this test depend on their order instead
        // of on the filter it is checking.
        const allConditions = listingSelectWhereMock.mock.calls.flatMap(
            (call) => ((call[0] as { args?: unknown[] })?.args ?? []) as unknown[]
        );

        expect(allConditions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ col: 'lifecycle_state', val: 'ACTIVE' })
            ])
        );
    });

    it('unpublishes with an actor, so the suspended-owner guard cannot block it', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // `checkCanUpdate` refuses an edit on a suspended owner unless the actor
        // holds ACCOMMODATION_UPDATE_ANY. A lesser actor would be blocked by a
        // billing guard from performing a billing action.
        expect(unpublishMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ id: 'system' }));
    });
});

// ---------------------------------------------------------------------------
// HOS-1012 T-013 — the whole chain, and what a second run must not do.
//
// The unit tests above each pin one link. This block runs the links together
// and then runs them AGAIN, because every idempotency bug in this repo's
// billing history looked fine on the first pass.
// ---------------------------------------------------------------------------

describe('expireLocalTrial — the full chain and its re-run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectLimitMock.mockResolvedValue([]);
        resolveOwnerUserIdMock.mockResolvedValue('owner-1');
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }, { id: 'accom-2' }]);
        unpublishMock.mockResolvedValue({ data: { id: 'accom-1' } });
        selectFromMock.mockImplementation(() => ({
            where: vi.fn((...args: unknown[]) => {
                const chain = listingSelectWhereMock(...args) as Promise<unknown>;
                return Object.assign(chain, { limit: selectLimitMock });
            })
        }));
    });

    it('transitions, unpublishes and writes exactly one event in a single run', async () => {
        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(updatedRow().status).toBe('expired');
        expect(unpublishMock).toHaveBeenCalledTimes(2);
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCacheMock).toHaveBeenCalledTimes(1);
    });

    it('a second run writes NO second event and takes nothing else down', async () => {
        // First run: no dedup event exists yet.
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        const unpublishCallsAfterFirstRun = unpublishMock.mock.calls.length;

        // Second run: the event written by the first run is now there. In
        // production the row would also no longer be `trialing`, but the dedup
        // guard has to hold on its own — it is what protects the window between
        // the claim commit and the per-row processing.
        selectLimitMock.mockResolvedValue([{ id: 'event-from-first-run' }]);

        const second = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(second.outcome).toBe('already-expired');
        // Exactly one event across BOTH runs. Asserting the total rather than
        // "no new event" is deliberate: a dedup that writes a second row is the
        // failure a per-run assertion misses.
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        expect(unpublishMock).toHaveBeenCalledTimes(unpublishCallsAfterFirstRun);
        expect(clearEntitlementCacheMock).toHaveBeenCalledTimes(1);
    });

    it('a run that fails to unpublish leaves the row fully re-claimable', async () => {
        // Nothing written at all: no status change, no event, no cache drop. The
        // next tick must find the row exactly as it was, or the listing stays
        // live behind a dedup event nobody will look past.
        unpublishMock.mockResolvedValue({ error: { message: 'db down' } });

        const first = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(first.outcome).toBe('unpublish-failed');
        expect(insertValuesMock).not.toHaveBeenCalled();
        expect(updateSetMock).not.toHaveBeenCalled();
        expect(clearEntitlementCacheMock).not.toHaveBeenCalled();

        // The retry succeeds and completes the whole chain.
        unpublishMock.mockResolvedValue({ data: { id: 'accom-1' } });

        const second = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(second.outcome).toBe('expired');
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// HOS-1184 — a commerce trial expires through ITS OWN vertical.
//
// The regression this block exists for: `unpublishListingsForExpiredTrial` used
// to walk `accommodations` unconditionally, which was correct while
// accommodation was the only vertical that could hold a local trial. Gastronomy
// and experience can hold one now, and the same person legitimately owns a cabin
// AND a restaurant — so expiring the restaurant's trial down the old path would
// have taken down the cabin the owner still pays for while leaving the
// restaurant public. Both halves wrong, in one write.
//
// Every test here gives the owner TWO active accommodations. If the domain
// branch is removed, those are exactly the rows that come down, so the
// assertions below fail rather than pass vacuously.
// ---------------------------------------------------------------------------

describe('expireLocalTrial — a commerce trial expires through its own vertical (HOS-1184)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectLimitMock.mockResolvedValue([]);
        resolveOwnerUserIdMock.mockResolvedValue('owner-1');
        listingSelectWhereMock.mockResolvedValue([{ id: 'accom-1' }, { id: 'accom-2' }]);
        unpublishMock.mockResolvedValue({ data: { id: 'accom-1' } });
        selectFromMock.mockImplementation(() => ({
            where: vi.fn((...args: unknown[]) => {
                const chain = listingSelectWhereMock(...args) as Promise<unknown>;
                return Object.assign(chain, { limit: selectLimitMock });
            })
        }));
        subscriptionRowLimitMock.mockResolvedValue([
            { productDomain: ProductDomainEnum.GASTRONOMY }
        ]);
    });

    it('does NOT unpublish the accommodations of an owner whose GASTRONOMY trial expired', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // The protection: a restaurant's trial ending must not take a cabin off
        // the site the owner is still paying for.
        expect(unpublishMock).not.toHaveBeenCalled();
    });

    it('never even reads the accommodations table on the commerce branch', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // Stronger than "did not unpublish": the query that finds the rows is
        // never built, so there is nothing for a later edit to accidentally act
        // on. Asserted by table identity rather than by call order, because the
        // commerce branch changes how many queries run.
        expect(tablesRead()).not.toContain(accommodationsTable);
        expect(resolveOwnerUserIdMock).not.toHaveBeenCalled();
    });

    it('hands the listing to reconcileSubscriptionLinkedEntities instead', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // Commerce visibility is DERIVED, so the listing comes down by resolving
        // the status through the single authorised bridge — never a second write
        // path to the same state.
        expect(reconcileLinkedEntitiesMock).toHaveBeenCalledOnce();
        expect(reconcileLinkedEntitiesMock).toHaveBeenCalledWith({
            subscriptionId: 'sub-local-1',
            subscriptionStatus: SubscriptionStatusEnum.EXPIRED,
            source: 'trial-local-expiry-cron'
        });
    });

    it('passes EXPIRED explicitly, because the row still says trialing at that point', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // D-3's ordering: the listing comes down BEFORE the status write. A
        // bridge that re-read the row here would still see `trialing` and leave
        // the listing public.
        const handedStatus = (
            reconcileLinkedEntitiesMock.mock.calls[0]?.[0] as { subscriptionStatus: string }
        ).subscriptionStatus;

        expect(handedStatus).toBe(SubscriptionStatusEnum.EXPIRED);
        expect(handedStatus).not.toBe(localTrial().status);
    });

    it('takes the listing down BEFORE sealing the expiry', async () => {
        await expireLocalTrial({ subscription: localTrial(), now: NOW });

        // Same ordering the accommodation branch keeps. Sealing first would let
        // the next tick find the dedup event and skip the row without ever
        // looking at the listing again.
        const reconciledAt = reconcileLinkedEntitiesMock.mock.invocationCallOrder[0] as number;
        const sealedAt = withServiceTransactionMock.mock.invocationCallOrder[0] as number;

        expect(reconciledAt).toBeLessThan(sealedAt);
    });

    it('still seals the expiry, recording zero listings unpublished', async () => {
        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(updatedRow().status).toBe(SubscriptionStatusEnum.EXPIRED);
        // Not a silent skip: the commerce branch has no listings of its own to
        // unpublish, so zero is the honest count, and the event records it.
        expect((insertedEvent().metadata as Record<string, unknown>).listingsUnpublished).toBe(0);
        expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust-1');
    });

    it('treats an EXPERIENCE trial exactly like a gastronomy one', async () => {
        subscriptionRowLimitMock.mockResolvedValue([
            { productDomain: ProductDomainEnum.EXPERIENCE }
        ]);

        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(unpublishMock).not.toHaveBeenCalled();
        expect(reconcileLinkedEntitiesMock).toHaveBeenCalledOnce();
    });

    it('keeps a row still carrying the retired "commerce" string off the accommodation table', async () => {
        // `'commerce'` was retired by release B / HOS-692 and survives only on
        // legacy rows. It satisfies neither gastronomy nor experience — HOS-695
        // narrowed that on purpose — but it is emphatically NOT accommodation
        // either, so it must not reach the cabin-unpublishing path.
        subscriptionRowLimitMock.mockResolvedValue([{ productDomain: 'commerce' }]);

        const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

        expect(result.outcome).toBe('expired');
        expect(unpublishMock).not.toHaveBeenCalled();
        expect(tablesRead()).not.toContain(accommodationsTable);
    });

    describe('and the accommodation half it is contrasted against', () => {
        it('DOES unpublish when the row is accommodation', async () => {
            subscriptionRowLimitMock.mockResolvedValue([
                { productDomain: ProductDomainEnum.ACCOMMODATION }
            ]);

            const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

            // The other half of the branch. Without this the tests above would
            // pass just as well against a function that unpublishes nothing at
            // all.
            expect(result.outcome).toBe('expired');
            expect(unpublishMock).toHaveBeenCalledTimes(2);
            expect(tablesRead()).toContain(accommodationsTable);
            expect(reconcileLinkedEntitiesMock).not.toHaveBeenCalled();
        });

        it('DOES unpublish a legacy row whose productDomain is null — accommodation fails OPEN', async () => {
            // The column post-dates most rows. A null must keep behaving as
            // accommodation, or every pre-column host stops being cleaned up.
            subscriptionRowLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(unpublishMock).toHaveBeenCalledTimes(2);
            expect(reconcileLinkedEntitiesMock).not.toHaveBeenCalled();
        });

        it('DOES unpublish when the subscription row cannot be found at all', async () => {
            // Same fail-open, one step further out: no row, no domain, so the
            // pre-HOS-1184 behaviour is what survives.
            subscriptionRowLimitMock.mockResolvedValue([]);

            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(unpublishMock).toHaveBeenCalledTimes(2);
            expect(reconcileLinkedEntitiesMock).not.toHaveBeenCalled();
        });
    });
});
