/**
 * @file plan-comparison-catalog-rows.test.ts
 * @description HOS-1865 (6.5, AC:6:9). The venue/experience plan comparison
 * rows are generated from the section catalog (`LISTING_SECTIONS`) and marked
 * with the business line that owns each section. These tests pin the catalog as
 * the source of truth, the `menuUrl` link promise (DEC-FAC-062) and the
 * business-line mark.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import billingEn from '@repo/i18n/locales/en/billing.json';
import venueEn from '@repo/i18n/locales/en/venue.json';
import billingEs from '@repo/i18n/locales/es/billing.json';
import venueEs from '@repo/i18n/locales/es/venue.json';
import billingPt from '@repo/i18n/locales/pt/billing.json';
import venuePt from '@repo/i18n/locales/pt/venue.json';
import { EntitlementKeyEnum, LISTING_SECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { COMPARISON_ROW_ICONS } from '@/components/billing/comparison-row-icons';
import {
    buildCatalogComparisonGroup,
    getLineMarkText
} from '@/components/billing/plan-comparison-catalog-rows';
import { resolveCell } from '@/components/billing/plan-comparison-rows';
import { getComparisonGroups } from '@/components/billing/plan-comparison-table.helpers';

const venueGroup = buildCatalogComparisonGroup({ vertical: 'venue' });
const experienceGroup = buildCatalogComparisonGroup({ vertical: 'experience' });
const generatedRows = [...venueGroup.rows, ...experienceGroup.rows];

const LOCALES = {
    es: { billing: billingEs, venue: venueEs },
    en: { billing: billingEn, venue: venueEn },
    pt: { billing: billingPt, venue: venuePt }
} as const;
type Locale = keyof typeof LOCALES;

function entitlementKeys(
    rows: readonly { readonly cell: { readonly kind: string; readonly key?: string } }[]
) {
    return rows.filter((row) => row.cell.kind === 'entitlement').map((row) => row.cell.key);
}

function findRow<T extends { readonly id: string }>(rows: readonly T[], id: string): T {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Row not found: ${id}`);
    return row;
}

describe('TEST:6.5:1 — the catalog is the source of truth', () => {
    it('generates the venue rows from the catalog entitlement keys in catalog order', () => {
        expect(entitlementKeys(venueGroup.rows)).toEqual([
            EntitlementKeyEnum.MANAGE_VENUE_MENU,
            EntitlementKeyEnum.MENU_ITEM_PHOTOS,
            EntitlementKeyEnum.MULTILINGUAL_VENUE_MENU,
            EntitlementKeyEnum.MENU_QR_SCAN_METRICS,
            EntitlementKeyEnum.MANAGE_VENUE_DAILY_SPECIAL,
            EntitlementKeyEnum.MANAGE_VENUE_EVENTS
        ]);
        // `qr` and `qrMetrics` share one entitlement: it must appear once.
        expect(
            entitlementKeys(venueGroup.rows).filter(
                (key) => key === EntitlementKeyEnum.MENU_QR_SCAN_METRICS
            )
        ).toHaveLength(1);
    });

    it('generates the experience rows from the catalog entitlement keys', () => {
        expect(entitlementKeys(experienceGroup.rows)).toEqual([
            EntitlementKeyEnum.MANAGE_EXPERIENCE_DIRECTIONS
        ]);
    });

    it('honours an injected catalog and produces no other rows', () => {
        const injected = [
            {
                id: 'fakeSection',
                entitlementKey: EntitlementKeyEnum.VIEW_ADVANCED_STATS,
                traits: [{ id: 'fakeTrait', entitlementKey: EntitlementKeyEnum.FEATURED_LISTING }]
            }
        ];

        const group = buildCatalogComparisonGroup({ vertical: 'venue', sections: injected });

        expect(entitlementKeys(group.rows)).toEqual([
            EntitlementKeyEnum.VIEW_ADVANCED_STATS,
            EntitlementKeyEnum.FEATURED_LISTING
        ]);
        expect(group.rows).toHaveLength(2);
    });
});

describe('TEST:6.5:2 — the menu row promises the external link (DEC-FAC-062)', () => {
    const menuRow = findRow(venueGroup.rows, 'venueMenu');

    it('uses MANAGE_VENUE_MENU and resolves from the plan entitlements', () => {
        expect(menuRow.cell).toEqual({
            kind: 'entitlement',
            key: EntitlementKeyEnum.MANAGE_VENUE_MENU
        });

        const without = { slug: 'venue-basic', limits: {}, entitlements: [] };
        const withKey = {
            slug: 'venue-pro',
            limits: {},
            entitlements: [EntitlementKeyEnum.MANAGE_VENUE_MENU]
        };
        expect(resolveCell({ cell: menuRow.cell, plan: without })).toBe('no');
        expect(resolveCell({ cell: menuRow.cell, plan: withKey })).toBe('yes');
    });

    it('keeps menuUrl declared by the catalog menu section', () => {
        const menu = LISTING_SECTIONS.venue.find((section) => section.id === 'menu');
        expect(menu?.fields).toContain('menuUrl');
    });

    it('mentions the link in the row label, description and entitlement copy in every locale', () => {
        const linkWord: Record<Locale, RegExp> = {
            es: /enlace/i,
            en: /link/i,
            pt: /link/i
        };

        for (const locale of ['es', 'en', 'pt'] as const) {
            const billing = LOCALES[locale].billing as unknown as {
                comparison: {
                    row: Record<string, string>;
                    rowDesc: Record<string, string>;
                };
                entitlement: Record<string, string>;
            };

            expect(billing.comparison.row.venueMenu, locale).toMatch(linkWord[locale]);
            expect(billing.comparison.rowDesc.venueMenu, locale).toMatch(linkWord[locale]);
            expect(billing.entitlement.manage_venue_menu, locale).toMatch(linkWord[locale]);
        }
    });
});

describe('TEST:6.5:3 — the business-line mark', () => {
    it('marks the menu and its traits with the owning line', () => {
        expect(findRow(venueGroup.rows, 'venueMenu').lineMarks?.map((mark) => mark.value)).toEqual([
            'food'
        ]);
        expect(
            findRow(venueGroup.rows, 'menuItemPhotos').lineMarks?.map((mark) => mark.value)
        ).toEqual(['food']);
    });

    it('leaves a row with no owning line unmarked', () => {
        expect(findRow(venueGroup.rows, 'venueEvents').lineMarks).toBeUndefined();
        expect(findRow(experienceGroup.rows, 'experienceDirections').lineMarks).toBeUndefined();
    });

    it('renders the mark through the single lineMark phrase key', () => {
        const called: string[] = [];
        const t = (key: string, fallback?: string, params?: Record<string, unknown>) => {
            called.push(key);
            if (key === 'billing.comparison.lineMark') return `mark:${params?.rubro}`;
            if (key.startsWith('venue.owner.businessLines.')) return 'rubro-label';
            return fallback ?? key;
        };

        const text = getLineMarkText({
            lineMarks: findRow(venueGroup.rows, 'venueMenu').lineMarks ?? [],
            t
        });

        expect(text).toBe('mark:rubro-label');
        expect(called).toContain('billing.comparison.lineMark');
    });
});

describe('TEST:6.5:4 — every generated row is renderable', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`has label, description, icon, entitlement copy and business-line name in ${locale}`, () => {
            const { billing, venue } = LOCALES[locale] as unknown as {
                billing: {
                    comparison: {
                        row: Record<string, string>;
                        rowDesc: Record<string, string>;
                        lineMark: string;
                    };
                    entitlement: Record<string, string>;
                };
                venue: {
                    owner: { businessLines: Record<string, { label: string }> };
                };
            };

            for (const row of generatedRows) {
                const labelId = row.labelKey.replace('billing.comparison.row.', '');
                expect(billing.comparison.row[labelId], `${locale}:${row.id}`).toBeTypeOf('string');
                expect(billing.comparison.rowDesc[row.id], `${locale}:${row.id}`).toBeTypeOf(
                    'string'
                );
                expect(
                    row.icon ?? COMPARISON_ROW_ICONS[row.id],
                    `${locale}:${row.id} icon`
                ).toBeTruthy();
                if (row.cell.kind === 'entitlement') {
                    expect(
                        billing.entitlement[row.cell.key],
                        `${locale}:${row.cell.key}`
                    ).toBeTypeOf('string');
                }
                for (const mark of row.lineMarks ?? []) {
                    expect(
                        venue.owner.businessLines[mark.value]?.label,
                        `${locale}:${mark.value}`
                    ).toBeTypeOf('string');
                }
            }

            expect(billing.comparison.lineMark).toBeTypeOf('string');
        });
    }
});

describe('TEST:6.5:5 — nothing generated stays hand-written', () => {
    const read = (relativePath: string) => readFileSync(resolve(__dirname, relativePath), 'utf8');
    const rowsSource = read('../../../src/components/billing/plan-comparison-rows.ts');
    const generatedSource = read('../../../src/components/billing/plan-comparison-catalog-rows.ts');
    const tableSource = read('../../../src/components/billing/PlanComparisonTable.astro');

    it('removed the catalog-owned entitlement keys from the curated rows', () => {
        for (const key of [
            'MANAGE_VENUE_MENU',
            'MANAGE_VENUE_DAILY_SPECIAL',
            'MANAGE_VENUE_EVENTS',
            'MENU_ITEM_PHOTOS',
            'MULTILINGUAL_VENUE_MENU',
            'MENU_QR_SCAN_METRICS',
            'MANAGE_EXPERIENCE_DIRECTIONS'
        ]) {
            expect(rowsSource, key).not.toContain(key);
        }
    });

    it('never imports the business-line catalog or hardcodes a catalog value in the web generator', () => {
        for (const source of [generatedSource, tableSource]) {
            expect(source).not.toMatch(/import\s*\{[^}]*\bBUSINESS_LINES\b/);
            expect(source).not.toMatch(/import\s*\{[^}]*\bBUSINESS_LINE_RULES\b/);
            expect(source).not.toMatch(/\b(food|nightlife)\b/);
        }
    });
});

describe('TEST:6.5:6 — the venue table still renders', () => {
    it('includes the generated group in the venue comparison', () => {
        const groups = getComparisonGroups('venue');
        const ids = groups.map((group) => group.id);
        expect(ids).toContain('catalogSections');
        expect(groups.flatMap((group) => group.rows).map((row) => row.id)).toContain('venueMenu');
    });
});
