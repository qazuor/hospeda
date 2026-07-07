/**
 * @fileoverview
 * Tests for the migration status reporter (HOS-25, T-012):
 * {@link computeMigrationStatus} and {@link formatMigrationStatus}.
 *
 * Focused entirely on the pure functions — hand-built {@link DiscoveredMigration}
 * fixtures and hand-built ledger rows, no filesystem, no database. A DB
 * round-trip test for {@link getMigrationStatus} is intentionally omitted here
 * (it's a thin I/O wrapper already exercised end-to-end by the runner's own
 * integration coverage); the pure join/diff logic is where the real behavior
 * lives and is covered exhaustively below.
 */
import type { SelectSeedMigration } from '@repo/db';
import { describe, expect, it } from 'vitest';
import type { DiscoveredMigration } from '../../src/data-migrations/discover.js';
import {
    type AppliedMigrationStatusEntry,
    computeMigrationStatus,
    formatMigrationStatus,
    type MigrationStatus,
    type PendingMigrationStatusEntry
} from '../../src/data-migrations/status.js';
import type { SeedMigrationGroup } from '../../src/data-migrations/types.js';

function buildDiscovered(overrides: {
    name: string;
    numericPrefix: number;
    group?: SeedMigrationGroup;
}): DiscoveredMigration {
    const meta = {
        name: overrides.name,
        group: overrides.group ?? 'required'
    } as const;

    return {
        name: overrides.name,
        numericPrefix: overrides.numericPrefix,
        filePath: `/fake/${overrides.name}.ts`,
        meta,
        module: {
            meta,
            up: async () => ({})
        }
    };
}

function buildLedgerRow(overrides: {
    name: string;
    group?: string;
    appliedAt?: Date;
    result?: string;
}): SelectSeedMigration {
    return {
        name: overrides.name,
        group: overrides.group ?? 'required',
        checksum: 'fake-checksum',
        appliedAt: overrides.appliedAt ?? new Date('2026-07-01T12:00:00.000Z'),
        durationMs: 10,
        result: overrides.result ?? 'ok'
    };
}

