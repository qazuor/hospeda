/**
 * @fileoverview
 * Unit tests for the `0066-hos-692-domain-rewrite-and-plan-cleanup` data
 * migration, using a mocked query chain — no real database connection. Same
 * style as `0056-hos-581-unmangle-billing-customer-email.test.ts`.
 *
 * Table dispatch is STRUCTURAL (by a distinguishing column key), not by
 * object identity: `@repo/db` can resolve to two distinct module instances
 * for this test file vs. the migration file under Vitest's module graph
 * (a dual-package hazard, not specific to this migration), so `table ===
 * commerceListingSubscriptions` silently never matches even though both
 * sides import the "same" table. Checking for a column unique to each table
 * (`entityType` for the link table, `billingInterval` for subscriptions,
 * `monthlyPriceArs` for plans) is resolution-independent.
 *
 * WHAT THESE TESTS CANNOT SEE: with a fake `db`, no real SQL `WHERE`/`JOIN`
 * predicate is ever evaluated. What IS verified: the orchestration (which
 * rows get rewritten vs. left alone and why), that `product_domain` NEVER
 * receives `null`/`undefined`, and the plan-cleanup safety checks.
 *
 * @module test/data-migrations/0066-hos-692-domain-rewrite-and-plan-cleanup
 */
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0066-hos-692-domain-rewrite-and-plan-cleanup.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

type TableKind = 'link' | 'subscriptions' | 'plans';

/** Identifies which real table a Drizzle table object represents, by a distinguishing column. */
function identifyTable(table: unknown): TableKind {
    const keys = table && typeof table === 'object' ? Object.keys(table) : [];
    if (keys.includes('entityType')) return 'link';
    if (keys.includes('billingInterval')) return 'subscriptions';
    if (keys.includes('monthlyPriceArs')) return 'plans';
    throw new Error(`identifyTable: unrecognized table shape: ${keys.join(', ')}`);
}

interface LinkRowFixture {
    readonly subscriptionId: string;
    readonly entityType: string;
}

interface FakeDbConfig {
    /** Every `commerce_listing_subscriptions` row (unfiltered — mirrors the real table scan). */
    readonly linkRows: readonly LinkRowFixture[];
    /** Every `billing_subscriptions` row currently at `product_domain = 'commerce'`. */
    readonly commerceSubIds: readonly string[];
    /** `billing_plans` rows resolvable by slug (name), for the complex-plan cleanup. */
    readonly plansBySlug?: Readonly<Record<string, { id: string }>>;
    /** planId -> whether a live `billing_subscriptions` row references it. */
    readonly livePlanIds?: ReadonlySet<string>;
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    readonly subscriptionUpdates: () => readonly { productDomain: unknown }[];
    readonly linkRowUpdates: () => readonly { productDomain: unknown }[];
    readonly planDeletes: () => readonly string[];
    readonly planSoftDeletes: () => readonly {
        slug: string;
        active: unknown;
        deletedAt: unknown;
    }[];
    readonly executedSql: () => number;
}

