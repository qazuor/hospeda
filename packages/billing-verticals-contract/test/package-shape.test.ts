import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Clock } from '../src/index';

const DEFINING_STATEMENT = 'The single place where verticals and billing talk to each other';
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

/** What the production entry exports at runtime: the schemas, the class derivation and the gate. */
const ENTRY_RUNTIME_EXPORTS = [
    'AddonIdSchema',
    'AddonPolicyArgsSchema',
    'AddonPolicyResponseSchema',
    'AddonVersionIdSchema',
    'CanChargeArgsSchema',
    'CanChargeResponseSchema',
    'ChangeDirectionArgsSchema',
    'ChangeDirectionResponseSchema',
    'ContractValidationError',
    'CoverageArgsSchema',
    'CoverageChangeSchema',
    'CoverageChangedEventSchema',
    'CoverageReferenceSchema',
    'CoverageResponseSchema',
    'CoverageScopeSchema',
    'CoverageSinceSchema',
    'CoverageSourceSchema',
    'CoverageSourceTypeSchema',
    'CoverageUntilSchema',
    'ExtendTrialArgsSchema',
    'ExtendTrialResponseSchema',
    'InstantSchema',
    'ListingArgsSchema',
    'ListingIdSchema',
    'ListingPurgedEventSchema',
    'ListingPurgedResponseSchema',
    'ListingResponseSchema',
    'PlanPolicyArgsSchema',
    'PlanPolicyResponseSchema',
    'PlanVersionIdSchema',
    'RetentionStoppedArgsSchema',
    'RetentionStoppedResponseSchema',
    'UserIdSchema',
    'UserVerticalArgsSchema',
    'VerticalSchema',
    'coverageSourceClassOf',
    'validateBillingForVerticals',
    'validateVerticalsForBilling'
];

/** What the `./testing` subpath exports at runtime: the simulators and the case sets. */
const TESTING_RUNTIME_EXPORTS = [
    'BillingForVerticalsSimulator',
    'SIMULATED_EXTEND_TRIAL_REJECTIONS',
    'SimulatorNotProgrammedError',
    'VerticalsForBillingSimulator',
    'addonPolicyCaseSet',
    'changeDirectionCaseSet',
    'coverageCaseSet',
    'extendTrialCaseSet',
    'inverseCaseSet',
    'listingCaseSet',
    'planPolicyCaseSet'
];

/** The only external modules the package's source may import. */
const ALLOWED_EXTERNAL_IMPORTS = ['zod', '@repo/schemas'];

/** The only dependencies the package may declare (contract §7.1). */
const ALLOWED_DEPENDENCIES = ['@repo/schemas', 'zod'];

/** Packages of either half, or of the database layer, that no dependency block may name. */
const FORBIDDEN_DEPENDENCY = /^@repo\/(db|payments|billing)(\/|$)/;

const DEPENDENCY_BLOCKS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const;

/** Every TypeScript source file of the package, at any depth. */
function sourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles({ dir: full });
        return name.endsWith('.ts') ? [full] : [];
    });
}

/** Every import statement of a source: its specifier and its full text. */
function importsOf({
    source
}: {
    readonly source: string;
}): readonly { readonly specifier: string; readonly statement: string }[] {
    const pattern =
        /(?:\b(?:import|export)\b[^;]*?\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
    return [...source.matchAll(pattern)].map((match) => ({
        specifier: match[1] ?? '',
        statement: match[0]
    }));
}

const manifest = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
    readonly description: string;
    readonly [block: string]: unknown;
};

describe('@repo/billing-verticals-contract package shape', () => {
    it('exports exactly its allowlisted runtime values from the production entry', async () => {
        // Arrange / Act
        const entry = await import('../src/index');

        // Assert
        expect(Object.keys(entry).sort()).toEqual([...ENTRY_RUNTIME_EXPORTS].sort());
    });

    it('exports exactly its allowlisted runtime values from the ./testing subpath', async () => {
        const testing = await import('../src/testing/index');

        expect(Object.keys(testing).sort()).toEqual([...TESTING_RUNTIME_EXPORTS].sort());
    });

    it('exports the Clock type (AC:B1:17), checked by the package typecheck', () => {
        // Arrange: a conforming clock compiles; a clock without `now` does not.
        const clock: Clock = { now: () => new Date(0) };
        // @ts-expect-error a clock must have `now(): Date`
        const _broken: Clock = { now: () => 0 };

        // Assert
        expectTypeOf<Clock['now']>().toEqualTypeOf<() => Date>();
        expect(clock.now()).toEqual(new Date(0));
        expect(_broken).toBeDefined();
    });

    it('imports only its own files, zod and @repo/schemas: nothing of either half nor of the database layer', () => {
        // Arrange
        const srcDir = join(PACKAGE_ROOT, 'src');
        const files = sourceFiles({ dir: srcDir });
        const imports = files.flatMap((file) =>
            importsOf({ source: readFileSync(file, 'utf8') }).map((found) => ({ file, ...found }))
        );

        // Assert: the scan sees the entry's own re-exports and both externals, so it is not vacuous
        expect(files.length).toBeGreaterThanOrEqual(10);
        expect(imports.map(({ specifier }) => specifier)).toEqual(
            expect.arrayContaining(['./clock', 'zod', '@repo/schemas'])
        );
        for (const { file, specifier } of imports) {
            const isOwnFile =
                specifier.startsWith('.') &&
                !relative(srcDir, resolve(file, '..', specifier)).startsWith('..');
            expect(
                isOwnFile || ALLOWED_EXTERNAL_IMPORTS.includes(specifier),
                `${relative(PACKAGE_ROOT, file)} imports ${specifier}`
            ).toBe(true);
        }
    });

    it('imports only VerticalEnum from @repo/schemas', () => {
        const statements = sourceFiles({ dir: join(PACKAGE_ROOT, 'src') }).flatMap((file) =>
            importsOf({ source: readFileSync(file, 'utf8') })
                .filter(({ specifier }) => specifier === '@repo/schemas')
                .map(({ statement }) => statement.replace(/\s+/g, ' '))
        );

        expect(statements.length).toBeGreaterThan(0);
        for (const statement of statements) {
            expect(statement).toBe("import { VerticalEnum } from '@repo/schemas'");
        }
    });

    it('declares exactly @repo/schemas and zod as dependencies, and no peer dependency', () => {
        expect(Object.keys((manifest.dependencies ?? {}) as object).sort()).toEqual(
            ALLOWED_DEPENDENCIES
        );
        expect(Object.keys((manifest.peerDependencies ?? {}) as object)).toEqual([]);
    });

    it('names neither half nor the database layer in any dependency block', () => {
        const named = DEPENDENCY_BLOCKS.flatMap((block) =>
            Object.keys((manifest[block] ?? {}) as object).map((name) => `${block}: ${name}`)
        );

        expect(named.length).toBeGreaterThan(0);
        expect(
            named.filter((entry) => FORBIDDEN_DEPENDENCY.test(entry.split(': ')[1] ?? ''))
        ).toEqual([]);
    });

    it('states in package.json what the package is', () => {
        expect(manifest.description).toContain(DEFINING_STATEMENT);
    });

    it('states in README.md what the package is', () => {
        // Arrange
        const readme = readFileSync(resolve(PACKAGE_ROOT, 'README.md'), 'utf8');

        // Act / Assert
        expect(readme).toContain(DEFINING_STATEMENT);
    });
});
