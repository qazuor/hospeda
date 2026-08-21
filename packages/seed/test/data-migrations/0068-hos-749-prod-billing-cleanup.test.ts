/**
 * @fileoverview
 * Unit tests for the `0068-hos-749-prod-billing-cleanup` data migration, over a
 * mocked Drizzle chain — no real database connection.
 *
 * The fake dispatches on the REAL Drizzle table object passed to `.from()` /
 * `.update()` (resolved with `getTableName`), so a test that renames a table in
 * its fixture cannot accidentally pass: the migration and the fake agree on
 * table identity through Drizzle itself, not through a string the test invents.
 *
 * `db.execute()` is routed by looking at the SQL text — the catalogue query
 * (`pg_constraint`) versus the per-referrer `COUNT(*)`.
 *
 * @module test/data-migrations/0068-hos-749-prod-billing-cleanup
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    billingAddonPurchases,
    billingCustomers,
    billingPayments,
    billingPendingCheckouts,
    billingSubscriptions,
    commerceListingSubscriptions,
    partnerSubscriptions
} from '@repo/db';
import { getTableName } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0068-hos-749-prod-billing-cleanup.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const OWNER_COMP_ID = '5cf22a13-e353-4627-825a-e95586771ab7';
const SMOKE_COMP_ID = '9c1a79e3-0882-4526-9278-6f96faf65465';
const REAL_USER_COMP_ID = '9da44403-44c3-47b0-8254-af08e57adefd';

const OWNER_CUSTOMER_ID = 'a0d625d6-f1e8-4f8c-985f-8ce96d15b83e';
const SMOKE_CUSTOMER_ID = '5a6f147c-7430-4f3a-b16d-0b886e996943';
const REAL_USER_CUSTOMER_ID = 'ba7c082f-09a5-4ebf-902f-6bd8a33ec162';
const TEST_CUSTOMER_ID = '727d0a5d-6d3e-4f75-ac51-823bb9279a3d';

const BEFORE_CUTOFF = new Date('2026-08-14T00:00:00.000Z');
const AFTER_CUTOFF = new Date('2026-09-01T00:00:00.000Z');

interface SubscriptionRow {
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
    readonly createdAt: Date;
}

interface FakeDbOptions {
    readonly subscriptions?: readonly SubscriptionRow[];
    readonly customers?: readonly { id: string; createdAt: Date }[];
    readonly payments?: readonly { id: string }[];
    readonly addonPurchases?: readonly { id: string }[];
    /** Rows returned by the three inertness probes, keyed by table name. */
    readonly retainedRows?: Readonly<Record<string, readonly { id: string }[]>>;
    /** Inbound FKs the fake pg-catalogue reports, keyed by referenced table. */
    readonly inboundFks?: Readonly<
        Record<
            string,
            readonly {
                referencingTable: string;
                referencingColumn: string;
                constraintName: string;
            }[]
        >
    >;
    /** COUNT(*) answered for the unclassified-referrer probe. */
    readonly referrerCount?: number;
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** Ids passed to `.update(<table>)` per table, in write order. */
    readonly updates: Record<string, string[]>;
    /** Table names in the order they were written. */
    readonly writeOrder: string[];
}

/** Concatenates a Drizzle `sql` template's literal chunks into plain text. */
function sqlText(query: unknown): string {
    const chunks = (query as { queryChunks?: readonly unknown[] }).queryChunks ?? [];
    let text = '';
    for (const chunk of chunks) {
        const value = (chunk as { value?: unknown }).value;
        if (Array.isArray(value)) {
            text += value.join('');
        } else if (typeof value === 'string') {
            text += value;
        }
    }
    return text;
}

/**
 * Walks a Drizzle predicate and returns every bound STRING parameter, in order.
 *
 * This is what keeps the write assertions honest: the fake reads back the exact
 * id list the migration passed to `inArray(...)`, instead of the test declaring
 * what it hopes was written. A migration that silently included the owner's comp
 * id would show it here.
 *
 * Only string params are collected — `lt(createdAt, cutoff)` binds a `Date`, and
 * `isNull(...)` binds nothing.
 */
