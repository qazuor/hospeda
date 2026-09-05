/**
 * @fileoverview
 * Regression tests for `reconcileCommerceListingForSubscription` — the
 * double-click orphan (residual of the HOS-191 Path C migration, PR #2832).
 *
 * Path C creates one `pending_provider` subscription per CHECKOUT CLICK, not
 * per payment, and the domain link row (`entity_subscriptions`,
 * UNIQUE on `(entity_type, entity_id)`) is UPSERTED, so it always points at the
 * LAST click. A buyer who double-clicks "Publicar y pagar" and then completes
 * the FIRST share link leaves the reconciler looking for a link row that points
 * at `subA` while the row points at `subB`: zero links found, early return, and
 * the listing stays PRIVATE with a live MercadoPago charge against it.
 *
 * The invariant pinned here: **a completed payment publishes its listing, no
 * matter how many checkouts were started before it or in which order they are
 * completed.** Plus the inverse an eager fix breaks — a NON-publishing status on
 * a superseded subscription must never steal the row back or unpublish the
 * listing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    /** Rows returned when selecting link rows BY `subscription_id`. */
    linkRows: [] as Array<{ entityType: string; entityId: string; planRestricted?: boolean }>,
    /** Rows returned when selecting the link row BY `(entity_type, entity_id)`. */
    holderRows: [] as Array<{ subscriptionId: string; status: string }>,
    /** Rows returned when selecting the `billing_subscriptions` row. */
    subscriptionRows: [] as Array<{ metadata: Record<string, unknown> | null }>,
    /** Every `.update().set()` payload, in call order. */
    updates: [] as Array<{ table: unknown; payload: Record<string, unknown> }>,
    /** Every `.insert().values()` payload, in call order. */
    inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    /** Every `.onConflictDoUpdate()` config, in call order. */
    conflicts: [] as Array<{ target: unknown; set: Record<string, unknown> }>
}));

const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
}));

const reconcileVisibilityMock = vi.hoisted(() =>
    vi.fn(
        async (_input: {
            entityType: string;
            entityId: string;
            subscriptionStatus: string;
            planRestricted?: boolean;
        }) => ({
            updated: true,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        })
    )
);

vi.mock('@repo/db', () => {
    const entitySubscriptions = {
        subscriptionId: 'commerce.subscription_id',
        entityType: 'commerce.entity_type',
        entityId: 'commerce.entity_id',
        status: 'commerce.status',
        planRestricted: 'commerce.plan_restricted'
    };
    const billingSubscriptions = {
        id: 'billing.id',
        metadata: 'billing.metadata'
    };

    /**
     * A link-row select filtered by `(entity_type, entity_id)` arrives as an
     * `and(...)` predicate; one filtered by `subscription_id` arrives as a bare
     * `eq(...)`. That is the only signal needed to tell the two reads apart.
     */
    const rowsFor = (table: unknown, condition: unknown): unknown[] => {
        if (table === billingSubscriptions) {
            return state.subscriptionRows;
        }
        if (condition && typeof condition === 'object' && 'and' in condition) {
            return state.holderRows;
        }
        return state.linkRows;
    };

    return {
        getDb: () => ({
            select: () => ({
                from: (table: unknown) => ({
                    where: (condition: unknown) => {
                        const rows = rowsFor(table, condition);
                        return Object.assign(Promise.resolve(rows), {
                            limit: () => Promise.resolve(rows)
                        });
                    }
                })
            }),
            update: (table: unknown) => ({
                set: (payload: Record<string, unknown>) => {
                    state.updates.push({ table, payload });
                    return { where: () => Promise.resolve(undefined) };
                }
            }),
            insert: (table: unknown) => ({
                values: (values: Record<string, unknown>) => {
                    state.inserts.push({ table, values });
                    return {
                        onConflictDoUpdate: (config: {
                            target: unknown;
                            set: Record<string, unknown>;
                        }) => {
                            state.conflicts.push(config);
                            return Promise.resolve(undefined);
                        }
                    };
                }
            })
        }),
        entitySubscriptions,
        billingSubscriptions,
        gastronomyModel: { findById: vi.fn(async () => null), update: vi.fn() },
        experienceModel: { findById: vi.fn(async () => null), update: vi.fn() },
        gastronomyMediaModel: { findAll: vi.fn(async () => ({ items: [] })) },
        experienceMediaModel: { findAll: vi.fn(async () => ({ items: [] })) },
        // Re-exported by @repo/db (the service imports them from there, NOT from
        // 'drizzle-orm'). Opaque predicate builders for this test — the shape is
        // what `rowsFor` above discriminates on.
        and: (...args: unknown[]) => ({ and: args }),
        eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
    };
});

vi.mock('@repo/service-core', () => ({
    reconcileCommerceListingVisibility: reconcileVisibilityMock,
    composeCommerceMedia: vi.fn(() => ({}))
}));

vi.mock('../../src/utils/logger', () => ({ apiLogger: loggerMock }));