describe('HOS-25 T-012: computeMigrationStatus (pure, no filesystem/DB)', () => {
    it('partitions discovered migrations into applied and pending', () => {
        const discovered = [
            buildDiscovered({ name: '0001-alpha', numericPrefix: 1 }),
            buildDiscovered({ name: '0002-bravo', numericPrefix: 2 }),
            buildDiscovered({ name: '0003-charlie', numericPrefix: 3 })
        ];
        const rows = [buildLedgerRow({ name: '0001-alpha' })];

        const status = computeMigrationStatus({
            discovered,
            applied: { names: new Set(['0001-alpha']), rows }
        });

        expect(status.applied.map((entry) => entry.name)).toEqual(['0001-alpha']);
        expect(status.pending.map((entry) => entry.name)).toEqual(['0002-bravo', '0003-charlie']);
        expect(status.appliedCount).toBe(1);
        expect(status.pendingCount).toBe(2);
    });

    it('preserves the numeric order of discovered pending migrations', () => {
        const discovered = [
            buildDiscovered({ name: '0001-alpha', numericPrefix: 1 }),
            buildDiscovered({ name: '0002-bravo', numericPrefix: 2 }),
            buildDiscovered({ name: '0010-kilo', numericPrefix: 10 })
        ];

        const status = computeMigrationStatus({
            discovered,
            applied: { names: new Set(), rows: [] }
        });

        expect(status.pending.map((entry) => entry.name)).toEqual([
            '0001-alpha',
            '0002-bravo',
            '0010-kilo'
        ]);
    });

    it('preserves ledger row order (name ascending) for applied migrations', () => {
        const discovered = [
            buildDiscovered({ name: '0001-alpha', numericPrefix: 1 }),
            buildDiscovered({ name: '0002-bravo', numericPrefix: 2 }),
            buildDiscovered({ name: '0010-kilo', numericPrefix: 10 })
        ];
        const rows = [
            buildLedgerRow({ name: '0001-alpha' }),
            buildLedgerRow({ name: '0002-bravo' }),
            buildLedgerRow({ name: '0010-kilo' })
        ];

        const status = computeMigrationStatus({
            discovered,
            applied: { names: new Set(rows.map((row) => row.name)), rows }
        });

        expect(status.applied.map((entry) => entry.name)).toEqual([
            '0001-alpha',
            '0002-bravo',
            '0010-kilo'
        ]);
        expect(status.pending).toHaveLength(0);
    });

    it('scopes both applied and pending to the requested group', () => {
        const discovered = [
            buildDiscovered({ name: '0001-alpha', numericPrefix: 1, group: 'required' }),
            buildDiscovered({ name: '0002-bravo', numericPrefix: 2, group: 'example' }),
            buildDiscovered({ name: '0003-charlie', numericPrefix: 3, group: 'required' })
        ];
        const rows = [
            buildLedgerRow({ name: '0001-alpha', group: 'required' }),
            buildLedgerRow({ name: '0002-bravo', group: 'example' })
        ];

        const status = computeMigrationStatus({
            discovered,
            applied: { names: new Set(rows.map((row) => row.name)), rows },
            group: 'required'
        });

        expect(status.applied.map((entry) => entry.name)).toEqual(['0001-alpha']);
        expect(status.pending.map((entry) => entry.name)).toEqual(['0003-charlie']);
        expect(status.appliedCount).toBe(1);
        expect(status.pendingCount).toBe(1);
    });

    it('includes an orphaned ledger row (no matching file on disk) in applied, flagged', () => {
        const discovered = [buildDiscovered({ name: '0001-alpha', numericPrefix: 1 })];
        const rows = [
            buildLedgerRow({ name: '0001-alpha' }),
            buildLedgerRow({ name: '0002-deleted-migration' })
        ];

        const status = computeMigrationStatus({
            discovered,
            applied: { names: new Set(rows.map((row) => row.name)), rows }
        });

        expect(status.appliedCount).toBe(2);
        const orphan = status.applied.find((entry) => entry.name === '0002-deleted-migration');
        expect(orphan).toBeDefined();
        expect(orphan?.orphaned).toBe(true);

        const nonOrphan = status.applied.find((entry) => entry.name === '0001-alpha');
        expect(nonOrphan?.orphaned).toBe(false);
    });

    it('scopes an orphaned row to its own ledger-recorded group, not any discovered meta', () => {
        const discovered: DiscoveredMigration[] = [];
        const rows = [buildLedgerRow({ name: '0002-deleted-migration', group: 'example' })];

        const requiredOnly = computeMigrationStatus({
            discovered,
            applied: { names: new Set(rows.map((row) => row.name)), rows },
            group: 'required'
        });
        const exampleOnly = computeMigrationStatus({
            discovered,
            applied: { names: new Set(rows.map((row) => row.name)), rows },
            group: 'example'
        });

        expect(requiredOnly.appliedCount).toBe(0);
        expect(exampleOnly.appliedCount).toBe(1);
        expect(exampleOnly.applied[0]?.orphaned).toBe(true);
    });

    it('normalizes an unrecognized ledger group value defensively instead of throwing', () => {
        const rows = [buildLedgerRow({ name: '0099-corrupted', group: 'not-a-real-group' })];

        const status = computeMigrationStatus({
            discovered: [],
            applied: { names: new Set(['0099-corrupted']), rows }
        });

        expect(status.applied[0]?.group).toBe('required');
    });

    it('returns empty applied/pending when nothing is discovered and nothing is applied', () => {
        const status = computeMigrationStatus({
            discovered: [],
            applied: { names: new Set(), rows: [] }
        });

        expect(status.applied).toEqual([]);
        expect(status.pending).toEqual([]);
        expect(status.appliedCount).toBe(0);
        expect(status.pendingCount).toBe(0);
    });
});

describe('HOS-25 T-012: formatMigrationStatus (pure)', () => {
    it('renders applied and pending sections with counts', () => {
        const applied: AppliedMigrationStatusEntry[] = [
            {
                name: '0001-alpha',
                group: 'required',
                appliedAt: new Date('2026-07-01T12:00:00.000Z'),
                result: 'ok',
                orphaned: false
            }
        ];
        const pending: PendingMigrationStatusEntry[] = [{ name: '0002-bravo', group: 'example' }];
        const status: MigrationStatus = {
            applied,
            pending,
            appliedCount: applied.length,
            pendingCount: pending.length
        };

        const output = formatMigrationStatus(status);

        expect(output).toContain('Applied (1):');
        expect(output).toContain('0001-alpha');
        expect(output).toContain('2026-07-01T12:00:00.000Z');
        expect(output).toContain('Pending (1):');
        expect(output).toContain('0002-bravo');
        expect(output).toContain('1 applied, 1 pending');
    });

    it('marks orphaned entries with an [ORPHAN] suffix', () => {
        const status: MigrationStatus = {
            applied: [
                {
                    name: '0002-deleted-migration',
                    group: 'required',
                    appliedAt: new Date('2026-07-02T09:30:00.000Z'),
                    result: 'ok',
                    orphaned: true
                }
            ],
            pending: [],
            appliedCount: 1,
            pendingCount: 0
        };

        const output = formatMigrationStatus(status);

        expect(output).toContain('[ORPHAN');
    });

    it('renders "(none)" placeholders for empty applied/pending sections', () => {
        const status: MigrationStatus = {
            applied: [],
            pending: [],
            appliedCount: 0,
            pendingCount: 0
        };

        const output = formatMigrationStatus(status);

        expect(output).toContain('Applied (0):');
        expect(output).toContain('Pending (0):');
        expect((output.match(/\(none\)/g) ?? []).length).toBe(2);
        expect(output).toContain('0 applied, 0 pending');
    });
});
