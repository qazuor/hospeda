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
 * Yes/no cells are DERIVED from the plan's own `entitlements` array, never from
 * the column's position (HOS-329). Positional values silently reassigned
 * themselves whenever the rendered column set changed — deactivating
 * `owner-basico` shifted every plan one slot left, so `owner-premium`
 * inherited `owner-pro`'s values and lost all of its exclusive features.
 *
 * Deriving from `plan.entitlements` also removes the whole class of drift this
 * table kept suffering: a tier added or re-priced in `plans.config.ts`, or an
 * entitlement granted to a new tier, is reflected here with no edit at all. A
 * hand-maintained per-slug table would instead render every uncurated tier as
 * a wall of "not included".
 */

import { EntitlementKey, LimitKey } from '@repo/billing';

export type YesNo = 'yes' | 'no';

export interface LimitCell {
    readonly kind: 'limit';
    /** Strongly-typed limit key — reads the real value from plan.limits. */
    readonly key: LimitKey;
}
export interface EntitlementCell {
    readonly kind: 'entitlement';
    /**
     * The entitlement that makes this row a "yes". Resolved against the plan's
     * own `entitlements` array, so the cell is correct for any tier — including
     * tiers that did not exist when this row was written.
     */
    readonly key: EntitlementKey;
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

export type RowCellDef = LimitCell | EntitlementCell | AllYesCell | AllNoCell | AllUnlimitedCell;
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
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_COMPARE_ACCOMMODATIONS },
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
        cell: { kind: 'entitlement', key: EntitlementKey.PRICE_ALERTS },
        status: 'upcoming'
    },
    {
        id: 'whatsappDisplay',
        labelKey: 'billing.comparison.row.whatsappDisplay',
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY },
        status: 'available'
    },
    {
        id: 'whatsappDirect',
        labelKey: 'billing.comparison.row.whatsappDirect',
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT },
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

/**
 * The tourist-facing rows as they appear in the owner table's "as tourist"
 * group. They are reused VERBATIM: every owner plan already carries the full
 * tourist-vip entitlement set, so each cell resolves correctly against the
 * owner plan's own entitlements.
 *
 * This used to run each cell through an `asVipForAll` transform that rewrote
 * the tourist literals into a flat all-yes/all-no. That transform existed only
 * because the cells could not be resolved per-plan; deriving from
 * `plan.entitlements` makes it redundant, and it produced identical output for
 * all four rows it touched (verified against the live plans payload).
 * `limit` cells were always passed through unchanged so that graduated AI
 * quotas surface for owners (SPEC-283).
 */
export const OWNER_AS_TOURIST_ROWS: readonly RowConfig[] = [
    ...TOURIST_EXPERIENCE_ROWS,
    ...TOURIST_AI_ROWS
];

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
        cell: { kind: 'entitlement', key: EntitlementKey.VIEW_ADVANCED_STATS },
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
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR },
        status: 'available'
    },
    {
        id: 'richDescription',
        labelKey: 'billing.comparison.row.richDescription',
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_USE_RICH_DESCRIPTION },
        status: 'available'
    },
    {
        id: 'video',
        labelKey: 'billing.comparison.row.video',
        cell: { kind: 'entitlement', key: EntitlementKey.CAN_EMBED_VIDEO },
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
        cell: { kind: 'entitlement', key: EntitlementKey.PRIORITY_SUPPORT },
        status: 'upcoming'
    },
    {
        id: 'featured',
        labelKey: 'billing.comparison.row.featured',
        cell: { kind: 'entitlement', key: EntitlementKey.FEATURED_LISTING },
        status: 'available',
        // FEATURED_LISTING is granted two ways (SPEC-309 OQ-3): plan-wide, and
        // per-accommodation via the visibility-boost addon, which ANY tier can
        // buy. Without this note a básico host reads a flat "not included" here
        // while /funcionalidades offers them the same feature as an addon.
        noteKey: 'billing.comparison.note.featuredAddon'
    },
    {
        id: 'branding',
        labelKey: 'billing.comparison.row.branding',
        cell: { kind: 'entitlement', key: EntitlementKey.CUSTOM_BRANDING },
        status: 'upcoming'
    },
    {
        id: 'verificationBadge',
        labelKey: 'billing.comparison.row.verificationBadge',
        cell: { kind: 'entitlement', key: EntitlementKey.HAS_VERIFICATION_BADGE },
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
    /** Entitlement keys the plan grants, as plain strings. */
    readonly entitlements: readonly string[];
}

/**
 * Resolve one row cell for one plan column.
 *
 * Every cell is resolved from the plan's OWN data — its entitlements or its
 * limits — never from the column's position, so the rendered column set (which
 * tiers are active, and in what order) cannot change which value a plan gets
 * (HOS-329).
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
        case 'entitlement':
            return plan.entitlements.includes(cell.key) ? 'yes' : 'no';
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
