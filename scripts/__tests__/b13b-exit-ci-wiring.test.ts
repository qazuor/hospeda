import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** AC:B13b:4 exit evidence for the three B13b E2E cases and the Phase 3 smoke. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
const E2E = [
    {
        id: 'TEST:B13b:1',
        ac: 'AC:B13b:1',
        file: 'apps/e2e/tests/billing/billing-25-moderation-recurring-addon.spec.ts',
        title: 'TEST:B13b:1 AC:B13b:1 AC:B13b:4 moderating a listing with a live recurring feature @p0 @admin @billing @clock'
    },
    {
        id: 'TEST:B13b:2',
        ac: 'AC:B13b:2',
        file: 'apps/e2e/tests/billing/billing-26-unpublish-recurring-addon.spec.ts',
        title: 'TEST:B13b:2 AC:B13b:2 AC:B13b:4 unpublishing a listing with a live recurring feature @p0 @host @billing @clock'
    },
    {
        id: 'TEST:B13b:3',
        ac: 'AC:B13b:3',
        file: 'apps/e2e/tests/admin/adm-22-addon-version-editor.spec.ts',
        title: 'TEST:B13b:3 AC:B13b:3 AC:B13b:4 the action 20 editor @p0 @admin @billing @clock'
    }
] as const;

const EVIDENCE = [
    {
        ac: 'AC:B13b:1',
        files: [
            'packages/service-core/test/integration/services/addon-withdrawal.test.ts',
            'apps/api/test/integration/billing-addon/withdrawal-route.test.ts',
            'apps/api/test/integration/listing-publication/recurring-listing-addons.test.ts',
            'apps/api/test/integration/listing-publication/moderation-recurring-addons.test.ts',
            'apps/admin/src/features/listing/components/__tests__/ListingModerationRecurringAddons.test.tsx'
        ]
    },
    {
        ac: 'AC:B13b:2',
        files: [
            'apps/api/test/integration/listing-publication/recurring-listing-addons.test.ts',
            'apps/web/test/components/host/UnpublishButton.test.tsx'
        ]
    },
    {
        ac: 'AC:B13b:3',
        files: [
            'packages/service-core/test/integration/services/addon-catalog-editor.test.ts',
            'apps/api/test/integration/addon-catalog/addon-catalog-admin-routes.test.ts',
            'apps/admin/src/features/billing-addon-catalog/__tests__/AddonVersionReview.test.tsx',
            'packages/service-core/test/integration/services/addon-product-retirement.test.ts',
            'apps/admin/src/features/billing-addon-catalog/__tests__/AddonProductRetirement.test.tsx'
        ]
    }
] as const;

function describeTitles(source: string): readonly string[] {
    return [
        ...source.matchAll(
            /\b(?:test\.)?describe(?:\.skipIf\([^\n]*\))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
        )
    ].map((match) => match[2] ?? '');
}

describe('AC:B13b:4 B13b exit is wired into CI', () => {
    it('finds at least three mapped E2E files and their literal @p0 TEST:B13b titles', () => {
        expect(E2E.length).toBeGreaterThanOrEqual(3);
        expect(E2E.map(({ id }) => id)).toEqual(['TEST:B13b:1', 'TEST:B13b:2', 'TEST:B13b:3']);
        for (const { id, ac, file, title } of E2E) {
            expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
            expect(title).toContain(id);
            expect(title).toContain(ac);
            expect(title).toContain('AC:B13b:4');
            expect(title).toContain('@p0');
            expect(describeTitles(read(file)), file).toContain(title);
        }
    });

    it('the e2e-p0 CI job runs e2e:test:p0, whose script greps @p0', () => {
        const ci = read('.github/workflows/e2e-pr.yml');
        const job = ci.match(/^ {2}e2e-p0:\n([\s\S]*?)(?=^ {2}[\w-]+:|$(?![\s\S]))/m)?.[1] ?? '';
        expect(job).toContain('run: pnpm --filter hospeda-e2e e2e:test:p0');
        const pkg = JSON.parse(read('apps/e2e/package.json')) as {
            readonly scripts: Readonly<Record<string, string>>;
        };
        expect(pkg.scripts['e2e:test:p0']).toContain('--grep @p0');
    });

    it('AC:B13b:1-3 retain their integration and unit evidence, including Q1 retirement', () => {
        expect(EVIDENCE.map(({ ac }) => ac)).toEqual(['AC:B13b:1', 'AC:B13b:2', 'AC:B13b:3']);
        for (const { ac, files } of EVIDENCE) {
            expect(files.length, ac).toBeGreaterThan(0);
            for (const file of files) {
                expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
                expect(
                    describeTitles(read(file)).some((title) => title.includes(ac)),
                    file
                ).toBe(true);
            }
        }
    });

    it('S22 and P13 carry the B13b smoke and mark total retirement outside HOS-1625', () => {
        const checklist = read('docs/billing/smoke-checklist.md');
        for (const item of ['S22', 'P13']) {
            const body =
                checklist.match(
                    new RegExp(
                        `^### ${item} — [^\\n]+\\n([\\s\\S]*?)(?=^### |^## |$(?![\\s\\S]))`,
                        'm'
                    )
                )?.[1] ?? '';
            for (const field of ['Preconditions', 'Steps', 'Expected', 'Evidence', 'Covers']) {
                expect(body, `${item}: ${field}`).toContain(`**${field}:**`);
            }
            for (const id of [
                ...E2E.map(({ id }) => id),
                ...EVIDENCE.map(({ ac }) => ac),
                'AC:B13b:4'
            ]) {
                expect(body, `${item}: ${id}`).toContain(id);
            }
            expect(body, item).toContain('HOS-2097');
        }
        expect(checklist).toContain('Phase 3 (B13b, HOS-1625): S22 and P13.');
    });
});
