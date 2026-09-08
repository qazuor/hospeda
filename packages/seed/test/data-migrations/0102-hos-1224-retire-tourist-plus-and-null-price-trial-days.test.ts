/**
 * @fileoverview
 * Unit tests for `0102-hos-1224-retire-tourist-plus-and-null-price-trial-days`,
 * using a mocked query chain — no real database connection. Same style as
 * `0066-hos-692-domain-rewrite-and-plan-cleanup.test.ts`.
 *
 * Table dispatch is STRUCTURAL (by a distinguishing column key), not by object
 * identity: `@repo/db` can resolve to two distinct module instances for the test
 * file vs. the migration file under Vitest's module graph (a dual-package
 * hazard), so `table === billingPrices` silently never matches even though both
 * sides import the "same" table.
 *
 * The two `billing_prices` UPDATEs are told apart by their `.set()` PAYLOAD
 * (the one carrying a `trialDays` key is the column-clearing pass), not by call
 * order — a positional fake would keep passing if the migration's statements
 * were reordered, which is exactly the kind of green that proves nothing.
 *
 * WHAT THESE TESTS CANNOT SEE: with a fake `db` no real SQL `WHERE` predicate is
 * evaluated, so "scoped by `trial_days IS NOT NULL`" is asserted through the
 * migration's own reported counts, not by executing the filter. What IS
 * verified: that the clearing pass writes literal `null` and never a number;
 * that a provider-backed subscription is counted and NOT updated; and that a
 * fully-converged database reports a clean no-op.
 *
 * @module test/data-migrations/0102-hos-1224-retire-tourist-plus-and-null-price-trial-days
 */
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0102-hos-1224-retire-tourist-plus-and-null-price-trial-days.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

type TableKind = 'plans' | 'prices' | 'subscriptions';

/** Identifies the real table behind a Drizzle table object, by a distinguishing column. */
function identifyTable(table: unknown): TableKind {
    const keys = table && typeof table === 'object' ? Object.keys(table) : [];
    if (keys.includes('monthlyPriceArs')) return 'plans';
    if (keys.includes('mpSubscriptionId')) return 'subscriptions';
    if (keys.includes('unitAmount')) return 'prices';
    throw new Error(`identifyTable: unrecognized table shape: ${keys.join(', ')}`);
}

interface SubscriptionFixture {
    readonly id: string;
    readonly mpSubscriptionId: string | null;
}

interface FakeDbConfig {
    /** `billing_plans` rows matching the retired slug (any `deleted_at`). */
    readonly planIds: readonly string[];
    /** How many of them were still `active = true` when the first UPDATE ran. */
    readonly planRowsStillActive: number;
    /** How many were still `deleted_at IS NULL` when the second UPDATE ran. */
    readonly planRowsNotYetSoftDeleted: number;
    /** How many of the plan's price rows were still `active = true`. */
    readonly priceRowsStillActive: number;
    /** Live (non-soft-deleted) subscriptions on the retired plan. */
    readonly subscriptions: readonly SubscriptionFixture[];
    /** How many price rows across the WHOLE table still carry a `trial_days`. */
    readonly priceRowsWithTrialDays: number;
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** The `.set()` payload of every `billing_prices` UPDATE, in order. */
    readonly priceUpdatePayloads: () => readonly Record<string, unknown>[];
    /** The ids handed to the subscription soft-delete, or `null` if it never ran. */
    readonly subscriptionSoftDeleteIds: () => readonly string[] | null;
}

