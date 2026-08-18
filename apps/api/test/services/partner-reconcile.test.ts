/**
 * @fileoverview
 * Unit tests for `reconcilePartnerForSubscription` (HOS-409).
 *
 * The billing lifecycle is the second way a partner reaches ACTIVE — the first
 * being the admin's manual-payment bypass. Both must seal `partners.startsAt`,
 * because the unpaid reaper (`PartnerModel.findUnpaidProvisioned`) treats a null
 * `startsAt` as "this partner never paid": a partner activated by a real
 * MercadoPago charge but left with a null date gets an unpaid notice on day 30
 * and is archived on day 90 while still being billed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted: `vi.mock` factories run before module-level initialization, so the
// state they close over has to be created by `vi.hoisted` too.
const state = vi.hoisted(() => ({
    /** Rows returned by the partner-subscription link lookup (by subscription id). */
    linkRows: [] as Array<{ partnerId: string }>,
    /** Rows returned by the link lookup BY `partner_id` (the row's current holder). */
    holderRows: [] as Array<{ subscriptionId: string; status: string }>,
    /** Rows returned by the `billing_subscriptions` metadata lookup. */
    subscriptionRows: [] as Array<{ metadata: Record<string, unknown> | null }>,
    /** The `partners` row the reconcile reads before deciding on `startsAt`. */
    partnerRows: [] as Array<{ id: string; startsAt: Date | null }>,
    /** Every `.set()` payload written, in call order. */
    setCalls: [] as Array<Record<string, unknown>>,
    /** Every `.insert().values()` payload, in call order. */
    inserts: [] as Array<Record<string, unknown>>,
    /** Every `.onConflictDoUpdate()` config, in call order. */
    conflicts: [] as Array<{ target: unknown; set: Record<string, unknown> }>
}));

const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
}));

vi.mock('@repo/db', () => {
    const partnerSubscriptions = {
        subscriptionId: 'partner_subs.subscription_id',
        partnerId: 'partner_subs.partner_id',
        status: 'partner_subs.status'
    };
    const billingSubscriptions = { id: 'billing.id', metadata: 'billing.metadata' };

    /**
     * Three different selects reach this mock. `partners` is told apart by the
     * table object; the two `partner_subscriptions` reads differ only in the
     * column they filter on — by `partner_id` it is the row's current holder,
     * by `subscription_id` it is the link lookup.
     */
    const rowsFor = (table: unknown, condition: unknown): unknown[] => {
        if (table === 'partners') return state.partnerRows;
        if (table === billingSubscriptions) return state.subscriptionRows;
        const filteredColumn =
            condition && typeof condition === 'object' && 'eq' in condition
                ? (condition as { eq: unknown[] }).eq[0]
                : undefined;
        return filteredColumn === partnerSubscriptions.partnerId
            ? state.holderRows
            : state.linkRows;
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
            update: () => ({
                set: (payload: Record<string, unknown>) => {
                    state.setCalls.push(payload);
                    return { where: () => Promise.resolve(undefined) };
                }
            }),
            insert: () => ({
                values: (values: Record<string, unknown>) => {
                    state.inserts.push(values);
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
        partners: 'partners',
        partnerSubscriptions,
        billingSubscriptions,
        // Re-exported by @repo/db, which is where the service imports them from —
        // NOT from 'drizzle-orm'. Leaving them out makes them undefined, and the
        // service's own try/catch swallows the resulting TypeError into a warn,
        // so every assertion fails with "no update was written" and no clue why.
        // They are only opaque predicate builders here: the real ones need genuine
        // Drizzle column objects, which the string table stubs above are not.
        and: (...args: unknown[]) => ({ and: args }),
        eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
        isNull: (a: unknown) => ({ isNull: a })
    };
});

vi.mock('../../src/utils/logger', () => ({ apiLogger: loggerMock }));

import { reconcilePartnerForSubscription } from '../../src/services/partner-reconcile.service';

const PARTNER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const SUBSCRIPTION_ID = 'sub_test_1';

/** The payload written to the `partners` table (the link-table write is first). */
const partnerPatch = (): Record<string, unknown> => {
    const patch = state.setCalls.at(-1);
    expect(patch, 'no partner update was written').toBeDefined();
    return patch as Record<string, unknown>;
};

beforeEach(() => {
    state.linkRows = [{ partnerId: PARTNER_ID }];
    state.holderRows = [];
    state.subscriptionRows = [];
    state.partnerRows = [{ id: PARTNER_ID, startsAt: null }];
    state.setCalls.length = 0;
    state.inserts.length = 0;
    state.conflicts.length = 0;
    vi.clearAllMocks();
});

describe('reconcilePartnerForSubscription — startsAt (HOS-409)', () => {
    it('seals startsAt when billing reports the subscription active', async () => {
        // Arrange — a partner provisioned from a lead, paying for the first time.
        state.partnerRows = [{ id: PARTNER_ID, startsAt: null }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUBSCRIPTION_ID,
            subscriptionStatus: 'active',
            source: 'test'
        });

        // Assert
        expect(partnerPatch().startsAt).toBeInstanceOf(Date);
    });

    it('leaves an existing startsAt untouched on a later renewal', async () => {
        // Arrange — every renewal webhook re-reports `active`. Rewriting the
        // date each time would keep resetting the day the alliance began.
        const originalStart = new Date('2026-02-01T00:00:00Z');
        state.partnerRows = [{ id: PARTNER_ID, startsAt: originalStart }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUBSCRIPTION_ID,
            subscriptionStatus: 'active',
            source: 'test'
        });

        // Assert — absent from the patch entirely, not written back unchanged.
        expect(partnerPatch()).not.toHaveProperty('startsAt');
    });

    it('does NOT seal startsAt for a status that is not active', async () => {
        // Arrange — `past_due` and `incomplete` also keep the partner's
        // lifecycle ACTIVE, but neither means the alliance started. Stamping
        // the date there would exempt a never-paying partner from the reaper.
        state.partnerRows = [{ id: PARTNER_ID, startsAt: null }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUBSCRIPTION_ID,
            subscriptionStatus: 'incomplete',
            source: 'test'
        });

        // Assert
        expect(partnerPatch()).not.toHaveProperty('startsAt');
    });

    it('still reconciles the status when no link row exists', async () => {
        // Arrange — a subscription that belongs to no partner is a no-op, not
        // an error: most billing webhooks are for accommodation subscriptions.
        state.linkRows = [];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUBSCRIPTION_ID,
            subscriptionStatus: 'active',
            source: 'test'
        });

        // Assert
        expect(state.setCalls).toHaveLength(0);
    });
});