import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { reconcileCommerceListingForSubscription } from '../../src/services/commerce-reconcile.service';

const SUB_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const SUB_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const ENTITY_ID = 'cccccccc-0000-4000-8000-00000000000c';
const ENTITY_TYPE = 'gastronomy';

beforeEach(() => {
    state.linkRows = [];
    state.holderRows = [];
    state.subscriptionRows = [];
    state.updates.length = 0;
    state.inserts.length = 0;
    state.conflicts.length = 0;
    vi.clearAllMocks();
});

describe('reconcileCommerceListingForSubscription — double-click orphan', () => {
    it('publishes the listing when the completed subscription is NOT the one the link row points at', async () => {
        // Arrange — two clicks: subA then subB. The link row was upserted onto
        // subB, so nothing points at subA. The buyer completes subA's share
        // link (still valid) and MercadoPago activates subA.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            {
                metadata: {
                    source: 'start-paid-share-link',
                    commerceEntityType: ENTITY_TYPE,
                    commerceEntityId: ENTITY_ID
                }
            }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert — the listing was reconciled (published), not skipped.
        expect(reconcileVisibilityMock).toHaveBeenCalledTimes(1);
        const call = reconcileVisibilityMock.mock.calls[0]?.[0];
        expect(call?.entityType).toBe(ENTITY_TYPE);
        expect(call?.entityId).toBe(ENTITY_ID);
        expect(call?.subscriptionStatus).toBe(SubscriptionStatusEnum.ACTIVE);
    });

    it('re-points the link row at the subscription that was actually paid', async () => {
        // Arrange — same double-click state as above.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            {
                metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID }
            }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert — the row now points at subA, at the paid status, so every
        // later lifecycle event for subA (dunning, cancel) finds it.
        expect(state.inserts).toHaveLength(1);
        expect(state.inserts[0]?.values.subscriptionId).toBe(SUB_A);
        expect(state.inserts[0]?.values.entityType).toBe(ENTITY_TYPE);
        expect(state.inserts[0]?.values.entityId).toBe(ENTITY_ID);
        expect(state.inserts[0]?.values.productDomain).toBe(ProductDomainEnum.GASTRONOMY);
        expect(state.conflicts).toHaveLength(1);
        expect(state.conflicts[0]?.set.subscriptionId).toBe(SUB_A);
        expect(state.conflicts[0]?.set.status).toBe(SubscriptionStatusEnum.ACTIVE);
    });

    it('derives productDomain from the recovered entityType — experience gets EXPERIENCE, not the gastronomy value the other case asserts', async () => {
        // Arrange — same double-click shape, but the recovered link row's
        // entityType is 'experience' this time. A test that only ever checks
        // 'gastronomy' can't tell "derives from entityType" apart from "now
        // hardcodes gastronomy instead of commerce" — this is the case that
        // tells them apart.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            {
                metadata: { commerceEntityType: 'experience', commerceEntityId: ENTITY_ID }
            }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert
        expect(state.inserts).toHaveLength(1);
        expect(state.inserts[0]?.values.entityType).toBe('experience');
        expect(state.inserts[0]?.values.productDomain).toBe(ProductDomainEnum.EXPERIENCE);
    });

    it('does NOT silently treat an unrecognized commerceEntityType as experience (HOS-1079)', async () => {
        // Arrange — corrupted/foreign metadata: an entityType that is neither
        // 'gastronomy' nor 'experience'. Before HOS-1079 the binary ternary
        // computing `productDomain` silently answered
        // `ProductDomainEnum.EXPERIENCE` for any value that was not literally
        // 'gastronomy' — 'accommodation' included.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: 'accommodation', commerceEntityId: ENTITY_ID } }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert — the recovery is refused rather than mislabeled: nothing
        // written, nothing reconciled. The function's own non-throwing
        // contract catches the guard's throw and logs it instead of leaking
        // it to the caller (mirrors the "does NOT touch" cases below).
        expect(state.inserts).toHaveLength(0);
        expect(state.conflicts).toHaveLength(0);
        expect(reconcileVisibilityMock).not.toHaveBeenCalled();
        expect(loggerMock.error).toHaveBeenCalled();
    });

    it('recovers a trialing subscription too, not only an active one', async () => {
        // Arrange
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.TRIALING,
            source: 'mp-webhook'
        });

        // Assert
        expect(reconcileVisibilityMock).toHaveBeenCalledTimes(1);
    });
});

