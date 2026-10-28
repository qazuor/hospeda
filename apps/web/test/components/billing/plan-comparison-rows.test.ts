/**
 * @file plan-comparison-rows.test.ts
 * @description Behavioural tests for the plan comparison table's row model
 * (HOS-329). The table used to map each row's per-plan yes/no values by COLUMN
 * POSITION, which silently reassigned every value as soon as the set of
 * rendered plans changed (a deactivated tier, a new tier, a reordering). Cells
 * are now derived from each plan's own `entitlements`, so a column set change
 * can never make a plan inherit another plan's cell — and a tier nobody
 * curated still renders truthfully.
 *
 * This file also carries the per-spec row guards that used to live in
 * `PlanComparisonTable.test.ts` against the component's (now deleted) inline
 * copy of the row model.
 */

import billingEn from '@repo/i18n/locales/en/billing.json';
import billingEs from '@repo/i18n/locales/es/billing.json';
import billingPt from '@repo/i18n/locales/pt/billing.json';
import { EntitlementKeyEnum, isCatalogKey, LimitKeyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { COMPARISON_ROW_ICONS } from '@/components/billing/comparison-row-icons';
import {
    EXPERIENCE_GROUPS,
    EXPERIENCE_LISTING_ROWS,
    EXPERIENCE_SERVICE_ROWS,
    OWNER_AI_ROWS,
    OWNER_AS_TOURIST_ROWS,
    OWNER_GROUPS,
    OWNER_ROWS,
    type PlanCellSource,
    resolveRowCells,
    TOURIST_AI_ROWS,
    TOURIST_EXPERIENCE_ROWS,
    TOURIST_GROUPS,
    VENUE_GROUPS,
    VENUE_LISTING_ROWS,
    VENUE_MENU_ROWS
} from '@/components/billing/plan-comparison-rows';

// ---------------------------------------------------------------------------
// Fixtures — the real entitlement sets, as returned by /api/v1/public/plan-catalog.
// Only the entitlements the assertions below exercise are listed.
// ---------------------------------------------------------------------------

function plan(slug: string, entitlements: readonly EntitlementKeyEnum[]): PlanCellSource {
    return { slug, limits: {}, entitlements };
}

const OWNER_BASICO = plan('owner-basico', [
    EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DIRECT
]);
const OWNER_PRO = plan('owner-pro', [
    EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DIRECT,
    EntitlementKeyEnum.CAN_SYNC_EXTERNAL_CALENDAR,
    EntitlementKeyEnum.FEATURED_LISTING
]);
const OWNER_PREMIUM = plan('owner-premium', [
    EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DIRECT,
    EntitlementKeyEnum.VIEW_ADVANCED_STATS,
    EntitlementKeyEnum.CAN_SYNC_EXTERNAL_CALENDAR,
    EntitlementKeyEnum.FEATURED_LISTING,
    EntitlementKeyEnum.CUSTOM_BRANDING,
    EntitlementKeyEnum.HAS_VERIFICATION_BADGE
]);

// tourist-free deliberately lacks CAN_VIEW_RECOMMENDATIONS: it was moved to
// tourist-plus by HOS-16 and is enforced by the API. Verified against the prod
// payload (api.hospeda.com.ar/api/v1/public/plan-catalog).
const TOURIST_FREE = plan('tourist-free', [EntitlementKeyEnum.READ_REVIEWS]);
const TOURIST_PLUS = plan('tourist-plus', [
    EntitlementKeyEnum.READ_REVIEWS,
    EntitlementKeyEnum.CAN_VIEW_RECOMMENDATIONS,
    EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY
]);
const TOURIST_VIP = plan('tourist-vip', [
    EntitlementKeyEnum.READ_REVIEWS,
    EntitlementKeyEnum.CAN_VIEW_RECOMMENDATIONS,
    EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY,
    EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DIRECT
]);

const ALL_OWNER_PLANS = [OWNER_BASICO, OWNER_PRO, OWNER_PREMIUM];
const ALL_TOURIST_PLANS = [TOURIST_FREE, TOURIST_PLUS, TOURIST_VIP];

// ---------------------------------------------------------------------------
// HOS-1416: the REAL-catalog baseline (fromCatalog over PLANS_BY_CATEGORY)
// was retired with the static plan catalog it was derived from — the plan
// source of truth is now the database. The fixture-backed assertions below
// still cover the row model.
// ---------------------------------------------------------------------------

const ALL_ROWS = [
    ...TOURIST_EXPERIENCE_ROWS,
    ...TOURIST_AI_ROWS,
    ...OWNER_ROWS,
    ...OWNER_AI_ROWS,
    ...OWNER_AS_TOURIST_ROWS,
    ...VENUE_LISTING_ROWS,
    ...VENUE_MENU_ROWS,
    ...EXPERIENCE_LISTING_ROWS,
    ...EXPERIENCE_SERVICE_ROWS,
    ...TOURIST_GROUPS.flatMap((group) => group.rows),
    ...OWNER_GROUPS.flatMap((group) => group.rows),
    ...VENUE_GROUPS.flatMap((group) => group.rows),
    ...EXPERIENCE_GROUPS.flatMap((group) => group.rows)
];

function row(id: string) {
    const found = ALL_ROWS.find((r) => r.id === id);
    if (!found) throw new Error(`Row not found: ${id}`);
    return found;
}

/** Resolve a row against a plan set, returning a slug → value map. */
function cellsBySlug(rowId: string, plans: readonly PlanCellSource[]) {
    const values = resolveRowCells({ cell: row(rowId).cell, plans });
    return Object.fromEntries(plans.map((p, i) => [p.slug, values[i]]));
}

type CatalogCheckRow = {
    readonly id: string;
    readonly cell:
        | { readonly kind: 'entitlement' | 'limit'; readonly key: string }
        | { readonly kind: 'all-no' };
};

describe('resolveRowCells — full catalog baseline', () => {
    it('gives premium-exclusive rows to premium only', () => {
        expect(cellsBySlug('branding', ALL_OWNER_PLANS)).toEqual({
            'owner-basico': 'no',
            'owner-pro': 'no',
            'owner-premium': 'yes'
        });
    });

    it('gives advanced stats to premium only', () => {
        expect(cellsBySlug('advancedStats', ALL_OWNER_PLANS)).toEqual({
            'owner-basico': 'no',
            'owner-pro': 'no',
            'owner-premium': 'yes'
        });
    });

    it('resolves tourist rows per tourist tier', () => {
        expect(cellsBySlug('whatsappDirect', ALL_TOURIST_PLANS)).toEqual({
            'tourist-free': 'no',
            'tourist-plus': 'no',
            'tourist-vip': 'yes'
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-329 — the regression itself.
// ---------------------------------------------------------------------------

describe('resolveRowCells — column set changes (HOS-329 regression)', () => {
    it('keeps premium exclusives when the básico tier is not rendered', () => {
        // With positional mapping, dropping básico shifted every plan one slot
        // to the left: pro inherited básico's 'no' and premium inherited pro's
        // 'no', so premium LOST all of its exclusive features.
        const withoutBasico = [OWNER_PRO, OWNER_PREMIUM];

        for (const rowId of ['branding', 'verificationBadge']) {
            expect(cellsBySlug(rowId, withoutBasico)).toEqual({
                'owner-pro': 'no',
                'owner-premium': 'yes'
            });
        }
    });

    it('keeps premium-only rows correct when the básico tier is not rendered', () => {
        expect(cellsBySlug('advancedStats', [OWNER_PRO, OWNER_PREMIUM])).toEqual({
            'owner-pro': 'no',
            'owner-premium': 'yes'
        });
    });

    it('keeps values attached to their plan when only one tier is rendered', () => {
        expect(cellsBySlug('branding', [OWNER_PREMIUM])).toEqual({ 'owner-premium': 'yes' });
        expect(cellsBySlug('branding', [OWNER_BASICO])).toEqual({ 'owner-basico': 'no' });
    });

    it('keeps values attached to their plan when the column order changes', () => {
        expect(cellsBySlug('branding', [OWNER_PREMIUM, OWNER_PRO, OWNER_BASICO])).toEqual({
            'owner-basico': 'no',
            'owner-pro': 'no',
            'owner-premium': 'yes'
        });
    });

    it('keeps the tourist whatsappDirect row attached to VIP without the free tier', () => {
        expect(cellsBySlug('whatsappDirect', [TOURIST_PLUS, TOURIST_VIP])).toEqual({
            'tourist-plus': 'no',
            'tourist-vip': 'yes'
        });
    });

    it('renders a tier nobody curated from its own entitlements, not as a blank column', () => {
        // A plan created later (admin panel, new catalog entry) must render its
        // real capabilities. A hand-maintained per-slug table would show this
        // tier a wall of "not included" for every yes/no row.
        const future = plan('owner-enterprise', [
            EntitlementKeyEnum.VIEW_ADVANCED_STATS,
            EntitlementKeyEnum.CUSTOM_BRANDING,
            EntitlementKeyEnum.HAS_VERIFICATION_BADGE,
            EntitlementKeyEnum.FEATURED_LISTING
        ]);
        expect(cellsBySlug('advancedStats', [future])).toEqual({ 'owner-enterprise': 'yes' });
        expect(cellsBySlug('branding', [future])).toEqual({ 'owner-enterprise': 'yes' });
        expect(cellsBySlug('verificationBadge', [future])).toEqual({ 'owner-enterprise': 'yes' });
        // ...and still says no to what it genuinely lacks.
        expect(cellsBySlug('calendarSync', [future])).toEqual({ 'owner-enterprise': 'no' });
    });

    it('renders a plan with no entitlements as not-included, never as a borrowed yes', () => {
        const empty = plan('venue-listing', []);
        expect(cellsBySlug('branding', [empty])).toEqual({ 'venue-listing': 'no' });
        expect(cellsBySlug('advancedStats', [empty])).toEqual({ 'venue-listing': 'no' });
    });
});

// ---------------------------------------------------------------------------
// The owner "as tourist" group.
// ---------------------------------------------------------------------------

describe('OWNER_AS_TOURIST_ROWS', () => {
    it('reuses the tourist rows verbatim', () => {
        expect(OWNER_AS_TOURIST_ROWS).toEqual([...TOURIST_EXPERIENCE_ROWS, ...TOURIST_AI_ROWS]);
    });

    it('resolves tourist features for owner plans from their own entitlements', () => {
        // Every owner tier carries the full tourist-vip entitlement set, so the
        // tourist rows are all-yes for owners — the same output the removed
        // `asVipForAll` transform produced.
        for (const rowId of ['compare', 'whatsappDisplay', 'whatsappDirect']) {
            expect(cellsBySlug(rowId, ALL_OWNER_PLANS)).toEqual({
                'owner-basico': 'yes',
                'owner-pro': 'yes',
                'owner-premium': 'yes'
            });
        }
    });
});

// ---------------------------------------------------------------------------
// Per-spec row guards, migrated from the old PlanComparisonTable.test.ts.
// ---------------------------------------------------------------------------

describe('catalog row guards', () => {
    it('keeps graduated consumer AI quotas (SPEC-283)', () => {
        // aiSearch/aiChat must read per-plan quotas, never a binary all-yes.
        expect(row('aiSearch').cell).toEqual({
            kind: 'limit',
            key: LimitKeyEnum.MAX_AI_SEARCH_PER_MONTH
        });
        expect(row('aiChat').cell).toEqual({
            kind: 'limit',
            key: LimitKeyEnum.MAX_AI_CHAT_CONSUMER_PER_MONTH
        });
    });

    it('keeps the compare row available and gated on the real entitlement (SPEC-288 T-013)', () => {
        expect(row('compare').status).toBe('available');
        expect(row('compare').cell).toEqual({
            kind: 'entitlement',
            key: EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS
        });
    });

    it('keeps the collections row available with its limit key (SPEC-287 T-011)', () => {
        expect(row('collections').status).toBe('available');
        expect(row('collections').cell).toEqual({
            kind: 'limit',
            key: LimitKeyEnum.MAX_COLLECTIONS
        });
    });

    it('keeps the promotions row available with its limit key (HOS-16 T-012)', () => {
        expect(row('promotions').status).toBe('available');
        expect(row('promotions').cell).toEqual({
            kind: 'limit',
            key: LimitKeyEnum.MAX_ACTIVE_PROMOTIONS
        });
    });

    it('marks phantom entitlements as upcoming, never as shipped', () => {
        // No gate exists for either of these anywhere in the codebase.
        expect(row('prioritySupport').status).toBe('upcoming');
        expect(row('branding').status).toBe('upcoming');
    });

    // HOS-1416: the two REAL-catalog baseline tests ("shows every entitlement
    // row as included for at least one plan of its own audience" and "matches
    // the real catalog for every row that used to be hardcoded all-yes") were
    // retired with the static plan catalog they were derived from — the plan
    // source of truth is now the database.

    it('resolves the compare row per tourist tier (SPEC-288 T-013)', () => {
        // The old source-grep guard pinned the per-tier VALUES, not just the
        // key. Keep that: free cannot compare, plus and VIP can.
        expect(cellsBySlug('compare', ALL_TOURIST_PLANS)).toEqual({
            'tourist-free': 'no',
            'tourist-plus': 'yes',
            'tourist-vip': 'yes'
        });
    });

    it('does not promise tourist-free a feature the API gates (HOS-329 round 2)', () => {
        // CAN_VIEW_RECOMMENDATIONS moved off tourist-free (HOS-16) and is
        // enforced by gateRecommendations in the API, but the table rendered a
        // plain check for Gratis until this row became entitlement-driven.
        expect(cellsBySlug('recommendations', ALL_TOURIST_PLANS)).toEqual({
            'tourist-free': 'no',
            'tourist-plus': 'yes',
            'tourist-vip': 'yes'
        });
    });

    it('never renders a yes/no row as included for a plan with no entitlements', () => {
        // Widened deliberately: the previously-hardcoded all-yes rows are the
        // ones that would over-promise, which is the worse half of the
        // veracity contract.
        const empty = plan('owner-nothing', []);
        for (const rowId of [
            'reviews',
            'recommendations',
            'editInfo',
            'respondReviews',
            'basicStats',
            'calendar',
            'branding',
            'advancedStats'
        ]) {
            expect(cellsBySlug(rowId, [empty])).toEqual({ 'owner-nothing': 'no' });
        }
    });
});

// ---------------------------------------------------------------------------
// Every rendered row must be renderable: label + description in all locales.
//
// `calendarSync` lived in this module for a whole release with no i18n key in
// any locale, because the component rendered its own inline copy of the rows
// and never asked for that label. Once the component started rendering THIS
// module, a missing key would have printed the raw key in production.
// ---------------------------------------------------------------------------

const ALL_RENDERED_ROWS = [
    ...OWNER_GROUPS,
    ...TOURIST_GROUPS,
    ...VENUE_GROUPS,
    ...EXPERIENCE_GROUPS
].flatMap((group) => group.rows);

const LOCALES = {
    es: billingEs,
    en: billingEn,
    pt: billingPt
} as const;

describe('TEST:1626:5 — catalog-backed comparison rows', () => {
    it('has no row cells outside the key catalog, and detects an invalid synthetic key', () => {
        const outsideCatalogIds = (rows: readonly CatalogCheckRow[]) =>
            rows
                .filter((candidate) => {
                    const cell = candidate.cell;
                    return (
                        (cell.kind === 'entitlement' || cell.kind === 'limit') &&
                        !isCatalogKey({ key: cell.key })
                    );
                })
                .map((candidate) => candidate.id);
        const invalidRow = {
            id: 'synthetic-outside-catalog',
            labelKey: 'billing.comparison.row.synthetic',
            cell: { kind: 'entitlement' as const, key: 'not_in_catalog' },
            status: 'available' as const
        };

        expect(outsideCatalogIds(ALL_ROWS)).toEqual([]);
        expect(outsideCatalogIds([invalidRow])).toEqual(['synthetic-outside-catalog']);
    });

    it('keeps Reviews keyed to read_reviews and documents owner decision D-1 (2026-10-19)', () => {
        // D-1 (owner, 2026-10-19): the row stays and READ_REVIEWS is in the catalog.
        expect(cellsBySlug('reviews', ALL_TOURIST_PLANS)).toEqual({
            'tourist-free': 'yes',
            'tourist-plus': 'yes',
            'tourist-vip': 'yes'
        });
        const writeOnlyPlan = plan('write-only-reviews', [EntitlementKeyEnum.WRITE_REVIEWS]);
        expect(cellsBySlug('reviews', [writeOnlyPlan])).toEqual({ 'write-only-reviews': 'no' });
    });
});

describe('row i18n coverage', () => {
    it('actually collects the rendered rows (guards against a vacuous sweep)', () => {
        expect(ALL_RENDERED_ROWS.length).toBeGreaterThan(30);
        expect(ALL_RENDERED_ROWS.map((r) => r.id)).toContain('calendarSync');
        expect(ALL_RENDERED_ROWS.map((r) => r.id)).toContain('publishVenue');
        expect(ALL_RENDERED_ROWS.map((r) => r.id)).toContain('experienceCertificate');
    });

    for (const [locale, bundle] of Object.entries(LOCALES)) {
        it(`has a label and a description for every rendered row in ${locale}`, () => {
            const rows = bundle.comparison.row as Record<string, string | undefined>;
            const descs = bundle.comparison.rowDesc as Record<string, string | undefined>;

            // Assert on the key the component actually renders (`labelKey`),
            // not on the row id — they coincide today but need not.
            const keyOf = (labelKey: string) => labelKey.replace(/^billing\.comparison\.row\./, '');

            const missingLabels = ALL_RENDERED_ROWS.filter((r) => !rows[keyOf(r.labelKey)]).map(
                (r) => r.id
            );
            const missingDescs = ALL_RENDERED_ROWS.filter((r) => !descs[r.id]).map((r) => r.id);

            expect(missingLabels).toEqual([]);
            expect(missingDescs).toEqual([]);
        });
    }

    it('has an icon for every rendered row', () => {
        const missing = ALL_RENDERED_ROWS.filter((r) => !COMPARISON_ROW_ICONS[r.id]).map(
            (r) => r.id
        );
        expect(missing).toEqual([]);
    });

    it('references only note keys that exist in every locale', () => {
        const noteKeys = ALL_RENDERED_ROWS.map((r) => r.noteKey).filter((key): key is string =>
            Boolean(key)
        );
        expect(noteKeys.length).toBeGreaterThan(0);

        for (const [locale, bundle] of Object.entries(LOCALES)) {
            for (const key of noteKeys) {
                // Keys are stored dot-notated under the `billing.` namespace,
                // which the bundle itself does not repeat.
                const path = key.replace(/^billing\./, '').split('.');
                const value = path.reduce<unknown>(
                    (acc, segment) =>
                        typeof acc === 'object' && acc !== null
                            ? (acc as Record<string, unknown>)[segment]
                            : undefined,
                    bundle
                );
                expect(value, `${key} missing in ${locale}`).toBeTypeOf('string');
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Limit cells are plan-driven and therefore already position-independent.
// ---------------------------------------------------------------------------

describe('resolveRowCells — limit cells', () => {
    it('reads the real per-plan limit value regardless of column position', () => {
        const plans: readonly PlanCellSource[] = [
            { slug: 'owner-pro', limits: { max_accommodations: 5 }, entitlements: [] },
            { slug: 'owner-basico', limits: { max_accommodations: 1 }, entitlements: [] }
        ];
        expect(resolveRowCells({ cell: row('publish').cell, plans })).toEqual([5, 1]);
    });

    it('renders the catalog sentinel as unlimited', () => {
        // AC:1719:2/:3: the catalog sentinel is displayed as unlimited in the comparison table.
        const plans: readonly PlanCellSource[] = [
            { slug: 'owner-premium', limits: { max_favorites: 2147483647 }, entitlements: [] }
        ];
        expect(resolveRowCells({ cell: row('favorites').cell, plans })).toEqual(['unlimited']);
    });

    it('falls back to not-included when the plan does not carry the limit key', () => {
        const plans: readonly PlanCellSource[] = [
            { slug: 'owner-basico', limits: {}, entitlements: [] }
        ];
        expect(resolveRowCells({ cell: row('publish').cell, plans })).toEqual(['no']);
    });
});