function collectStringParams(node: unknown, out: string[] = [], depth = 0): string[] {
    if (node === null || typeof node !== 'object' || depth > 12) {
        return out;
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            collectStringParams(item, out, depth + 1);
        }
        return out;
    }
    // Drizzle's `Param` is the only node carrying BOTH a scalar `value` and an
    // `encoder`; a `StringChunk`'s `value` is an array of SQL literals.
    const value = (node as { value?: unknown }).value;
    if (typeof value === 'string' && 'encoder' in (node as object)) {
        out.push(value);
    }
    const chunks = (node as { queryChunks?: unknown }).queryChunks;
    if (Array.isArray(chunks)) {
        collectStringParams(chunks, out, depth + 1);
    }
    return out;
}

function buildFakeDb(options: FakeDbOptions = {}): FakeDbProbe {
    const updates: Record<string, string[]> = {};
    const writeOrder: string[] = [];

    const rowsFor = (tableName: string): readonly unknown[] => {
        switch (tableName) {
            case getTableName(billingSubscriptions):
                return options.subscriptions ?? [];
            case getTableName(billingCustomers):
                return options.customers ?? [];
            case getTableName(billingPayments):
                return options.payments ?? [];
            case getTableName(billingAddonPurchases):
                return options.addonPurchases ?? [];
            default:
                return options.retainedRows?.[tableName] ?? [];
        }
    };

    const db = {
        select: () => ({
            from: (table: unknown) => ({
                where: () => Promise.resolve(rowsFor(getTableName(table as never)))
            })
        }),
        update: (table: unknown) => {
            const name = getTableName(table as never);
            return {
                set: () => ({
                    where: (predicate: unknown) => ({
                        returning: () => {
                            // Read the real id list back out of the predicate,
                            // then echo it — modelling rows that were all still
                            // live (`deleted_at IS NULL`) at update time.
                            const ids = collectStringParams(predicate);
                            writeOrder.push(name);
                            updates[name] = ids;
                            return Promise.resolve(ids.map((id) => ({ id })));
                        }
                    })
                })
            };
        },
        execute: (query: unknown) => {
            const text = sqlText(query);
            if (text.includes('pg_constraint')) {
                // The referenced table is not recoverable from the text alone —
                // the fake returns the union of every configured inbound FK,
                // which is strictly harsher than reality (more referrers to
                // classify), so a passing test is not passing by omission.
                const all = Object.values(options.inboundFks ?? {}).flat();
                return Promise.resolve({
                    rows: all.map((fk) => ({
                        constraint_name: fk.constraintName,
                        referencing_table: fk.referencingTable,
                        referencing_column: fk.referencingColumn,
                        referenced_column: 'id'
                    }))
                });
            }
            return Promise.resolve({ rows: [{ count: String(options.referrerCount ?? 0) }] });
        }
    } as unknown as SeedMigrationCtx['db'];

    return { db, updates, writeOrder };
}

/**
 * Records the ids the migration decides to write, by intercepting the resolved
 * target lists through the update chain. The fake cannot see the ids directly
 * (Drizzle predicates are opaque here), so each test asserts on the RESULT
 * counters plus the write ORDER, and on the abort messages — the two things
 * that are actually load-bearing.
 */
function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

const INVENTORY_SUBSCRIPTIONS: readonly SubscriptionRow[] = [
    {
        id: OWNER_COMP_ID,
        customerId: OWNER_CUSTOMER_ID,
        status: 'comp',
        createdAt: BEFORE_CUTOFF
    },
    { id: SMOKE_COMP_ID, customerId: SMOKE_CUSTOMER_ID, status: 'comp', createdAt: BEFORE_CUTOFF },
    {
        id: REAL_USER_COMP_ID,
        customerId: REAL_USER_CUSTOMER_ID,
        status: 'comp',
        createdAt: BEFORE_CUTOFF
    },
    {
        id: 'fa6abdd1-c98b-4780-ad3e-53c24888ad97',
        customerId: TEST_CUSTOMER_ID,
        status: 'cancelled',
        createdAt: BEFORE_CUTOFF
    },
    {
        id: 'b445be3d-3c67-43de-ad1a-2a86fa81d72a',
        customerId: TEST_CUSTOMER_ID,
        status: 'cancelled',
        createdAt: BEFORE_CUTOFF
    }
];

