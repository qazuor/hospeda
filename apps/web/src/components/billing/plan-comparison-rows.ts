/**
 * @file plan-comparison-rows.ts
 * @description Row-model types and curated row/group configs for the plan
 * comparison table (`PlanComparisonTable.astro`). Extracted from the component
 * so the catalog-veracity data (each row's status + per-plan values) has a
 * direct unit-test surface (HOS-213) and to keep the `.astro` file within the
 * project's file-size budget.
 *
 * Every row references an i18n `labelKey` and carries a typed cell definition,
 * a `status` (`available` | `upcoming`), and an optional `noteKey`. The literal
 * value arrays are index-safe because `fetch-plans.ts` sorts owner plans by
 * `sortOrder` ascending (0 = básico, 1 = pro, 2 = premium).
 */

import { LimitKey } from '@repo/billing';

export type YesNo = 'yes' | 'no';

export interface LimitCell {
    readonly kind: 'limit';
    /** Strongly-typed limit key — reads the real value from plan.limits. */
    readonly key: LimitKey;
}
export interface LiteralsCell {
    readonly kind: 'literals';
    /** One value per plan column (in sort order). */
    readonly values: readonly YesNo[];
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
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
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
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'upcoming'
    },
    {
        id: 'whatsappDisplay',
        labelKey: 'billing.comparison.row.whatsappDisplay',
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'available'
    },
    {
        id: 'whatsappDirect',
        labelKey: 'billing.comparison.row.whatsappDirect',
        cell: { kind: 'literals', values: ['no', 'no', 'yes'] },
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
        const vipValue = cell.values[cell.values.length - 1];
        return vipValue === 'yes' ? { kind: 'all-yes' } : { kind: 'all-no' };
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
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
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
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'available'
    },
    {
        id: 'richDescription',
        labelKey: 'billing.comparison.row.richDescription',
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'available'
    },
    {
        id: 'video',
        labelKey: 'billing.comparison.row.video',
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
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
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'upcoming'
    },
    {
        id: 'featured',
        labelKey: 'billing.comparison.row.featured',
        cell: { kind: 'literals', values: ['no', 'yes', 'yes'] },
        status: 'available'
    },
    {
        id: 'branding',
        labelKey: 'billing.comparison.row.branding',
        cell: { kind: 'literals', values: ['no', 'no', 'yes'] },
        status: 'upcoming'
    },
    {
        id: 'verificationBadge',
        labelKey: 'billing.comparison.row.verificationBadge',
        cell: { kind: 'literals', values: ['no', 'no', 'yes'] },
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

export const TOURIST_GROUPS: readonly GroupConfig[] = [
    { id: 'experience', rows: TOURIST_EXPERIENCE_ROWS },
    { id: 'ai', rows: TOURIST_AI_ROWS }
];

export const OWNER_GROUPS: readonly GroupConfig[] = [
    { id: 'asTourist', rows: OWNER_AS_TOURIST_ROWS },
    { id: 'asOwner', rows: OWNER_ROWS },
    { id: 'aiBusiness', rows: OWNER_AI_ROWS }
];
