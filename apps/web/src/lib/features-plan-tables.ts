/** Comparison table models and rows for the public features page. */

/**
 * A single plan-table cell value. `yes`/`no` render as check/dash icons,
 * `limit`/`unlimited` render numeric-limit chips, `addon` renders the
 * "con addon" pill, `upcoming` renders the "Próximamente" pill for a
 * phantom entitlement (announced but not yet shipped — HOS-213), and `text`
 * renders an arbitrary short i18n-sourced label (e.g. "ver" / "directo" for
 * the WhatsApp row).
 */
export type PlanCellValue =
    | { readonly kind: 'yes' }
    | { readonly kind: 'no' }
    | { readonly kind: 'limit'; readonly value: string }
    | { readonly kind: 'unlimited' }
    | { readonly kind: 'addon' }
    | { readonly kind: 'upcoming' }
    | { readonly kind: 'text'; readonly labelKey: string };

/** One row of a plan comparison table: a feature label plus one cell per plan column. */
export interface PlanTableRow {
    readonly labelKey: string;
    readonly noteKey?: string;
    readonly cells: readonly [PlanCellValue, PlanCellValue, PlanCellValue];
}

/** Viajeros plan table: Gratis / Plus (popular) / VIP — 11 rows, no prices. */
export const VIAJEROS_TABLE_ROWS: readonly PlanTableRow[] = [
    {
        labelKey: 'features.viajeros.table.rows.favorites.label',
        cells: [
            { kind: 'limit', value: '5' },
            { kind: 'limit', value: '25' },
            { kind: 'unlimited' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.collections.label',
        noteKey: 'features.viajeros.table.rows.collections.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '10' }, { kind: 'limit', value: '25' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.compare.label',
        noteKey: 'features.viajeros.table.rows.compare.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '3' }, { kind: 'limit', value: '5' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.priceAlerts.label',
        noteKey: 'features.viajeros.table.rows.priceAlerts.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '5' }, { kind: 'unlimited' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.recommendations.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.reviews.label',
        cells: [{ kind: 'yes' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.exclusiveOffers.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.hostWhatsapp.label',
        cells: [
            { kind: 'no' },
            { kind: 'text', labelKey: 'features.viajeros.table.rows.hostWhatsapp.plusValue' },
            { kind: 'text', labelKey: 'features.viajeros.table.rows.hostWhatsapp.vipValue' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.aiSearch.label',
        noteKey: 'features.viajeros.table.rows.aiSearch.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '200' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.aiChat.label',
        noteKey: 'features.viajeros.table.rows.aiChat.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '200' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.prioritySupport.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'yes' }]
    }
] as const;

/** Anfitriones plan table: Básico / Pro (popular) / Premium — 14 rows, no prices. */
export const ANFITRIONES_TABLE_ROWS: readonly PlanTableRow[] = [
    {
        labelKey: 'features.anfitriones.table.rows.listings.label',
        noteKey: 'features.anfitriones.table.rows.listings.note',
        cells: [
            { kind: 'limit', value: '1' },
            { kind: 'limit', value: '3' },
            { kind: 'limit', value: '10' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.photos.label',
        noteKey: 'features.anfitriones.table.rows.photos.note',
        cells: [
            { kind: 'limit', value: '15' },
            { kind: 'limit', value: '30' },
            { kind: 'limit', value: '50' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.activePromotions.label',
        cells: [{ kind: 'limit', value: '2' }, { kind: 'limit', value: '5' }, { kind: 'unlimited' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.richDescription.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.videoLink.label',
        cells: [{ kind: 'yes' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.advancedStats.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.featuredListing.label',
        cells: [{ kind: 'addon' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.verificationBadge.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'yes' }]
    },
    {
        // Phantom entitlement (no gate shipped yet, HOS-213): Premium never a plain "yes".
        labelKey: 'features.anfitriones.table.rows.customBranding.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'upcoming' }]
    },
    {
        // Phantom entitlement (no gate shipped yet, HOS-213): Pro/Premium never a plain "yes".
        labelKey: 'features.anfitriones.table.rows.prioritySupport.label',
        cells: [{ kind: 'no' }, { kind: 'upcoming' }, { kind: 'upcoming' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiImport.label',
        noteKey: 'features.anfitriones.table.rows.aiImport.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiImprove.label',
        noteKey: 'features.anfitriones.table.rows.aiImprove.note',
        cells: [
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' },
            { kind: 'limit', value: '1.250' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiTranslate.label',
        noteKey: 'features.anfitriones.table.rows.aiTranslate.note',
        cells: [
            { kind: 'limit', value: '200' },
            { kind: 'limit', value: '1.000' },
            { kind: 'limit', value: '5.000' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiGuestChat.label',
        noteKey: 'features.anfitriones.table.rows.aiGuestChat.note',
        cells: [
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' },
            { kind: 'limit', value: '1.250' }
        ]
    }
] as const;
