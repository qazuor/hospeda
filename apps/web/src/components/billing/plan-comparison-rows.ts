/**
 * @file plan-comparison-rows.ts
 * @description Row-model types and curated row/group configs for the plan
 * comparison table (`PlanComparisonTable.astro`). Extracted from the component
 * so the catalog-veracity data (each row's status + per-plan values) has a
 * direct unit-test surface (HOS-213) and to keep the `.astro` file within the
 * project's file-size budget.
 *
 * Every row references an i18n `labelKey` and carries a typed cell definition,
 * a `status` (`available` | `upcoming`), and an optional `noteKey`.
 *
 * Literal cells are keyed by PLAN SLUG, never by column position (HOS-329).
 * Positional values silently reassigned themselves whenever the rendered
 * column set changed — deactivating `owner-basico` shifted every plan one slot
 * left, so `owner-premium` inherited `owner-pro`'s values and lost all of its
 * exclusive features. Slug keys make the value follow the plan.
 */

import { LimitKey } from '@repo/billing';

export type YesNo = 'yes' | 'no';

/** Curated owner tiers rendered as columns of the owner comparison table. */
export type OwnerPlanSlug = 'owner-basico' | 'owner-pro' | 'owner-premium';

/** Curated tourist tiers rendered as columns of the tourist comparison table. */
export type TouristPlanSlug = 'tourist-free' | 'tourist-plus' | 'tourist-vip';

/** Any plan slug this table has curated literal values for. */
export type ComparablePlanSlug = OwnerPlanSlug | TouristPlanSlug;

export interface LimitCell {
    readonly kind: 'limit';
    /** Strongly-typed limit key — reads the real value from plan.limits. */
    readonly key: LimitKey;
}
export interface LiteralsCell {
    readonly kind: 'literals';
    /**
     * Explicit value per plan slug. A plan whose slug is absent renders as
     * `'no'` — it never borrows another column's value.
     */
    readonly bySlug: Readonly<Partial<Record<ComparablePlanSlug, YesNo>>>;
}
export interface AllYesCell {
    readonly kind: 'all-yes';
}
export interface AllNoCell {
    readonly kind: 'all-no';
}
export interface AllUnlimitedCell {
    readonly kind: 'all-unlimited';
}

export type RowCellDef = LimitCell | LiteralsCell | AllYesCell | AllNoCell | AllUnlimitedCell;
export type CellRendered = YesNo | 'unlimited' | number;

export interface RowConfig {
    readonly id: string;
    readonly labelKey: string;
    readonly cell: RowCellDef;
    readonly status: 'available' | 'upcoming';
    readonly noteKey?: string | undefined;
}

export interface GroupConfig {
    readonly id: string;
    readonly rows: readonly RowConfig[];
}

// ---------------------------------------------------------------------------
// Literal-cell constructors
//
// Both require EVERY tier of their audience, so a row can never silently omit
// a plan and have it fall through to 'no'.
// ---------------------------------------------------------------------------

/**
 * Build a literal cell for the three owner tiers.
 *
 * @param basico - Value for `owner-basico`.
 * @param pro - Value for `owner-pro`.
 * @param premium - Value for `owner-premium`.
 * @returns A slug-keyed literal cell.
 */
export function ownerLiterals({
    basico,
    pro,
    premium
}: {
    readonly basico: YesNo;
    readonly pro: YesNo;
    readonly premium: YesNo;
}): LiteralsCell {
    return {
        kind: 'literals',
        bySlug: { 'owner-basico': basico, 'owner-pro': pro, 'owner-premium': premium }
    };
}

/**
 * Build a literal cell for the three tourist tiers.
 *
 * @param free - Value for `tourist-free`.
 * @param plus - Value for `tourist-plus`.
 * @param vip - Value for `tourist-vip`.
 * @returns A slug-keyed literal cell.
 */
export function touristLiterals({
    free,
    plus,
    vip
}: {
    readonly free: YesNo;
    readonly plus: YesNo;
    readonly vip: YesNo;
}): LiteralsCell {
    return {
        kind: 'literals',
        bySlug: { 'tourist-free': free, 'tourist-plus': plus, 'tourist-vip': vip }
    };
}

// ---------------------------------------------------------------------------
// Tourist rows (reused by owner's asTourist group)
// ---------------------------------------------------------------------------

