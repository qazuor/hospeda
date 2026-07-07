/**
 * @fileoverview
 * Unit tests for {@link partitionTablesForReset} (HOS-25, T-002).
 *
 * `resetDatabase` truncates every discovered `public`-schema table except an
 * always-excluded set. The exclude-list logic is exercised here as a pure
 * function — no live database connection is needed, and none is used: a real
 * `resetDatabase()` call would TRUNCATE the shared worktree database that
 * other tests depend on, so it is intentionally never invoked from this file.
 *
 * Coverage focus: `seed_migrations` (the HOS-25 versioned seed data-migration
 * ledger) must always survive a reset, exactly like `drizzle_migrations`
 * already does — otherwise every `--reset` would wipe the applied-migrations
 * record and every seed data-migration would silently re-run from scratch.
 */
import { describe, expect, it } from 'vitest';
import { partitionTablesForReset } from '../../src/utils/dbReset.js';

describe('partitionTablesForReset', () => {
    it('excludes seed_migrations even when the caller does not ask to exclude it', () => {
        // Arrange
        const discoveredTables = ['users', 'seed_migrations', 'accommodations'];

        // Act
        const result = partitionTablesForReset({ discoveredTables, exclude: [] });

        // Assert
        expect(result.tablesToReset).not.toContain('seed_migrations');
        expect(result.tablesSkipped).toContain('seed_migrations');
        expect(result.tablesToReset).toEqual(['users', 'accommodations']);
    });

    it('excludes drizzle_migrations alongside seed_migrations (both always-excluded)', () => {
        // Arrange
        const discoveredTables = ['users', 'drizzle_migrations', 'seed_migrations'];

        // Act
        const result = partitionTablesForReset({ discoveredTables, exclude: [] });

        // Assert
        expect(result.tablesToReset).toEqual(['users']);
        expect(result.tablesSkipped).toEqual(['drizzle_migrations', 'seed_migrations']);
    });

    it('still honors caller-supplied excludes in addition to the always-excluded set', () => {
        // Arrange
        const discoveredTables = ['users', 'accommodations', 'seed_migrations'];

        // Act
        const result = partitionTablesForReset({
            discoveredTables,
            exclude: ['accommodations']
        });

        // Assert
        expect(result.tablesToReset).toEqual(['users']);
        expect(result.tablesSkipped).toEqual(['accommodations', 'seed_migrations']);
    });

    it('does not duplicate a table in tablesSkipped when caller and always-exclude overlap', () => {
        // Arrange — caller redundantly excludes seed_migrations too
        const discoveredTables = ['users', 'seed_migrations'];

        // Act
        const result = partitionTablesForReset({
            discoveredTables,
            exclude: ['seed_migrations']
        });

        // Assert
        expect(result.tablesSkipped).toEqual(['seed_migrations']);
        expect(result.tablesToReset).toEqual(['users']);
    });

    it('returns every discovered table as reset-eligible when nothing matches the exclude set', () => {
        // Arrange
        const discoveredTables = ['users', 'accommodations', 'destinations'];

        // Act
        const result = partitionTablesForReset({ discoveredTables, exclude: [] });

        // Assert
        expect(result.tablesToReset).toEqual(discoveredTables);
        expect(result.tablesSkipped).toEqual([]);
    });

    it('handles an empty discovered-tables list without error', () => {
        // Act
        const result = partitionTablesForReset({ discoveredTables: [], exclude: [] });

        // Assert
        expect(result.tablesToReset).toEqual([]);
        expect(result.tablesSkipped).toEqual([]);
    });
});
