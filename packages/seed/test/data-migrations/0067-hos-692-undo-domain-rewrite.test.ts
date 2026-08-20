/**
 * @fileoverview
 * Unit tests for the `0067-hos-692-undo-domain-rewrite` data migration, using
 * a mocked query chain — no real database connection. Same style as
 * `0056-hos-581-unmangle-billing-customer-email.test.ts`.
 *
 * Covers: the default-inert confirmation gate (HOS-692's #1 documented
 * design decision — see the migration's own module docblock), the missing-
 * ledger-row guard, and that an actual invocation never writes `null`.
 *
 * @module test/data-migrations/0067-hos-692-undo-domain-rewrite
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0067-hos-692-undo-domain-rewrite.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const CONFIRM_ENV_VAR = 'HOSPEDA_CONFIRM_HOS_692_DOMAIN_ROLLBACK';
const FORWARD_NAME = '0066-hos-692-domain-rewrite-and-plan-cleanup';

type TableKind = 'ledger' | 'subscriptions' | 'link';

function identifyTable(table: unknown): TableKind {
    const keys = table && typeof table === 'object' ? Object.keys(table) : [];
    if (keys.includes('checksum')) return 'ledger';
    if (keys.includes('billingInterval')) return 'subscriptions';
    if (keys.includes('entityType')) return 'link';
    throw new Error(`identifyTable: unrecognized table shape: ${keys.join(', ')}`);
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    readonly subscriptionWrites: () => readonly unknown[];
    readonly linkRowWrites: () => readonly unknown[];
}

function buildFakeDb(ledgerRows: readonly { name: string; appliedAt: Date }[]): FakeDbProbe {
    const subscriptionWrites: unknown[] = [];
    const linkRowWrites: unknown[] = [];

    const db = {
        select: () => ({
            from: (table: unknown) => {
                if (identifyTable(table) !== 'ledger') {
                    throw new Error('buildFakeDb: unexpected select().from() outside the ledger');
                }
                return { orderBy: (_o: unknown) => Promise.resolve(ledgerRows) };
            }
        }),
        update: (table: unknown) => {
            const kind = identifyTable(table);
            return {
                set: (values: { productDomain?: unknown }) => ({
                    where: (_predicate: unknown) => ({
                        returning: (_fields: unknown) => {
                            if (kind === 'subscriptions') {
                                subscriptionWrites.push(values.productDomain);
                                return Promise.resolve([{ id: 'sub-1' }]);
                            }
                            if (kind === 'link') {
                                linkRowWrites.push(values.productDomain);
                                return Promise.resolve([{ id: 'link-1' }]);
                            }
                            throw new Error('buildFakeDb: unexpected update() table');
                        }
                    })
                })
            };
        }
    } as unknown as SeedMigrationCtx['db'];

    return {
        db,
        subscriptionWrites: () => subscriptionWrites,
        linkRowWrites: () => linkRowWrites
    };
}

function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

describe('0067-hos-692-undo-domain-rewrite', () => {
    afterEach(() => {
        delete process.env[CONFIRM_ENV_VAR];
    });

    it('is declared destructive and required', () => {
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.group).toBe('required');
    });

    it('is a no-op by default — the confirmation flag is unset', async () => {
        const probe = buildFakeDb([]);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.subscriptionWrites()).toHaveLength(0);
        expect(probe.linkRowWrites()).toHaveLength(0);
        expect(result.summary).toContain('Skipped');
        expect(result.counts?.skipped).toBe(1);
    });

    it('is STILL a no-op when the flag is set to something other than the literal "true"', async () => {
        process.env[CONFIRM_ENV_VAR] = '1';
        const probe = buildFakeDb([]);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.subscriptionWrites()).toHaveLength(0);
        expect(result.counts?.skipped).toBe(1);
    });

    it('throws when confirmed but the forward migration has never applied', async () => {
        process.env[CONFIRM_ENV_VAR] = 'true';
        const probe = buildFakeDb([]); // empty ledger — 0066 never ran

        await expect(migration.up(buildCtx(probe.db))).rejects.toThrow(FORWARD_NAME);
    });

    it('when confirmed and the bound exists, writes ONLY the literal string "commerce" — never null', async () => {
        process.env[CONFIRM_ENV_VAR] = 'true';
        const probe = buildFakeDb([
            { name: FORWARD_NAME, appliedAt: new Date('2026-08-20T00:00:00Z') }
        ]);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.subscriptionWrites()).toEqual(['commerce']);
        expect(probe.linkRowWrites()).toEqual(['commerce']);
        for (const value of [...probe.subscriptionWrites(), ...probe.linkRowWrites()]) {
            expect(value).not.toBeNull();
            expect(value).not.toBeUndefined();
        }
        expect(result.summary).toContain('EXECUTED');
    });
});
