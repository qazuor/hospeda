/**
 * @fileoverview
 * Unit tests for ledger rows whose migration file no longer exists on disk
 * (HOS-1419 TEST:U1:11). The seed ledger of a live environment keeps the rows of
 * data-migrations that were later deleted from the tree; neither the runner nor
 * `--baseline-stamp` may trip over them, and the stamp may only record what is
 * actually on disk. No database: the ledger read is a stubbed Drizzle chain and
 * `recordApplied` is a spy.
 *
 * @module test/data-migrations/orphan-ledger-rows
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baselineStamp } from '../../src/data-migrations/baselineStamp.js';
import { recordApplied } from '../../src/data-migrations/ledger.js';
import { resolvePendingMigrations, runMigrations } from '../../src/data-migrations/runner.js';

vi.mock('../../src/data-migrations/ledger.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/data-migrations/ledger.js')>();
    return { ...actual, recordApplied: vi.fn(async () => undefined) };
});

const FIXTURES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '__fixtures__/baseline'
);

const ON_DISK = [
    '0001-zzz-test-baseline-alpha',
    '0002-zzz-test-baseline-bravo',
    '0003-zzz-test-baseline-charlie'
] as const;

/** Names that sit in the ledger of a live env but have no file in the tree. */
const ORPHANS = ['0900-zzz-deleted-old-billing', '0901-zzz-deleted-other'] as const;

/** Builds a fake Drizzle client whose ledger read returns the given names. */
function buildDb(ledgerNames: readonly string[]): DrizzleClient {
    const rows = ledgerNames.map((name) => ({
        name,
        group: 'required',
        checksum: 'x',
        appliedAt: new Date(0),
        durationMs: 0,
        result: 'ok'
    }));
    return {
        select: () => ({ from: () => ({ orderBy: () => Promise.resolve(rows) }) })
    } as unknown as DrizzleClient;
}

describe('ledger rows without a file on disk', () => {
    beforeEach(() => {
        vi.mocked(recordApplied).mockClear();
    });

    it('runMigrations ignores orphan rows and reports nothing pending', async () => {
        // Arrange
        const db = buildDb([...ON_DISK, ...ORPHANS]);
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

        // Act
        const result = await runMigrations({
            db,
            dir: FIXTURES_DIR,
            logger: logger as never
        });

        // Assert
        expect(result.applied).toEqual([]);
        expect(result.pendingCount).toBe(0);
        expect(result.skipped).toEqual([...ON_DISK]);
    });

    it('resolvePendingMigrations does not list an orphan as pending or discovered', async () => {
        const db = buildDb([ON_DISK[0], ...ORPHANS]);

        const { pending, discovered } = await resolvePendingMigrations({
            db,
            dir: FIXTURES_DIR
        });

        expect(pending.map((m) => m.name)).toEqual([ON_DISK[1], ON_DISK[2]]);
        expect(discovered.map((m) => m.name)).not.toContain(ORPHANS[0]);
    });

    it('baselineStamp stamps only the pending files that are on disk', async () => {
        const db = buildDb([ON_DISK[0], ...ORPHANS]);

        const result = await baselineStamp({ db, dir: FIXTURES_DIR });

        expect(result.stamped).toEqual([ON_DISK[1], ON_DISK[2]]);
        const stampedNames = vi.mocked(recordApplied).mock.calls.map(([arg]) => arg.name);
        expect(stampedNames).toEqual([ON_DISK[1], ON_DISK[2]]);
        for (const orphan of ORPHANS) {
            expect(stampedNames).not.toContain(orphan);
        }
    });

    it('baselineStamp over a ledger of only orphans stamps exactly the files on disk', async () => {
        const db = buildDb([...ORPHANS]);

        const result = await baselineStamp({ db, dir: FIXTURES_DIR });

        expect(result.stamped).toEqual([...ON_DISK]);
        expect(vi.mocked(recordApplied)).toHaveBeenCalledTimes(ON_DISK.length);
    });
});