/**
 * Double-click orphan (residual of the HOS-191 Path C migration, PR #2832).
 *
 * Path C creates one `pending_provider` subscription per CHECKOUT CLICK, and
 * `partner_subscriptions` is UNIQUE on `partner_id` and UPSERTED, so it always
 * points at the LAST click. An admin who sends (or a buyer who opens) the link
 * twice and then pays through the FIRST one leaves the reconciler with zero
 * link rows for the subscription MercadoPago just activated — a paying partner
 * that never goes ACTIVE.
 */
describe('reconcilePartnerForSubscription — double-click orphan', () => {
    const SUB_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
    const SUB_B = 'bbbbbbbb-0000-4000-8000-00000000000b';

    it('activates the partner when the paid subscription is NOT the one the link row points at', async () => {
        // Arrange — the link row was upserted onto subB; the buyer paid subA.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: 'pending_provider' }];
        state.subscriptionRows = [{ metadata: { partnerId: PARTNER_ID } }];
        state.partnerRows = [{ id: PARTNER_ID, startsAt: null }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        // Assert — the partner row was flipped to ACTIVE and the alliance date
        // sealed, exactly as if the link row had pointed at subA all along.
        const patch = partnerPatch();
        expect(patch.subscriptionStatus).toBe('active');
        expect(patch.startsAt).toBeInstanceOf(Date);
    });

    it('re-points the link row at the subscription that was actually paid', async () => {
        // Arrange
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: 'pending_provider' }];
        state.subscriptionRows = [{ metadata: { partnerId: PARTNER_ID } }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        // Assert
        expect(state.inserts).toHaveLength(1);
        expect(state.inserts[0]?.subscriptionId).toBe(SUB_A);
        expect(state.inserts[0]?.partnerId).toBe(PARTNER_ID);
        expect(state.conflicts).toHaveLength(1);
        expect(state.conflicts[0]?.set.subscriptionId).toBe(SUB_A);
    });

    it('does NOT touch the partner when a superseded subscription reports a non-publishing status', async () => {
        // Arrange — the buyer paid subB; subA is the abandoned first click.
        // A status-blind fallback would steal the row back and archive a
        // partner that is being charged.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: 'active' }];
        state.subscriptionRows = [{ metadata: { partnerId: PARTNER_ID } }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'cancelled',
            source: 'abandoned-pending-subs'
        });

        // Assert
        expect(state.setCalls).toHaveLength(0);
        expect(state.inserts).toHaveLength(0);
    });

    it('does NOT claim an UNCLAIMED link row on a non-publishing status', async () => {
        // Arrange — the case the status guard alone decides: the incumbent is
        // not paying YET (subB paid, webhook not landed) while the abandoned
        // first click is reaped. A status-blind recovery would claim the row
        // and archive a partner that is being charged.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: 'pending_provider' }];
        state.subscriptionRows = [{ metadata: { partnerId: PARTNER_ID } }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'cancelled',
            source: 'abandoned-pending-subs'
        });

        // Assert
        expect(state.inserts).toHaveLength(0);
        expect(state.setCalls).toHaveLength(0);
    });

    it('does NOT steal the link row from another ALREADY-PAYING subscription', async () => {
        // Arrange — both clicks got paid: two live charges for one partner.
        state.linkRows = [];
        state.holderRows = [{ subscriptionId: SUB_B, status: 'active' }];
        state.subscriptionRows = [{ metadata: { partnerId: PARTNER_ID } }];

        // Act
        await reconcilePartnerForSubscription({
            subscriptionId: SUB_A,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        // Assert
        expect(state.inserts).toHaveLength(0);
        expect(loggerMock.error).toHaveBeenCalled();
    });
});