export const TOURIST_EXPERIENCE_ROWS: readonly RowConfig[] = [
    {
        id: 'favorites',
        labelKey: 'billing.comparison.row.favorites',
        cell: { kind: 'limit', key: LimitKey.MAX_FAVORITES },
        status: 'available'
    },
    {
        id: 'collections',
        labelKey: 'billing.comparison.row.collections',
        cell: { kind: 'limit', key: LimitKey.MAX_COLLECTIONS },
        status: 'available'
    },
    {
        id: 'reviews',
        labelKey: 'billing.comparison.row.reviews',
        cell: { kind: 'all-yes' },
        status: 'available'
    },
    {
        id: 'recommendations',
        labelKey: 'billing.comparison.row.recommendations',
        cell: { kind: 'all-yes' },
        status: 'available'
    },
    {
        id: 'compare',
        labelKey: 'billing.comparison.row.compare',
        cell: touristLiterals({ free: 'no', plus: 'yes', vip: 'yes' }),
        status: 'available'
    },
    {
        id: 'searchHistory',
        labelKey: 'billing.comparison.row.searchHistory',
        cell: { kind: 'limit', key: LimitKey.MAX_SEARCH_HISTORY_ENTRIES },
        status: 'available'
    },
    {
        id: 'alertsOffers',
        labelKey: 'billing.comparison.row.alertsOffers',
        cell: touristLiterals({ free: 'no', plus: 'yes', vip: 'yes' }),
        status: 'upcoming'
    },
    {
        id: 'whatsappDisplay',
        labelKey: 'billing.comparison.row.whatsappDisplay',
        cell: touristLiterals({ free: 'no', plus: 'yes', vip: 'yes' }),
        status: 'available'
    },
    {
        id: 'whatsappDirect',
        labelKey: 'billing.comparison.row.whatsappDirect',
        cell: touristLiterals({ free: 'no', plus: 'no', vip: 'yes' }),
        status: 'available'
    }
];

export const TOURIST_AI_ROWS: readonly RowConfig[] = [
    {
        id: 'aiSearch',
        labelKey: 'billing.comparison.row.aiSearch',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_SEARCH_PER_MONTH },
        status: 'available',
        noteKey: 'billing.comparison.note.aiSearch'
    },
    {
        id: 'aiChat',
        labelKey: 'billing.comparison.row.aiChat',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH },
        status: 'available',
        noteKey: 'billing.comparison.note.aiChatTourist'
    }
];

/** Convert a tourist cell to its tourist-VIP value for the owner asTourist group. */
export function asVipForAll(cell: RowCellDef): RowCellDef {
    // `limit` cells are passed through unchanged: the owner plan's actual
    // plan.limits value is used (e.g. MAX_FAVORITES=-1 → "Ilimitado",
    // MAX_AI_SEARCH_PER_MONTH=200 → 200). Conversion to 'all-unlimited' was
    // removed in SPEC-283 so graduated AI quotas surface correctly for owners.
    if (cell.kind === 'literals') {
        return cell.bySlug['tourist-vip'] === 'yes' ? { kind: 'all-yes' } : { kind: 'all-no' };
    }
    return cell;
}

export const OWNER_AS_TOURIST_ROWS: readonly RowConfig[] = [
    ...TOURIST_EXPERIENCE_ROWS,
    ...TOURIST_AI_ROWS
].map((row) => ({ ...row, cell: asVipForAll(row.cell) }));

// ---------------------------------------------------------------------------
// Owner-specific rows
// ---------------------------------------------------------------------------

export const OWNER_ROWS: readonly RowConfig[] = [
    {
        id: 'publish',
        labelKey: 'billing.comparison.row.publish',
        cell: { kind: 'limit', key: LimitKey.MAX_ACCOMMODATIONS },
        status: 'available'
    },
    {
        id: 'photos',
        labelKey: 'billing.comparison.row.photos',
        cell: { kind: 'limit', key: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION },
        status: 'available'
    },
    {
        id: 'editInfo',
        labelKey: 'billing.comparison.row.editInfo',
        cell: { kind: 'all-yes' },
        status: 'available'
    },
    {
        id: 'respondReviews',
        labelKey: 'billing.comparison.row.respondReviews',
        cell: { kind: 'all-yes' },
        status: 'upcoming'
    },
    {
        id: 'basicStats',
        labelKey: 'billing.comparison.row.basicStats',
        cell: { kind: 'all-yes' },
        status: 'available'
    },
    {
        id: 'advancedStats',
        labelKey: 'billing.comparison.row.advancedStats',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'available'
    },
    {
        id: 'calendar',
        labelKey: 'billing.comparison.row.calendar',
        cell: { kind: 'all-yes' },
        status: 'available'
    },
    {
        id: 'calendarSync',
        labelKey: 'billing.comparison.row.calendarSync',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'available'
    },
    {
        id: 'richDescription',
        labelKey: 'billing.comparison.row.richDescription',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'available'
    },
    {
        id: 'video',
        labelKey: 'billing.comparison.row.video',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'available'
    },
    {
        id: 'promotions',
        labelKey: 'billing.comparison.row.promotions',
        cell: { kind: 'limit', key: LimitKey.MAX_ACTIVE_PROMOTIONS },
        status: 'available'
    },
    {
        id: 'prioritySupport',
        labelKey: 'billing.comparison.row.prioritySupport',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'upcoming'
    },
    {
        id: 'featured',
        labelKey: 'billing.comparison.row.featured',
        cell: ownerLiterals({ basico: 'no', pro: 'yes', premium: 'yes' }),
        status: 'available'
    },
    {
        id: 'branding',
        labelKey: 'billing.comparison.row.branding',
        cell: ownerLiterals({ basico: 'no', pro: 'no', premium: 'yes' }),
        status: 'upcoming'
    },
    {
        id: 'verificationBadge',
        labelKey: 'billing.comparison.row.verificationBadge',
        cell: ownerLiterals({ basico: 'no', pro: 'no', premium: 'yes' }),
        status: 'available'
    }
];

