import { describe, expect, it } from 'bun:test';
import { ownRepoRoot } from '../src/lib/repo.ts';
import {
    filesFor,
    groupByPackage,
    needsInfra,
    orphanFiles,
    readCategories,
    type TestCategory
} from '../src/lib/test-categories.ts';

const BILLING: TestCategory = {
    name: 'billing',
    description: 'facturación',
    include: ['packages/billing/**', '**/*subscription*', '**/*billing*']
};

const FILES = [
    'packages/billing/test/plans.test.ts',
    'packages/service-core/src/services/billing/subscription.test.ts',
    'apps/api/test/e2e/billing-checkout.e2e.test.ts',
    'apps/api/src/routes/accommodation/list.test.ts',
    'scripts/__tests__/guards.test.ts'
] as const;

describe('filesFor', () => {
    it('should match across packages, not just one', () => {
        // The whole point: "los tests de billing" live in several packages.
        const found = filesFor({ category: BILLING, files: FILES });

        expect(found).toContain('packages/billing/test/plans.test.ts');
        expect(found).toContain('packages/service-core/src/services/billing/subscription.test.ts');
    });

    it('should leave out e2e and integration by default', () => {
        // They need a database and built apps: running them by accident
        // reports a missing environment, not a real failure.
        const found = filesFor({ category: BILLING, files: FILES });

        expect(found).not.toContain('apps/api/test/e2e/billing-checkout.e2e.test.ts');
    });

    it('should include them when asked', () => {
        const found = filesFor({ category: BILLING, files: FILES, includeInfra: true });

        expect(found).toContain('apps/api/test/e2e/billing-checkout.e2e.test.ts');
    });

    it('should not match unrelated files', () => {
        const found = filesFor({ category: BILLING, files: FILES });

        expect(found).not.toContain('apps/api/src/routes/accommodation/list.test.ts');
    });
});

describe('needsInfra', () => {
    it('should flag the kinds that need a database or a browser', () => {
        expect(needsInfra({ file: 'apps/e2e/tests/login.test.ts' })).toBe(true);
        expect(needsInfra({ file: 'apps/api/test/e2e/x.test.ts' })).toBe(true);
        expect(needsInfra({ file: 'packages/db/src/x.integration.test.ts' })).toBe(true);
    });

    it('should leave ordinary unit tests alone', () => {
        expect(needsInfra({ file: 'packages/billing/test/plans.test.ts' })).toBe(false);
    });
});

describe('orphanFiles', () => {
    it('should report tests no category claims', () => {
        // A new test matching no glob is simply never run by any category, and
        // nothing else says so.
        const orphans = orphanFiles({ categories: [BILLING], files: FILES });

        expect(orphans).toContain('apps/api/src/routes/accommodation/list.test.ts');
        expect(orphans).not.toContain('packages/billing/test/plans.test.ts');
    });

    it('should be empty when every file is claimed', () => {
        const catchAll: TestCategory = { name: 'todo', description: '', include: ['**/*'] };

        expect(orphanFiles({ categories: [catchAll], files: FILES })).toEqual([]);
    });
});

describe('groupByPackage', () => {
    const repoRoot = ownRepoRoot();

    it('should split files into one batch per package', () => {
        const batches = groupByPackage({
            files: [
                'packages/billing/test/a.test.ts',
                'packages/billing/test/b.test.ts',
                'apps/api/src/x.test.ts'
            ],
            repoRoot
        });

        expect(batches.map((batch) => batch.dir)).toEqual(['apps/api', 'packages/billing']);
        expect(batches.find((batch) => batch.dir === 'packages/billing')?.files).toEqual([
            'test/a.test.ts',
            'test/b.test.ts'
        ]);
    });

    it('should make paths relative to their package', () => {
        // vitest is invoked from inside the package; a repo-relative path would
        // resolve to nothing there.
        const [batch] = groupByPackage({ files: ['apps/api/src/x.test.ts'], repoRoot });

        expect(batch?.files).toEqual(['src/x.test.ts']);
    });

    it('should resolve the real package name pnpm filters on', () => {
        // `apps/api` is not a package name; `hospeda-api` is.
        const [batch] = groupByPackage({ files: ['apps/api/src/x.test.ts'], repoRoot });

        expect(batch?.packageName).toBe('hospeda-api');
    });

    it('should drop files outside apps/ and packages/', () => {
        // A test under scripts/ has no package to filter on, and passing it
        // through would turn the run into one at the repository root.
        const batches = groupByPackage({ files: ['scripts/__tests__/x.test.ts'], repoRoot });

        expect(batches).toEqual([]);
    });
});

describe('readCategories', () => {
    it('should read the project map and skip its $comment', () => {
        const categories = readCategories({ repoRoot: ownRepoRoot() });
        const names = categories.map((category) => category.name);

        expect(names).toContain('billing');
        expect(names).toContain('gastronomy');
        expect(names).toContain('experiences');
        expect(names.some((name) => name.startsWith('$'))).toBe(false);
    });

    it('should give every category a non-empty pattern list', () => {
        for (const category of readCategories({ repoRoot: ownRepoRoot() })) {
            expect({ name: category.name, patterns: category.include.length > 0 }).toEqual({
                name: category.name,
                patterns: true
            });
        }
    });

    it('should return nothing when the map is absent', () => {
        expect(readCategories({ repoRoot: '/no/existe' })).toEqual([]);
    });
});