/** Builds a fake `ctx.db` covering every query chain this migration issues. */
function buildFakeDb(config: FakeDbConfig): FakeDbProbe {
    const { linkRows, commerceSubIds, plansBySlug = {}, livePlanIds = new Set<string>() } = config;

    const subscriptionUpdates: { productDomain: unknown }[] = [];
    const linkRowUpdates: { productDomain: unknown }[] = [];
    const planDeletes: string[] = [];
    const planSoftDeletes: { slug: string; active: unknown; deletedAt: unknown }[] = [];
    let executedSqlCount = 0;

    // The migration's plan-cleanup loop always SELECTs a plan by slug right
    // before acting on it (liveSub check, then delete/update) — this tracks
    // which slug/id that was, so the fake's later dispatch knows the target.
    let lastResolvedPlan: { slug: string; id: string } | undefined;
    // Hoisted OUTSIDE the .from() closure: a fresh select().from() call
    // happens once per plan slug in the migration's real loop, so this must
    // persist ACROSS those calls to advance through plansBySlug in order.
    // The migration looks up plans in a FIXED order (complex-* first, then
    // the two soft-deleted plans) — mirrored here exactly rather than derived
    // from `plansBySlug`'s own key order, since the fake can't see WHICH slug
    // a given opaque `.where()` predicate targets.
    const REAL_LOOKUP_ORDER = [
        'complex-basico',
        'complex-pro',
        'complex-premium',
        'tourist-plus',
        'owner-test-daily'
    ] as const;
    let planCursor = 0;

    const db = {
        select: (fields: Record<string, unknown>) => ({
            from: (table: unknown) => {
                const kind = identifyTable(table);

                if (kind === 'link') {
                    // Two real shapes share this table: the unfiltered scan
                    // (resolveSubscriptionVerticals — no .where(), directly
                    // awaited) and the "anyLink" reporting probe
                    // (.where().limit(1)).
                    const awaitable = Promise.resolve(linkRows);
                    return Object.assign(awaitable, {
                        where: (_predicate: unknown) => ({
                            limit: (_n: number) => Promise.resolve(linkRows.slice(0, 1))
                        })
                    });
                }

                if (kind === 'subscriptions') {
                    // Two real shapes: the top-level "all commerce subs" scan
                    // (.where(), directly awaited) and the per-plan liveSub
                    // check (.where().limit(1)).
                    const awaitable = Promise.resolve(commerceSubIds.map((id) => ({ id })));
                    return Object.assign(awaitable, {
                        where: (_predicate: unknown) => {
                            const chained = Promise.resolve(commerceSubIds.map((id) => ({ id })));
                            return Object.assign(chained, {
                                limit: (_n: number) => {
                                    const isLive = lastResolvedPlan
                                        ? livePlanIds.has(lastResolvedPlan.id)
                                        : false;
                                    return Promise.resolve(isLive ? [{ id: 'live-sub-id' }] : []);
                                }
                            });
                        }
                    });
                }

                // kind === 'plans': always a by-slug lookup (.where().limit(1)).
                // The predicate is opaque to this fake, so it resolves the
                // NEXT unconsumed plan slug from `plansBySlug`, matching the
                // migration's own sequential per-slug loop.
                return {
                    where: (_predicate: unknown) => ({
                        limit: (_n: number) => {
                            const slug = REAL_LOOKUP_ORDER[planCursor];
                            planCursor += 1;
                            const found = slug ? plansBySlug[slug] : undefined;
                            lastResolvedPlan = found && slug ? { slug, id: found.id } : undefined;
                            void fields;
                            return Promise.resolve(found ? [{ id: found.id }] : []);
                        }
                    })
                };
            }
        }),
        update: (table: unknown) => {
            const kind = identifyTable(table);
            return {
                set: (values: Record<string, unknown>) => ({
                    where: (_predicate: unknown) => {
                        if (kind === 'subscriptions') {
                            subscriptionUpdates.push({ productDomain: values.productDomain });
                            return Promise.resolve(undefined);
                        }
                        return {
                            returning: (_returningFields: unknown) => {
                                if (kind === 'link') {
                                    linkRowUpdates.push({ productDomain: values.productDomain });
                                    return Promise.resolve([{ id: 'link-row-id' }]);
                                }
                                // kind === 'plans': the soft-delete update.
                                planSoftDeletes.push({
                                    slug: lastResolvedPlan?.slug ?? 'unknown',
                                    active: values.active,
                                    deletedAt: values.deletedAt
                                });
                                return Promise.resolve([{ id: 'plan-id' }]);
                            }
                        };
                    }
                })
            };
        },
        delete: (table: unknown) => ({
            where: (_predicate: unknown) => {
                if (identifyTable(table) === 'plans' && lastResolvedPlan) {
                    planDeletes.push(lastResolvedPlan.slug);
                }
                return Promise.resolve(undefined);
            }
        }),
        execute: (_query: unknown) => {
            executedSqlCount += 1;
            return Promise.resolve({ rowCount: 1 });
        }
    } as unknown as SeedMigrationCtx['db'];

    return {
        db,
        subscriptionUpdates: () => subscriptionUpdates,
        linkRowUpdates: () => linkRowUpdates,
        planDeletes: () => planDeletes,
        planSoftDeletes: () => planSoftDeletes,
        executedSql: () => executedSqlCount
    };
}

function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