export const OWNER_AI_ROWS: readonly RowConfig[] = [
    {
        id: 'aiTextImprove',
        labelKey: 'billing.comparison.row.aiTextImprove',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH },
        status: 'available'
    },
    {
        id: 'aiTranslate',
        labelKey: 'billing.comparison.row.aiTranslate',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_TRANSLATE_PER_MONTH },
        status: 'available'
    },
    {
        id: 'aiImport',
        labelKey: 'billing.comparison.row.aiImport',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH },
        status: 'available'
    },
    {
        id: 'aiChatOwner',
        labelKey: 'billing.comparison.row.aiChatOwner',
        cell: { kind: 'limit', key: LimitKey.MAX_AI_CHAT_PER_MONTH },
        status: 'available',
        noteKey: 'billing.comparison.note.aiChatOwner'
    },
    {
        id: 'aiSupport',
        labelKey: 'billing.comparison.row.aiSupport',
        cell: { kind: 'all-no' },
        status: 'upcoming',
        noteKey: 'billing.comparison.note.aiSupportAddon'
    }
];

/**
 * Minimum plan shape needed to resolve a cell. `PublicPlanData` satisfies it
 * structurally, so tests can build fixtures without the full API payload.
 */
export interface PlanCellSource {
    readonly slug: string;
    readonly limits: Readonly<Record<string, number>>;
}

/**
 * Resolve one row cell for one plan column.
 *
 * Literal cells are looked up by `plan.slug`, so the rendered column set
 * (which tiers are active, and in what order) cannot change which value a
 * plan gets. An uncurated slug resolves to `'no'` (HOS-329).
 *
 * @param cell - The row's typed cell definition.
 * @param plan - The plan rendered in this column.
 * @returns The value to render: `'yes' | 'no' | 'unlimited' | number`.
 */
export function resolveCell({
    cell,
    plan
}: {
    readonly cell: RowCellDef;
    readonly plan: PlanCellSource;
}): CellRendered {
    switch (cell.kind) {
        case 'limit': {
            if (!(cell.key in plan.limits)) return 'no';
            const val = plan.limits[cell.key];
            return val === -1 ? 'unlimited' : (val as CellRendered);
        }
        case 'literals':
            return cell.bySlug[plan.slug as ComparablePlanSlug] ?? 'no';
        case 'all-yes':
            return 'yes';
        case 'all-no':
            return 'no';
        case 'all-unlimited':
            return 'unlimited';
    }
}

/**
 * Resolve a whole row: one rendered value per plan column, in render order.
 *
 * @param cell - The row's typed cell definition.
 * @param plans - The plan columns actually rendered, in display order.
 * @returns One rendered value per column, positionally aligned with `plans`.
 */
export function resolveRowCells({
    cell,
    plans
}: {
    readonly cell: RowCellDef;
    readonly plans: readonly PlanCellSource[];
}): readonly CellRendered[] {
    return plans.map((plan) => resolveCell({ cell, plan }));
}

export const TOURIST_GROUPS: readonly GroupConfig[] = [
    { id: 'experience', rows: TOURIST_EXPERIENCE_ROWS },
    { id: 'ai', rows: TOURIST_AI_ROWS }
];

export const OWNER_GROUPS: readonly GroupConfig[] = [
    { id: 'asTourist', rows: OWNER_AS_TOURIST_ROWS },
    { id: 'asOwner', rows: OWNER_ROWS },
    { id: 'aiBusiness', rows: OWNER_AI_ROWS }
];
