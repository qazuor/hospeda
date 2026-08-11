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
    /** Rows returned by the partner-subscription link lookup. */
    linkRows: [] as Array<{ partnerId: string }>,
    /** The `partners` row the reconcile reads before deciding on `startsAt`. */
    partnerRows: [] as Array<{ id: string; startsAt: Date | null }>,
    /** Every `.set()` payload written, in call order. */
    setCalls: [] as Array<Record<string, unknown>>
}));

const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: () => ({
            from: (table: unknown) => ({
                where: () => {
                    const rows = table === 'partners' ? state.partnerRows : state.linkRows;
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
        })
    }),
    partners: 'partners',
    partnerSubscriptions: 'partnerSubscriptions',
    // Re-exported by @repo/db, which is where the service imports them from —
    // NOT from 'drizzle-orm'. Leaving them out makes them undefined, and the
    // service's own try/catch swallows the resulting TypeError into a warn,
    // so every assertion fails with "no update was written" and no clue why.
    // They are only opaque predicate builders here: the real ones need genuine
    // Drizzle column objects, which the string table stubs above are not.
    and: (...args: unknown[]) => ({ and: args }),
    eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
    isNull: (a: unknown) => ({ isNull: a })
}));

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
    state.partnerRows = [{ id: PARTNER_ID, startsAt: null }];
    state.setCalls.length = 0;
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