describe('reconcileCommerceListingForSubscription — the inverse an eager fix breaks', () => {
    it('does NOT touch the listing when a superseded subscription reports a non-publishing status', async () => {
        // Arrange — the buyer completed subB (the LAST click); subA is the
        // abandoned first click, reaped later as cancelled. subA still carries
        // the entity coordinates in its metadata, so a fallback that ignored
        // the status would steal the row back and unpublish a paid listing.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: SubscriptionStatusEnum.ACTIVE }];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'cancelled',
            source: 'abandoned-pending-subs'
        });

        // Assert — nothing reconciled, nothing written.
        expect(reconcileVisibilityMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
        expect(state.conflicts).toHaveLength(0);
        expect(state.updates).toHaveLength(0);
    });

    it('does NOT claim an UNCLAIMED link row on a non-publishing status', async () => {
        // Arrange — the sharpest case, and the only one the status guard alone
        // decides: the incumbent is NOT paying yet (subB paid, its webhook has
        // not landed, so the row still reads pending_provider) while the
        // abandoned first click is reaped as cancelled. Nothing stops a
        // status-blind recovery from grabbing that row here and writing
        // `cancelled` onto a listing that was just paid for.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'cancelled',
            source: 'abandoned-pending-subs'
        });

        // Assert
        expect(state.inserts).toHaveLength(0);
        expect(state.conflicts).toHaveLength(0);
        expect(reconcileVisibilityMock).not.toHaveBeenCalled();
    });

    it('does NOT steal the link row from another ALREADY-PAYING subscription', async () => {
        // Arrange — both clicks got completed (two live charges). The listing
        // is already published under subB; subA activating must not re-point
        // the row, and the double charge must be logged for ops.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: SubscriptionStatusEnum.ACTIVE }];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert
        expect(state.inserts).toHaveLength(0);
        expect(state.conflicts).toHaveLength(0);
        expect(loggerMock.error).toHaveBeenCalled();
    });
});

describe('reconcileCommerceListingForSubscription — untouched paths', () => {
    it('stays a no-op for a subscription with no commerce coordinates (accommodation)', async () => {
        // Arrange — the overwhelmingly common webhook.
        state.linkRows = [];
        state.holderRows = [];
        state.subscriptionRows = [{ metadata: { source: 'start-paid-share-link' } }];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert
        expect(reconcileVisibilityMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
        expect(state.updates).toHaveLength(0);
    });

    it('keeps the normal path intact when the link row DOES point at the subscription', async () => {
        // Arrange — single click, no double-click at all.
        state.linkRows = [{ entityType: ENTITY_TYPE, entityId: ENTITY_ID }];

        // Act
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        // Assert — status denormalized onto the link row, listing reconciled,
        // and no upsert (nothing to recover).
        expect(state.updates).toHaveLength(1);
        expect(state.updates[0]?.payload.status).toBe(SubscriptionStatusEnum.ACTIVE);
        expect(reconcileVisibilityMock).toHaveBeenCalledTimes(1);
        expect(state.inserts).toHaveLength(0);
    });
});

describe('reconcileCommerceListingForSubscription — plan-restricted listings (HOS-1122)', () => {
    it('forwards the link row’s planRestricted flag to the visibility reconciler', () => {
        // The reconciler cannot read the column itself — it takes the value as
        // an input, defaulting to `false`. So the whole guarantee that a
        // downgraded listing stays private through a renewal webhook rests on
        // THIS select carrying the column and THIS call forwarding it. Dropping
        // either leaves the reconciler seeing the permissive default with no
        // error anywhere.
        state.linkRows = [{ entityType: ENTITY_TYPE, entityId: ENTITY_ID, planRestricted: true }];

        return reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        }).then(() => {
            expect(reconcileVisibilityMock).toHaveBeenCalledTimes(1);
            expect(reconcileVisibilityMock.mock.calls[0]?.[0]?.planRestricted).toBe(true);
        });
    });

    it('forwards FALSE for an unrestricted listing — not undefined, and not the default', async () => {
        // Distinguishes "the column was read and said false" from "the field was
        // never passed and the reconciler's own default filled in". Only the
        // first proves the select still carries the column.
        state.linkRows = [{ entityType: ENTITY_TYPE, entityId: ENTITY_ID, planRestricted: false }];

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        expect(reconcileVisibilityMock.mock.calls[0]?.[0]?.planRestricted).toBe(false);
    });

    it('clears plan_restricted when it re-points the row at another subscription', async () => {
        // HOS-1122. The recovery hands the listing from subB to subA. A
        // restriction is a fact about ONE subscription — subA has its own tier
        // and has restricted nothing — so carrying the flag over would leave a
        // paid listing PRIVATE, and silently: the reconciler's
        // paid-but-incomplete alarm is keyed on the same predicate the flag
        // feeds, so a restricted listing produces no log at all.
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        expect(state.conflicts).toHaveLength(1);
        expect(state.conflicts[0]?.set.planRestricted).toBe(false);
    });

    it('treats a RECOVERED link as unrestricted — a recovery only ever fires for an unlinked subscription', async () => {
        state.linkRows = [];
        state.holderRows = [
            { subscriptionId: SUB_B, status: SubscriptionStatusEnum.PENDING_PROVIDER }
        ];
        state.subscriptionRows = [
            { metadata: { commerceEntityType: ENTITY_TYPE, commerceEntityId: ENTITY_ID } }
        ];

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
            source: 'mp-webhook'
        });

        expect(reconcileVisibilityMock.mock.calls[0]?.[0]?.planRestricted).toBe(false);
    });
});
