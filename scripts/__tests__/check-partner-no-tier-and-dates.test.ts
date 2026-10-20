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

    it('reports raw.tier on the public partner page', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
                    content: 'tier: raw.tier as string | null'
                }
            ])
        ).toContainEqual({
            file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
            line: 1,
            name: 'tier'
        });
    });

    it('reports destructured tier in a partner file', () => {
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/api/src/routes/partners/mine.ts', content: 'const { tier } = row;' }
            ])
        ).toContainEqual({
            file: 'apps/api/src/routes/partners/mine.ts',
            line: 1,
            name: 'tier'
        });
    });

    it('reports startsAt object keys in a partner file', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'packages/service-core/src/services/partner/partner.service.ts',
                    content: 'const value = { startsAt: date };'
                }
            ])
        ).toContainEqual({
            file: 'packages/service-core/src/services/partner/partner.service.ts',
            line: 1,
            name: 'startsAt'
        });
    });

    it('reports retired names inside string literals in partner files', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'packages/db/src/schemas/partner/partner.dbschema.ts',
                    content: "const retired = 'ends_at';"
                }
            ])
        ).toContainEqual({
            file: 'packages/db/src/schemas/partner/partner.dbschema.ts',
            line: 1,
            name: 'ends_at'
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

    it('checks partner model references outside partner paths contextually', () => {
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

    it('reports a partners field in an unlisted file that names the table', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/api/test/routes/partners/unlisted.test.ts',
                    content: 'partners.tier;'
                }
            ])
        ).toContainEqual({
            file: 'apps/api/test/routes/partners/unlisted.test.ts',
            line: 1,
            name: 'tier'
        });
    });

    it('ignores a tier field belonging to another concept in a partners-aware file', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/api/test/routes/system-actor-migration.test.ts',
                    content: "import { partners } from '@repo/db';\nconfig: { tier: 'admin' }"
                }
            ])
        ).toEqual([]);
    });

    it('accepts the unrelated system actor tier outside partner paths', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/api/test/routes/system-actor-migration.test.ts',
                    content: "config: { tier: 'admin' }"
                }
            ])
        ).toEqual([]);
    });

    it('reports one occurrence per line and name when repeated', () => {
        expect(
            findPartnerLegacyReferences([
                {
                    file: 'apps/web/src/pages/partners/detail.astro',
                    content: 'tier: raw.tier as string | null'
                }
            ])
        ).toEqual([
            {
                file: 'apps/web/src/pages/partners/detail.astro',
                line: 1,
                name: 'tier'
            }
        ]);
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

    it('runs the real repository scan and reports remaining out-of-scope references', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const exitCode = main();
            expect(exitCode).toBe(0);
            expect(log).toHaveBeenCalledWith(expect.stringContaining('OK:'));
            expect(error).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
            error.mockRestore();
        }
    });

    it('catches the specified public detail page mutation', () => {
        const violations = findPartnerLegacyReferences([
            {
                file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
                content: 'tier: raw.tier as string | null'
            }
        ]);

        expect(violations).toContainEqual({
            file: 'apps/web/src/pages/[lang]/partners/[slug].astro',
            line: 1,
            name: 'tier'
        });
    });
});
