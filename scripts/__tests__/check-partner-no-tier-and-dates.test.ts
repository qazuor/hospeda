import { describe, expect, it, vi } from 'vitest';
import { findPartnerLegacyReferences, main } from '../check-partner-no-tier-and-dates.js';

describe('TEST:V6:31 · static partner field guard', () => {
    it('accepts clean partner code', () => {
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/api/src/routes/partners/mine.ts', content: 'return partners.name;' }
            ])
        ).toEqual([]);
    });

    it('reports a partner table field with its file and line', () => {
        const violations = findPartnerLegacyReferences([
            {
                file: 'apps/web/src/pages/partners/detail.ts',
                content: '\nconst value = partners.tier;'
            }
        ]);

        expect(violations).toContainEqual({
            file: 'apps/web/src/pages/partners/detail.ts',
            line: 2,
            name: 'tier'
        });
    });

    it('reports lifecycle date properties in partner files', () => {
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/admin/src/features/partners/form.tsx', content: 'value.startsAt;' }
            ])
        ).toContainEqual({
            file: 'apps/admin/src/features/partners/form.tsx',
            line: 1,
            name: 'startsAt'
        });
    });

    it('ignores legacy spellings in line and block comments', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/web/src/lib/partner-link.ts',
                    content: '// partners.tier\n/* startsAt */\nconst safe = true;'
                }
            ])
        ).toEqual([]);
    });

    it('allows the same field name in code unrelated to partners', () => {
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/web/src/lib/plan.ts', content: 'const tier = plan.tier;' }
            ])
        ).toEqual([]);
    });

    it('classifies a file by its partners table identifier as well as its path', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/api/src/routes/admin/list.ts',
                    content: "import { partners } from '@repo/db';\npartners.tier;"
                }
            ])
        ).toContainEqual({
            file: 'apps/api/src/routes/admin/list.ts',
            line: 2,
            name: 'tier'
        });
    });

    it('reports global retired schema identifiers in every file', () => {
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/api/src/routes/billing/plan.ts', content: 'PartnerTierEnum;' }
            ])
        ).toContainEqual({
            file: 'apps/api/src/routes/billing/plan.ts',
            line: 1,
            name: 'PartnerTierEnum'
        });
    });

    it('runs the real repository scan and exposes the out-of-scope corrida 1 references', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const exitCode = main();
            expect([0, 1]).toContain(exitCode);
            if (exitCode === 0) {
                expect(log).toHaveBeenCalledWith(expect.stringContaining('OK:'));
                expect(error).not.toHaveBeenCalled();
            } else {
                expect(error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        'packages/db/test/integration/partners-v7-schema-from-empty.test.ts'
                    )
                );
            }
        } finally {
            log.mockRestore();
            error.mockRestore();
        }
    });

    it('catches the specified public detail page mutation', () => {
        const violations = findPartnerLegacyReferences([
            {
                file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
                content: 'const partner = partners.tier;'
            }
        ]);

        expect(violations).toContainEqual({
            file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
            line: 1,
            name: 'tier'
        });
    });
});