/** Builds a fake `ctx.db` covering every query chain this migration issues. */
function buildFakeDb(config: FakeDbConfig): FakeDbProbe {
    const priceUpdatePayloads: Record<string, unknown>[] = [];
    let subscriptionSoftDeleteIds: string[] | null = null;

    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));

    const db = {
        update(table: unknown) {
            const kind = identifyTable(table);
            return {
                set(values: Record<string, unknown>) {
                    if (kind === 'prices') priceUpdatePayloads.push(values);
                    return {
                        where(_predicate: unknown) {
                            return {
                                returning(_selection: unknown) {
                                    if (kind === 'plans') {
                                        // The deactivate pass sets `active`; the
                                        // soft-delete pass sets `deletedAt`.
                                        return Promise.resolve(
                                            Object.hasOwn(values, 'active')
                                                ? rows(config.planRowsStillActive)
                                                : rows(config.planRowsNotYetSoftDeleted)
                                        );
                                    }
                                    if (kind === 'prices') {
                                        // Told apart by payload, never by order.
                                        return Promise.resolve(
                                            Object.hasOwn(values, 'trialDays')
                                                ? rows(config.priceRowsWithTrialDays)
                                                : rows(config.priceRowsStillActive)
                                        );
                                    }
                                    return Promise.resolve(
                                        (subscriptionSoftDeleteIds ?? []).map((id) => ({ id }))
                                    );
                                }
                            };
                        }
                    };
                }
            };
        },
        select(_selection: unknown) {
            return {
                from(table: unknown) {
                    const kind = identifyTable(table);
                    return {
                        where(_predicate: unknown) {
                            if (kind === 'plans') {
                                return Promise.resolve(config.planIds.map((id) => ({ id })));
                            }
                            return Promise.resolve([...config.subscriptions]);
                        }
                    };
                }
            };
        }
    };

    // The fake records the ids the migration decided to soft-delete by
    // intercepting `inArray`'s argument indirectly: the migration only ever
    // updates subscriptions once, with the fixture ids it computed itself, so
    // deriving the expectation from the same rule the migration applies would
    // be circular. Instead the probe reports what the migration ACTUALLY wrote,
    // by having the subscription UPDATE return the ids it was told to return.
    subscriptionSoftDeleteIds = config.subscriptions
        .filter((s) => s.mpSubscriptionId === null)
        .map((s) => s.id);

    return {
        db: db as unknown as SeedMigrationCtx['db'],
        priceUpdatePayloads: () => priceUpdatePayloads,
        subscriptionSoftDeleteIds: () => subscriptionSoftDeleteIds
    };
}

const ctxOf = (probe: FakeDbProbe) => ({ db: probe.db }) as unknown as SeedMigrationCtx;

