/**
 * @file plan-comparison-rows.test.ts
 * @description Behavioural tests for the plan comparison table's row model
 * (HOS-329). The table used to map each row's per-plan literal values by
 * COLUMN POSITION, which silently reassigned every value as soon as the set of
 * rendered plans changed (a deactivated tier, a new tier, a reordering). These
 * tests pin the mapping to the plan SLUG so a column set change can never make
 * a plan inherit another plan's cell.
 */

import billingEn from '@repo/i18n/locales/en/billing.json';
import billingEs from '@repo/i18n/locales/es/billing.json';
import billingPt from '@repo/i18n/locales/pt/billing.json';
import { describe, expect, it } from 'vitest';
import { COMPARISON_ROW_ICONS } from '@/components/billing/comparison-row-icons';
import {
    OWNER_AI_ROWS,
    OWNER_AS_TOURIST_ROWS,
    OWNER_GROUPS,
    OWNER_ROWS,
    type PlanCellSource,
    resolveRowCells,
    TOURIST_EXPERIENCE_ROWS,
    TOURIST_GROUPS
} from '@/components/billing/plan-comparison-rows';

// ---------------------------------------------------------------------------
// Fixtures — minimal plan shapes, one per real catalog slug.
// ---------------------------------------------------------------------------

const OWNER_BASICO: PlanCellSource = { slug: 'owner-basico', limits: {} };
const OWNER_PRO: PlanCellSource = { slug: 'owner-pro', limits: {} };
const OWNER_PREMIUM: PlanCellSource = { slug: 'owner-premium', limits: {} };

const TOURIST_FREE: PlanCellSource = { slug: 'tourist-free', limits: {} };
const TOURIST_PLUS: PlanCellSource = { slug: 'tourist-plus', limits: {} };
const TOURIST_VIP: PlanCellSource = { slug: 'tourist-vip', limits: {} };

const ALL_OWNER_PLANS = [OWNER_BASICO, OWNER_PRO, OWNER_PREMIUM] as const;
const ALL_TOURIST_PLANS = [TOURIST_FREE, TOURIST_PLUS, TOURIST_VIP] as const;

function ownerRow(id: string) {
    const row = [...OWNER_ROWS, ...OWNER_AI_ROWS, ...OWNER_AS_TOURIST_ROWS].find(
        (r) => r.id === id
    );
    if (!row) throw new Error(`OWNER row not found: ${id}`);
    return row;
}

function touristRow(id: string) {
    const row = TOURIST_EXPERIENCE_ROWS.find((r) => r.id === id);
    if (!row) throw new Error(`TOURIST row not found: ${id}`);
    return row;
}

/** Resolve a row against a plan set, returning a slug → value map. */
function cellsBySlug(rowId: string, plans: readonly PlanCellSource[]) {
    const values = resolveRowCells({ cell: ownerRow(rowId).cell, plans });
    return Object.fromEntries(plans.map((plan, i) => [plan.slug, values[i]]));
}

describe('resolveRowCells — full catalog baseline', () => {
    it('gives premium-exclusive rows to premium only', () => {
        expect(cellsBySlug('branding', ALL_OWNER_PLANS)).toEqual({
            'owner-basico': 'no',
            'owner-pro': 'no',
            'owner-premium': 'yes'
        });
    });

    it('gives pro-and-up rows to pro and premium', () => {
        expect(cellsBySlug('advancedStats', ALL_OWNER_PLANS)).toEqual({
            'owner-basico': 'no',
            'owner-pro': 'yes',
            'owner-premium': 'yes'
        });
    });

    it('resolves tourist rows per tourist tier', () => {
        const values = resolveRowCells({
            cell: touristRow('whatsappDirect').cell,
            plans: ALL_TOURIST_PLANS
        });
        expect(values).toEqual(['no', 'no', 'yes']);
    });
});

// ---------------------------------------------------------------------------
// HOS-329 — the regression itself.
// ---------------------------------------------------------------------------

