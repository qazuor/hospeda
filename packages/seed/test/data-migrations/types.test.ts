/**
 * @fileoverview
 * Type-level contract tests for the versioned seed data-migration module
 * types (HOS-25, T-003).
 *
 * These are compile-time assertions only — there is no runtime behavior to
 * exercise (no DB, no `up()` invocation). A well-formed sample migration
 * module is declared with `satisfies SeedMigrationModule` so a shape
 * violation fails `tsc`/`vitest` at compile time, and `expectTypeOf` pins
 * down the exact narrowed shape of each exported type.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type {
    SafeDeleteResult,
    SeedMigrationCtx,
    SeedMigrationGroup,
    SeedMigrationHelpers,
    SeedMigrationMeta,
    SeedMigrationModule,
    SeedMigrationResult
} from '../../src/data-migrations/types.js';

/**
 * A well-formed, minimal sample migration module. If any required field of
 * `SeedMigrationModule` is missing or mistyped, this `satisfies` assertion
 * fails to compile.
 */
const sampleMeta = {
    name: '0001-sample-migration',
    group: 'required'
} as const satisfies SeedMigrationMeta;

const sampleModule = {
    meta: sampleMeta,
    up: async (_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> => {
        return { summary: 'sample migration applied', counts: { inserted: 1 } };
    }
} satisfies SeedMigrationModule;

describe('SeedMigrationGroup', () => {
    it('should only allow the required and example literals', () => {
        expectTypeOf<SeedMigrationGroup>().toEqualTypeOf<'required' | 'example'>();
    });
});

describe('SeedMigrationMeta', () => {
    it('should require name and group, and make destructive optional', () => {
        expectTypeOf<SeedMigrationMeta>().toHaveProperty('name');
        expectTypeOf<SeedMigrationMeta>().toHaveProperty('group');
        expectTypeOf<SeedMigrationMeta['name']>().toEqualTypeOf<string>();
        expectTypeOf<SeedMigrationMeta['group']>().toEqualTypeOf<SeedMigrationGroup>();
        expectTypeOf<SeedMigrationMeta['destructive']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept a well-formed const meta object', () => {
        expectTypeOf(sampleMeta).toMatchTypeOf<SeedMigrationMeta>();
    });

    it('should reject a meta object with an invalid group at the type level', () => {
        const invalidMeta = {
            name: '0002-invalid',
            group: 'not-a-real-group'
        };

        // @ts-expect-error group must be 'required' | 'example'
        const _typeCheck: SeedMigrationMeta = invalidMeta;
    });
});

describe('SeedMigrationCtx', () => {
    it('should expose db, models, services and helpers', () => {
        expectTypeOf<SeedMigrationCtx>().toHaveProperty('db');
        expectTypeOf<SeedMigrationCtx>().toHaveProperty('models');
        expectTypeOf<SeedMigrationCtx>().toHaveProperty('services');
        expectTypeOf<SeedMigrationCtx>().toHaveProperty('helpers');
        expectTypeOf<SeedMigrationCtx['helpers']>().toEqualTypeOf<SeedMigrationHelpers>();
    });
});

describe('SafeDeleteResult', () => {
    it('should discriminate on deleted', () => {
        const deleted: SafeDeleteResult = { deleted: true };
        const skipped: SafeDeleteResult = {
            deleted: false,
            skipped: true,
            reason: 'active FK reference'
        };

        expectTypeOf(deleted).toMatchTypeOf<SafeDeleteResult>();
        expectTypeOf(skipped).toMatchTypeOf<SafeDeleteResult>();

        if (skipped.deleted === false) {
            // Narrowing must expose `reason` as a string once `deleted` is false.
            expectTypeOf(skipped.reason).toEqualTypeOf<string>();
        }
    });
});

describe('SeedMigrationModule', () => {
    it('should accept a well-formed module satisfying the contract', () => {
        expectTypeOf(sampleModule.meta).toEqualTypeOf<SeedMigrationMeta>();
        expectTypeOf(sampleModule.up).toEqualTypeOf<
            (ctx: SeedMigrationCtx) => Promise<SeedMigrationResult>
        >();
    });

    it('should reject a module missing up() at the type level', () => {
        const invalidModule = { meta: sampleMeta };

        // @ts-expect-error up() is required
        const _typeCheck: SeedMigrationModule = invalidModule;
    });
});