describe('0066-hos-692-domain-rewrite-and-plan-cleanup', () => {
    it('is declared destructive and required', () => {
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.group).toBe('required');
    });

    it('rewrites a subscription with a single-vertical link row to both tables', async () => {
        const probe = buildFakeDb({
            linkRows: [{ subscriptionId: 'sub-1', entityType: 'gastronomy' }],
            commerceSubIds: ['sub-1']
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.subscriptionUpdates()).toHaveLength(1);
        expect(probe.subscriptionUpdates()[0]?.productDomain).toBe('gastronomy');
        expect(probe.linkRowUpdates()).toHaveLength(1);
        expect(probe.linkRowUpdates()[0]?.productDomain).toBe('gastronomy');
        expect(result.counts?.subscriptionsRewritten).toBe(1);
    });

    it('leaves a subscription with NO link row at product_domain=commerce, reported', async () => {
        const probe = buildFakeDb({
            linkRows: [],
            commerceSubIds: ['sub-orphan']
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.subscriptionUpdates()).toHaveLength(0);
        expect(result.counts?.subscriptionsWithoutLinkRow).toBe(1);
        expect(result.counts?.subscriptionsRewritten).toBe(0);
    });

    it('NEVER writes null/undefined to product_domain — mutation-tested invariant', async () => {
        const probe = buildFakeDb({
            linkRows: [{ subscriptionId: 'sub-1', entityType: 'gastronomy' }],
            commerceSubIds: ['sub-1']
        });

        await migration.up(buildCtx(probe.db));

        for (const update of probe.subscriptionUpdates()) {
            expect(update.productDomain).not.toBeNull();
            expect(update.productDomain).not.toBeUndefined();
            expect(['gastronomy', 'experience']).toContain(update.productDomain);
        }
        for (const update of probe.linkRowUpdates()) {
            expect(update.productDomain).not.toBeNull();
            expect(update.productDomain).not.toBeUndefined();
        }
    });

    it('hard-deletes complex plans with zero live subscriptions', async () => {
        const probe = buildFakeDb({
            linkRows: [],
            commerceSubIds: [],
            plansBySlug: {
                'complex-basico': { id: 'plan-basico' },
                'complex-pro': { id: 'plan-pro' },
                'complex-premium': { id: 'plan-premium' }
            },
            livePlanIds: new Set()
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.planDeletes()).toEqual(
            expect.arrayContaining(['complex-basico', 'complex-pro', 'complex-premium'])
        );
        expect(result.counts?.complexPlansDeleted).toBe(3);
    });

    it('refuses to hard-delete a complex plan that unexpectedly HAS a live subscription', async () => {
        const probe = buildFakeDb({
            linkRows: [],
            commerceSubIds: [],
            plansBySlug: {
                'complex-basico': { id: 'plan-basico' },
                'complex-pro': { id: 'plan-pro' },
                'complex-premium': { id: 'plan-premium' }
            },
            livePlanIds: new Set(['plan-basico'])
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.planDeletes()).not.toContain('complex-basico');
        expect(probe.planDeletes()).toEqual(
            expect.arrayContaining(['complex-pro', 'complex-premium'])
        );
        expect(result.counts?.complexPlansSkippedLiveSubscription).toBe(1);
        expect(result.counts?.complexPlansDeleted).toBe(2);
    });

    it('deactivates + soft-deletes tourist-plus and owner-test-daily', async () => {
        const probe = buildFakeDb({
            linkRows: [],
            commerceSubIds: [],
            plansBySlug: {
                'tourist-plus': { id: 'plan-tourist-plus' },
                'owner-test-daily': { id: 'plan-owner-test-daily' }
            }
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.planSoftDeletes()).toHaveLength(2);
        for (const update of probe.planSoftDeletes()) {
            expect(update.active).toBe(false);
            expect(update.deletedAt).toBeInstanceOf(Date);
        }
        expect(result.counts?.softDeletedPlans).toBe(2);
    });

    it('strips the metadata.monthlyPriceArs mirror via one raw-SQL execute call', async () => {
        const probe = buildFakeDb({ linkRows: [], commerceSubIds: [] });

        await migration.up(buildCtx(probe.db));

        expect(probe.executedSql()).toBe(1);
    });
});