describe('resolveRowCells — column set changes (HOS-329 regression)', () => {
    it('keeps premium exclusives when the básico tier is not rendered', () => {
        // With positional mapping, dropping básico shifted every plan one slot
        // to the left: pro inherited básico's 'no' and premium inherited pro's
        // 'no', so premium LOST all three of its exclusive features.
        const withoutBasico = [OWNER_PRO, OWNER_PREMIUM];

        for (const rowId of ['branding', 'verificationBadge']) {
            expect(cellsBySlug(rowId, withoutBasico)).toEqual({
                'owner-pro': 'no',
                'owner-premium': 'yes'
            });
        }
    });

    it('keeps pro-and-up rows correct when the básico tier is not rendered', () => {
        expect(cellsBySlug('advancedStats', [OWNER_PRO, OWNER_PREMIUM])).toEqual({
            'owner-pro': 'yes',
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
        const values = resolveRowCells({
            cell: touristRow('whatsappDirect').cell,
            plans: [TOURIST_PLUS, TOURIST_VIP]
        });
        expect(values).toEqual(['no', 'yes']);
    });

    it('renders an unknown plan slug as not-included instead of borrowing a value', () => {
        // commerce-listing / partner-listing also carry category 'owner'. They
        // are excluded from ALL_PLANS today, but if one ever reaches the public
        // endpoint it must render as "no", never inherit a curated tier's value.
        const commerce: PlanCellSource = { slug: 'commerce-listing', limits: {} };
        expect(cellsBySlug('branding', [commerce])).toEqual({ 'commerce-listing': 'no' });
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

const ALL_RENDERED_ROWS = [...OWNER_GROUPS, ...TOURIST_GROUPS].flatMap((group) => group.rows);

const LOCALES = {
    es: billingEs,
    en: billingEn,
    pt: billingPt
} as const;

describe('row i18n coverage', () => {
    it('actually collects the rendered rows (guards against a vacuous sweep)', () => {
        expect(ALL_RENDERED_ROWS.length).toBeGreaterThan(20);
        expect(ALL_RENDERED_ROWS.map((r) => r.id)).toContain('calendarSync');
    });

    for (const [locale, bundle] of Object.entries(LOCALES)) {
        it(`has a label and a description for every rendered row in ${locale}`, () => {
            const rows = bundle.comparison.row as Record<string, string | undefined>;
            const descs = bundle.comparison.rowDesc as Record<string, string | undefined>;

            const missingLabels = ALL_RENDERED_ROWS.filter((row) => !rows[row.id]).map((r) => r.id);
            const missingDescs = ALL_RENDERED_ROWS.filter((row) => !descs[row.id]).map((r) => r.id);

            expect(missingLabels).toEqual([]);
            expect(missingDescs).toEqual([]);
        });
    }

    it('has an icon for every rendered row', () => {
        const missing = ALL_RENDERED_ROWS.filter((row) => !COMPARISON_ROW_ICONS[row.id]).map(
            (r) => r.id
        );
        expect(missing).toEqual([]);
    });

    it('references only note keys that exist in every locale', () => {
        const noteKeys = ALL_RENDERED_ROWS.map((row) => row.noteKey).filter((key): key is string =>
            Boolean(key)
        );
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
            { slug: 'owner-pro', limits: { max_accommodations: 5 } },
            { slug: 'owner-basico', limits: { max_accommodations: 1 } }
        ];
        expect(resolveRowCells({ cell: ownerRow('publish').cell, plans })).toEqual([5, 1]);
    });

    it('renders -1 as unlimited', () => {
        const plans: readonly PlanCellSource[] = [
            { slug: 'owner-premium', limits: { max_accommodations: -1 } }
        ];
        expect(resolveRowCells({ cell: ownerRow('publish').cell, plans })).toEqual(['unlimited']);
    });

    it('falls back to not-included when the plan does not carry the limit key', () => {
        const plans: readonly PlanCellSource[] = [{ slug: 'owner-basico', limits: {} }];
        expect(resolveRowCells({ cell: ownerRow('publish').cell, plans })).toEqual(['no']);
    });
});