describe('0068-hos-749-prod-billing-cleanup', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('is declared destructive and required', () => {
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0068-hos-749-prod-billing-cleanup');
    });

    it('is a no-op outside production', async () => {
        process.env.NODE_ENV = 'development';
        const probe = buildFakeDb({ subscriptions: INVENTORY_SUBSCRIPTIONS });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.writeOrder).toHaveLength(0);
        expect(result.summary).toContain('Skipped');
    });

    it("preserves the owner's comp subscription and every unlisted comp", async () => {
        const probe = buildFakeDb({ subscriptions: INVENTORY_SUBSCRIPTIONS });

        const result = await migration.up(buildCtx(probe.db));

        const written = probe.updates[getTableName(billingSubscriptions)] ?? [];
        // The owner's grant and Romina's unlisted comp are never written.
        expect(written).not.toContain(OWNER_COMP_ID);
        expect(written).not.toContain(REAL_USER_COMP_ID);
        // The listed smoke comp and both cancelled rows are.
        expect(written).toContain(SMOKE_COMP_ID);
        expect(written).toContain('fa6abdd1-c98b-4780-ad3e-53c24888ad97');
        expect(written).toContain('b445be3d-3c67-43de-ad1a-2a86fa81d72a');
        expect(result.counts?.preservedSubscriptions).toBe(2);
        expect(result.counts?.subscriptionsSoftDeleted).toBe(3);
        expect(result.summary).toContain(OWNER_COMP_ID);
    });

    it('purges a comp ONLY when its id is on the explicit list', async () => {
        // Same three comps, but with the two cancelled rows removed so the write
        // set isolates the comp decision.
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS.filter((s) => s.status === 'comp')
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.updates[getTableName(billingSubscriptions)]).toEqual([SMOKE_COMP_ID]);
        expect(result.counts?.subscriptionsSoftDeleted).toBe(1);
        expect(result.counts?.preservedSubscriptions).toBe(2);
    });

    it('preserves the billing customer of every preserved subscription', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            customers: [
                { id: OWNER_CUSTOMER_ID, createdAt: BEFORE_CUTOFF },
                { id: REAL_USER_CUSTOMER_ID, createdAt: BEFORE_CUTOFF },
                { id: SMOKE_CUSTOMER_ID, createdAt: BEFORE_CUTOFF },
                { id: TEST_CUSTOMER_ID, createdAt: BEFORE_CUTOFF }
            ]
        });

        await migration.up(buildCtx(probe.db));

        const written = probe.updates[getTableName(billingCustomers)] ?? [];
        expect(written).not.toContain(OWNER_CUSTOMER_ID);
        expect(written).not.toContain(REAL_USER_CUSTOMER_ID);
        expect(written).toEqual(expect.arrayContaining([SMOKE_CUSTOMER_ID, TEST_CUSTOMER_ID]));
    });

    it('writes children before parents (no live row left pointing at a soft-deleted parent)', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            customers: [{ id: TEST_CUSTOMER_ID, createdAt: BEFORE_CUTOFF }],
            payments: [{ id: 'pay-1' }],
            addonPurchases: [{ id: 'addon-1' }]
        });

        await migration.up(buildCtx(probe.db));

        expect(probe.writeOrder).toEqual([
            getTableName(billingPayments),
            getTableName(billingAddonPurchases),
            getTableName(billingSubscriptions),
            getTableName(billingCustomers)
        ]);
    });

    it('never targets a row created after the inventory cutoff', async () => {
        const probe = buildFakeDb({
            subscriptions: [
                ...INVENTORY_SUBSCRIPTIONS,
                {
                    id: 'new-real-customer-sub',
                    customerId: 'new-real-customer',
                    status: 'active',
                    createdAt: AFTER_CUTOFF
                }
            ],
            customers: [
                { id: TEST_CUSTOMER_ID, createdAt: BEFORE_CUTOFF },
                { id: 'new-real-customer', createdAt: AFTER_CUTOFF }
            ]
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(result.counts?.skippedAfterCutoff).toBe(1);
        // 3 targeted subscriptions, and only the pre-cutoff customer.
        expect(result.counts?.subscriptionsSoftDeleted).toBe(3);
        expect(result.counts?.customersSoftDeleted).toBe(1);
    });

    it('is idempotent — a second run over already-soft-deleted rows writes nothing', async () => {
        // The live-row reads all filter `deleted_at IS NULL`, so a second run
        // sees an empty world.
        const probe = buildFakeDb({ subscriptions: [], customers: [] });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.writeOrder).toHaveLength(0);
        expect(result.counts?.subscriptionsSoftDeleted).toBe(0);
        expect(result.counts?.customersSoftDeleted).toBe(0);
        expect(result.counts?.paymentsSoftDeleted).toBe(0);
    });

    it('ABORTS when an unclassified table still references a targeted row', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            customers: [{ id: TEST_CUSTOMER_ID, createdAt: BEFORE_CUTOFF }],
            inboundFks: {
                billing_subscriptions: [
                    {
                        referencingTable: 'billing_brand_new_table',
                        referencingColumn: 'subscription_id',
                        constraintName: 'fk_brand_new'
                    }
                ]
            },
            referrerCount: 4
        });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(
            /Unclassified referencing table/
        );
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('ABORTS on an FK order violation instead of writing in the wrong order', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            inboundFks: {
                // billing_customers is written LAST, so it must never be
                // reported as referencing billing_payments (written FIRST).
                billing_payments: [
                    {
                        referencingTable: 'billing_customers',
                        referencingColumn: 'default_payment_id',
                        constraintName: 'fk_inverted'
                    }
                ]
            }
        });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(/FK order violation/);
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('ABORTS when a commerce link row still holds an entitlement-granting status', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            retainedRows: {
                [getTableName(commerceListingSubscriptions)]: [{ id: 'cls-still-active' }]
            }
        });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(
            /commerce_listing_subscriptions row\(s\) still hold an entitlement-granting status/
        );
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('ABORTS when a partner link row still holds an entitlement-granting status', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            retainedRows: {
                [getTableName(partnerSubscriptions)]: [{ id: 'partner-still-active' }]
            }
        });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(
            /partner_subscriptions row\(s\) still hold an entitlement-granting status/
        );
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('ABORTS when a pending, unexpired checkout survives for a targeted customer', async () => {
        const probe = buildFakeDb({
            subscriptions: INVENTORY_SUBSCRIPTIONS,
            customers: [{ id: TEST_CUSTOMER_ID, createdAt: BEFORE_CUTOFF }],
            retainedRows: {
                [getTableName(billingPendingCheckouts)]: [{ id: 'checkout-reusable' }]
            }
        });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(
            /billing_pending_checkouts row\(s\) are still 'pending' and unexpired/
        );
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('ABORTS when the target set blows past the sanity fuse', async () => {
        const many: SubscriptionRow[] = Array.from({ length: 40 }, (_unused, index) => ({
            id: `sub-${index}`,
            customerId: `cust-${index}`,
            status: 'cancelled',
            createdAt: BEFORE_CUTOFF
        }));
        const probe = buildFakeDb({ subscriptions: many });

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(/MAX_TARGET_SUBSCRIPTIONS/);
        expect(probe.writeOrder).toHaveLength(0);
    });

    it('never touches the users table — static guard on the migration source', () => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const source = readFileSync(
            path.resolve(here, '../../src/data-migrations/0068-hos-749-prod-billing-cleanup.ts'),
            'utf8'
        );
        // Strip comment prose so an explanatory mention of "users" cannot fail
        // the guard, then assert no executable reference remains.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

        // The Drizzle table symbol, imported or used in any query builder.
        expect(code).not.toMatch(/\busers\b(?!\s*(?:was|table))/);
        expect(code).not.toMatch(/\bUserModel\b/);
        expect(code).not.toMatch(/\bctx\.models\b/);
        // And the raw table name, in case someone reaches for sql.identifier().
        expect(code).not.toMatch(/['"`]users['"`]/);
    });
});
