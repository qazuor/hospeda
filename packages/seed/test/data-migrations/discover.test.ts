/**
 * @fileoverview
 * Tests for the migration discovery + ledger-diff layer (HOS-25, T-008):
 * {@link discoverMigrationFiles} and {@link computePendingMigrations}.
 *
 * `discoverMigrationFiles` is exercised against fixture directories under
 * `__fixtures__/discover/` (no DB, real filesystem + dynamic import).
 * `computePendingMigrations` is pure and is tested exclusively against
 * hand-built `DiscoveredMigration[]` fixtures — no filesystem, no DB.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    computePendingMigrations,
    type DiscoveredMigration,
    discoverMigrationFiles
} from '../../src/data-migrations/discover.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '__fixtures__/discover');

describe('HOS-25 T-008: discoverMigrationFiles', () => {
    it('returns migrations sorted by numeric prefix ascending, regardless of filesystem order', async () => {
        const discovered = await discoverMigrationFiles({ dir: path.join(FIXTURES_DIR, 'valid') });

        expect(discovered.map((m) => m.name)).toEqual(['0001-alpha', '0002-bravo', '0003-charlie']);
        expect(discovered.map((m) => m.numericPrefix)).toEqual([1, 2, 3]);
    });

    it('parses meta and loads the module for each discovered migration', async () => {
        const discovered = await discoverMigrationFiles({ dir: path.join(FIXTURES_DIR, 'valid') });

        const alpha = discovered.find((m) => m.name === '0001-alpha');
        expect(alpha).toBeDefined();
        expect(alpha?.meta.group).toBe('required');
        expect(alpha?.module.meta).toBe(alpha?.meta);
        expect(typeof alpha?.module.up).toBe('function');
    });

    it('excludes files that do not match the NNNN-slug.ts naming convention', async () => {
        const discovered = await discoverMigrationFiles({ dir: path.join(FIXTURES_DIR, 'valid') });

        expect(discovered.some((m) => m.name === 'helper')).toBe(false);
        expect(discovered).toHaveLength(3);
    });

    it('throws when two files share the same numeric prefix', async () => {
        await expect(
            discoverMigrationFiles({ dir: path.join(FIXTURES_DIR, 'duplicate-prefix') })
        ).rejects.toThrow(/Duplicate data-migration numeric prefix/);
    });

    it('throws when meta.name does not match the filename stem', async () => {
        await expect(
            discoverMigrationFiles({ dir: path.join(FIXTURES_DIR, 'name-mismatch') })
        ).rejects.toThrow(/does not match its filename stem/);
    });
});

describe('HOS-25 T-008: computePendingMigrations (pure, no filesystem/DB)', () => {
    function buildMigration(overrides: {
        name: string;
        numericPrefix: number;
        group?: 'required' | 'example';
    }): DiscoveredMigration {
        const meta = { name: overrides.name, group: overrides.group ?? 'required' } as const;
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

    const migrationA = buildMigration({ name: '0001-a', numericPrefix: 1, group: 'required' });
    const migrationB = buildMigration({ name: '0002-b', numericPrefix: 2, group: 'example' });
    const migrationC = buildMigration({ name: '0003-c', numericPrefix: 3, group: 'required' });
    const discovered: readonly DiscoveredMigration[] = [migrationA, migrationB, migrationC];

    it('filters out migrations already recorded in the ledger', () => {
        const pending = computePendingMigrations({
            discovered,
            applied: new Set(['0001-a'])
        });

        expect(pending.map((m) => m.name)).toEqual(['0002-b', '0003-c']);
    });

    it('preserves the input order of the discovered array', () => {
        const pending = computePendingMigrations({
            discovered,
            applied: new Set()
        });

        expect(pending.map((m) => m.name)).toEqual(['0001-a', '0002-b', '0003-c']);
    });

    it('filters to a single group when provided', () => {
        const pending = computePendingMigrations({
            discovered,
            applied: new Set(),
            group: 'required'
        });

        expect(pending.map((m) => m.name)).toEqual(['0001-a', '0003-c']);
    });

    it('combines the applied filter and the group filter', () => {
        const pending = computePendingMigrations({
            discovered,
            applied: new Set(['0001-a']),
            group: 'required'
        });

        expect(pending.map((m) => m.name)).toEqual(['0003-c']);
    });

    it('returns an empty array when every migration is already applied', () => {
        const pending = computePendingMigrations({
            discovered,
            applied: new Set(['0001-a', '0002-b', '0003-c'])
        });

        expect(pending).toEqual([]);
    });
});