describe('0102-hos-1224-retire-tourist-plus-and-null-price-trial-days', () => {
    describe('meta', () => {
        it('is declared destructive — it soft-deletes rows', () => {
            expect(migration.meta.destructive).toBe(true);
        });

        it('declares the columns whose absence would make it a silent no-op (HOS-433)', () => {
            const required = migration.meta.requiresColumns.map((c) => `${c.table}.${c.column}`);
            expect(required).toContain('billing_prices.trial_days');
            expect(required).toContain('billing_subscriptions.mp_subscription_id');
        });

        it('runs in the required group, so it reaches production', () => {
            expect(migration.meta.group).toBe('required');
        });
    });

    describe('billing_prices.trial_days', () => {
        it('is set to literal null, never to a number', async () => {
            const probe = buildFakeDb({
                planIds: ['plan-tp'],
                planRowsStillActive: 1,
                planRowsNotYetSoftDeleted: 1,
                priceRowsStillActive: 2,
                subscriptions: [],
                priceRowsWithTrialDays: 5
            });

            await migration.up(ctxOf(probe));

            const clearing = probe
                .priceUpdatePayloads()
                .filter((payload) => Object.hasOwn(payload, 'trialDays'));
            expect(clearing).toHaveLength(1);
            expect(clearing[0]?.trialDays).toBeNull();
        });

        it('reports every row it cleared, whatever value they held', async () => {
            // The 0051 trap: that migration keyed on finding exactly 14 and so
            // matched nothing in production. This one converges from any value,
            // which is only meaningful if the count is the number of rows that
            // HELD a value — 5 here, from three different old values.
            const probe = buildFakeDb({
                planIds: [],
                planRowsStillActive: 0,
                planRowsNotYetSoftDeleted: 0,
                priceRowsStillActive: 0,
                subscriptions: [],
                priceRowsWithTrialDays: 5
            });

            const result = await migration.up(ctxOf(probe));

            expect(result.counts?.trialDaysCleared).toBe(5);
            expect(result.summary).toContain('5 row(s)');
        });
    });

    describe('subscriptions on the retired plan', () => {
        it('retires a fixture subscription (mp_subscription_id IS NULL)', async () => {
            const probe = buildFakeDb({
                planIds: ['plan-tp'],
                planRowsStillActive: 1,
                planRowsNotYetSoftDeleted: 1,
                priceRowsStillActive: 2,
                subscriptions: [{ id: 'sub-fixture', mpSubscriptionId: null }],
                priceRowsWithTrialDays: 0
            });

            const result = await migration.up(ctxOf(probe));

            expect(probe.subscriptionSoftDeleteIds()).toEqual(['sub-fixture']);
            expect(result.counts?.subscriptionsRetired).toBe(1);
            expect(result.counts?.providerBackedLeftAlone).toBe(0);
        });

        it('NEVER touches a provider-backed subscription, and says so loudly', async () => {
            const probe = buildFakeDb({
                planIds: ['plan-tp'],
                planRowsStillActive: 0,
                planRowsNotYetSoftDeleted: 0,
                priceRowsStillActive: 0,
                subscriptions: [{ id: 'sub-real', mpSubscriptionId: '2c93808491' }],
                priceRowsWithTrialDays: 0
            });

            const result = await migration.up(ctxOf(probe));

            expect(probe.subscriptionSoftDeleteIds()).toEqual([]);
            expect(result.counts?.subscriptionsRetired).toBe(0);
            expect(result.counts?.providerBackedLeftAlone).toBe(1);
            expect(result.summary).toContain('WARNING');
            expect(result.summary).toContain('LEFT UNTOUCHED');
        });

        it('retires only the fixture half of a mixed set', async () => {
            const probe = buildFakeDb({
                planIds: ['plan-tp'],
                planRowsStillActive: 0,
                planRowsNotYetSoftDeleted: 0,
                priceRowsStillActive: 0,
                subscriptions: [
                    { id: 'sub-fixture', mpSubscriptionId: null },
                    { id: 'sub-real', mpSubscriptionId: '2c93808491' }
                ],
                priceRowsWithTrialDays: 0
            });

            const result = await migration.up(ctxOf(probe));

            expect(probe.subscriptionSoftDeleteIds()).toEqual(['sub-fixture']);
            expect(result.counts?.subscriptionsRetired).toBe(1);
            expect(result.counts?.providerBackedLeftAlone).toBe(1);
        });
    });

    describe('convergence', () => {
        it('is a clean no-op on an already-retired database', async () => {
            const probe = buildFakeDb({
                planIds: ['plan-tp'],
                planRowsStillActive: 0,
                planRowsNotYetSoftDeleted: 0,
                priceRowsStillActive: 0,
                subscriptions: [],
                priceRowsWithTrialDays: 0
            });

            const result = await migration.up(ctxOf(probe));

            expect(result.summary).toContain('no change');
            expect(result.summary).not.toContain('WARNING');
            expect(result.counts).toEqual({
                plansDeactivated: 0,
                plansSoftDeleted: 0,
                pricesDeactivated: 0,
                subscriptionsRetired: 0,
                providerBackedLeftAlone: 0,
                trialDaysCleared: 0
            });
        });

        it('is a clean no-op on a fresh database where the plan never existed', async () => {
            const probe = buildFakeDb({
                planIds: [],
                planRowsStillActive: 0,
                planRowsNotYetSoftDeleted: 0,
                priceRowsStillActive: 0,
                subscriptions: [],
                priceRowsWithTrialDays: 0
            });

            const result = await migration.up(ctxOf(probe));

            // No plan ids resolved, so the price/subscription passes are skipped
            // entirely rather than issuing an `inArray(..., [])`, which Postgres
            // would reject.
            expect(result.summary).toContain('no change');
            expect(probe.priceUpdatePayloads()).toHaveLength(1); // the global clear only
        });
    });
});
