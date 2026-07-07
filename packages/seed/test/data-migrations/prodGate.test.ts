import { describe, expect, it } from 'vitest';
import { evaluateProdDataMigrationGate } from '../../src/data-migrations/prodGate.js';
import type { SeedMigrationMeta } from '../../src/data-migrations/types.js';

/**
 * HOS-25 T-011 regression tests for the production safety gate that protects
 * destructive versioned seed data-migrations.
 *
 * The gate is exposed as the pure helper {@link evaluateProdDataMigrationGate}
 * so it can be exercised directly, without running the migration runner or
 * touching a database.
 */
describe('HOS-25 T-011: evaluateProdDataMigrationGate', () => {
    const nonDestructiveMeta: SeedMigrationMeta = {
        name: '0001-add-wifi-amenity',
        group: 'required'
    };

    const destructiveMeta: SeedMigrationMeta = {
        name: '0002-remove-legacy-feature',
        group: 'required',
        destructive: true
    };

    const exampleMeta: SeedMigrationMeta = {
        name: '0004-seed-example-hotel',
        group: 'example'
    };

    const destructiveExampleMeta: SeedMigrationMeta = {
        name: '0005-purge-example-fixture',
        group: 'example',
        destructive: true
    };

    it('allows the operation in non-production environments even with destructive migrations pending', () => {
        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'development' },
            pendingMeta: [destructiveMeta]
        });

        expect(result.allowed).toBe(true);
        expect(result.destructiveNames).toEqual(['0002-remove-legacy-feature']);
    });

    it('allows the operation in production when no pending migration is destructive', () => {
        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'production' },
            pendingMeta: [nonDestructiveMeta]
        });

        expect(result.allowed).toBe(true);
        expect(result.destructiveNames).toEqual([]);
        expect(result.reason).toBeUndefined();
    });

    it('refuses the operation in production with a destructive migration pending and no opt-in', () => {
        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'production' },
            pendingMeta: [destructiveMeta]
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION/);
        expect(result.reason).toMatch(/--allow-destructive/);
        expect(result.reason).toContain('0002-remove-legacy-feature');
        expect(result.destructiveNames).toEqual(['0002-remove-legacy-feature']);
    });

    it('refuses the operation when the env opt-in is set to a non-true value', () => {
        for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production', HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION: value },
                pendingMeta: [destructiveMeta]
            });

            expect(
                result.allowed,
                `expected gate to refuse for HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION="${value}"`
            ).toBe(false);
        }
    });

    it('allows the operation in production with a destructive migration pending when the env opt-in is true', () => {
        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'production', HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION: 'true' },
            pendingMeta: [destructiveMeta]
        });

        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.destructiveNames).toEqual(['0002-remove-legacy-feature']);
    });

    it('allows the operation in production with a destructive migration pending when the CLI flag is passed', () => {
        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'production' },
            pendingMeta: [destructiveMeta],
            allowDestructiveFlag: true
        });

        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('computes destructiveNames correctly for a mix of destructive and non-destructive pending migrations', () => {
        const anotherDestructive: SeedMigrationMeta = {
            name: '0003-purge-orphan-tags',
            group: 'required',
            destructive: true
        };

        const result = evaluateProdDataMigrationGate({
            env: { NODE_ENV: 'development' },
            pendingMeta: [nonDestructiveMeta, destructiveMeta, anotherDestructive]
        });

        expect(result.destructiveNames).toEqual([
            '0002-remove-legacy-feature',
            '0003-purge-orphan-tags'
        ]);
    });

    describe('HOS-25 review finding M1: example-group migrations refused in production', () => {
        it('refuses the operation in production when a pending migration belongs to the example group', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production' },
                pendingMeta: [nonDestructiveMeta, exampleMeta]
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('example');
            expect(result.reason).toContain('0004-seed-example-hotel');
            expect(result.exampleGroupNames).toEqual(['0004-seed-example-hotel']);
        });

        it('refuses example-group migrations in production regardless of the destructive opt-in env var', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production', HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION: 'true' },
                pendingMeta: [exampleMeta]
            });

            expect(result.allowed).toBe(false);
            expect(result.exampleGroupNames).toEqual(['0004-seed-example-hotel']);
        });

        it('refuses example-group migrations in production regardless of the destructive CLI flag opt-in', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production' },
                pendingMeta: [exampleMeta],
                allowDestructiveFlag: true
            });

            expect(result.allowed).toBe(false);
            expect(result.exampleGroupNames).toEqual(['0004-seed-example-hotel']);
        });

        it('refuses an example-group migration in production even when it is not itself flagged destructive', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production' },
                pendingMeta: [exampleMeta]
            });

            expect(result.allowed).toBe(false);
            expect(result.destructiveNames).toEqual([]);
            expect(result.exampleGroupNames).toEqual(['0004-seed-example-hotel']);
        });

        it('reports both destructiveNames and exampleGroupNames when an example migration is also flagged destructive', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production' },
                pendingMeta: [destructiveExampleMeta],
                allowDestructiveFlag: true
            });

            expect(result.allowed).toBe(false);
            expect(result.destructiveNames).toEqual(['0005-purge-example-fixture']);
            expect(result.exampleGroupNames).toEqual(['0005-purge-example-fixture']);
        });

        it('allows the operation in non-production environments even with an example-group migration pending', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'development' },
                pendingMeta: [exampleMeta]
            });

            expect(result.allowed).toBe(true);
            expect(result.exampleGroupNames).toEqual(['0004-seed-example-hotel']);
        });

        it('allows the operation in production when every pending migration belongs to the required group', () => {
            const result = evaluateProdDataMigrationGate({
                env: { NODE_ENV: 'production' },
                pendingMeta: [nonDestructiveMeta]
            });

            expect(result.allowed).toBe(true);
            expect(result.exampleGroupNames).toEqual([]);
        });
    });
});
