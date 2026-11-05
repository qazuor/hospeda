/**
 * @file plan-comparison-catalog-rows.ts
 * @description Catalog-backed rows for the plan comparison table (HOS-1865,
 * AC:6:9). The venue/experience rows that belong to a listing section or to a
 * section trait are generated from `LISTING_SECTIONS`; the section catalog is
 * the single source of truth, so a section or trait added to it shows up in the
 * table with no edit here.
 *
 * Two properties are deliberately absent from this module:
 *
 * - `BUSINESS_LINES` is never imported. G-FAC-03 keeps its importers on a
 *   closed allowlist that excludes the web, so the section → business-line
 *   cross comes from `resolveSectionBusinessLines` in `@repo/schemas`.
 * - Business-line values are never compared or written as literals. A row only
 *   carries the `lineMarks` the catalog helper returned; the table renders
 *   them through the existing `venue.owner.businessLines.*` locale labels.
 *
 * This lives beside `plan-comparison-rows.ts` (already at its file-size
 * budget) and next to its types.
 */

import type { IconProps } from '@repo/icons';
import {
    type EntitlementKeyEnum,
    LISTING_SECTIONS,
    type ListingSectionId,
    resolveSectionBusinessLines
} from '@repo/schemas';
import type { ComponentType } from 'react';
import { COMPARISON_ROW_ICONS } from '@/components/billing/comparison-row-icons';
import type { GroupConfig, LineMark, RowConfig } from '@/components/billing/plan-comparison-rows';

/** Verticals whose comparison table is generated from the section catalog. */
export type CatalogComparisonVertical = 'venue' | 'experience';

/** Minimal catalog-section shape this builder needs. */
export interface CatalogSectionLike {
    readonly id: string;
    readonly entitlementKey?: EntitlementKeyEnum | undefined;
    readonly traits?:
        | readonly {
              readonly id: string;
              readonly entitlementKey?: EntitlementKeyEnum | undefined;
          }[]
        | undefined;
}

/** What the web adds to one catalog section or trait. */
interface CatalogRowPresentation {
    /** Row id the table, i18n and icon maps key off. */
    readonly rowId: string;
    /** Full i18n key of the row label. */
    readonly labelKey: string;
    /** Full i18n key of the row description. */
    readonly descKey: string;
    /** Decorative icon, resolved from the shared icon table. */
    readonly icon: ComponentType<IconProps> | undefined;
}

/** Presentation of one section and its optional traits. */
interface SectionCatalogPresentation {
    readonly section?: CatalogRowPresentation;
    readonly traits?: Readonly<Record<string, CatalogRowPresentation>>;
}

/**
 * Venue presentation. Exhaustive over the catalog's section ids on purpose: a
 * section added to `LISTING_SECTIONS.venue` without its row presentation stops
 * the build here, before the table can silently omit it.
 */
const VENUE_CATALOG_PRESENTATION = {
    basicInfo: {},
    openingHours: {},
    price: {},
    amenities: {},
    media: {},
    contact: {},
    menu: {
        section: {
            rowId: 'venueMenu',
            labelKey: 'billing.comparison.row.venueMenu',
            descKey: 'billing.comparison.rowDesc.venueMenu',
            icon: COMPARISON_ROW_ICONS.venueMenu
        },
        traits: {
            itemPhotos: {
                rowId: 'menuItemPhotos',
                labelKey: 'billing.comparison.row.menuItemPhotos',
                descKey: 'billing.comparison.rowDesc.menuItemPhotos',
                icon: COMPARISON_ROW_ICONS.menuItemPhotos
            },
            translations: {
                rowId: 'multilingualMenu',
                labelKey: 'billing.comparison.row.multilingualMenu',
                descKey: 'billing.comparison.rowDesc.multilingualMenu',
                icon: COMPARISON_ROW_ICONS.multilingualMenu
            },
            qr: {
                rowId: 'menuQrScanMetrics',
                labelKey: 'billing.comparison.row.menuQrScanMetrics',
                descKey: 'billing.comparison.rowDesc.menuQrScanMetrics',
                icon: COMPARISON_ROW_ICONS.menuQrScanMetrics
            },
            qrMetrics: {
                rowId: 'menuQrScanMetrics',
                labelKey: 'billing.comparison.row.menuQrScanMetrics',
                descKey: 'billing.comparison.rowDesc.menuQrScanMetrics',
                icon: COMPARISON_ROW_ICONS.menuQrScanMetrics
            }
        }
    },
    dailySpecials: {
        section: {
            rowId: 'venueDailySpecial',
            labelKey: 'billing.comparison.row.venueDailySpecial',
            descKey: 'billing.comparison.rowDesc.venueDailySpecial',
            icon: COMPARISON_ROW_ICONS.venueDailySpecial
        }
    },
    venueEvents: {
        section: {
            rowId: 'venueEvents',
            labelKey: 'billing.comparison.row.venueEvents',
            descKey: 'billing.comparison.rowDesc.venueEvents',
            icon: COMPARISON_ROW_ICONS.venueEvents
        }
    },
    faqs: {},
    nightInfo: {},
    translations: {}
} satisfies Record<ListingSectionId<'venue'>, SectionCatalogPresentation>;

/** Experience presentation, exhaustive over the catalog's section ids. */
const EXPERIENCE_CATALOG_PRESENTATION = {
    basicInfo: {},
    meetingPoint: {
        traits: {
            directions: {
                rowId: 'experienceDirections',
                labelKey: 'billing.comparison.row.experienceDirections',
                descKey: 'billing.comparison.rowDesc.experienceDirections',
                icon: COMPARISON_ROW_ICONS.experienceDirections
            }
        }
    },
    practicalInfo: {},
    openingHours: {},
    price: {},
    amenities: {},
    media: {},
    contact: {},
    faqs: {},
    translations: {}
} satisfies Record<ListingSectionId<'experience'>, SectionCatalogPresentation>;

const CATALOG_PRESENTATION: Readonly<
    Record<CatalogComparisonVertical, Readonly<Record<string, SectionCatalogPresentation>>>
> = {
    venue: VENUE_CATALOG_PRESENTATION,
    experience: EXPERIENCE_CATALOG_PRESENTATION
};

/** Every venue/experience row generated from the catalog, grouped under one id. */
export const CATALOG_SECTIONS_GROUP_ID = 'catalogSections';

/**
 * Builds one row from a catalog section or trait.
 *
 * @param input - Row identity, entitlement and presentation.
 * @returns The renderable row.
 */
function buildRow({
    sectionId,
    traitId,
    entitlementKey,
    presentation,
    lineMarks
}: {
    readonly sectionId: string;
    readonly traitId?: string | undefined;
    readonly entitlementKey: EntitlementKeyEnum;
    readonly presentation: CatalogRowPresentation | undefined;
    readonly lineMarks: readonly LineMark[];
}): RowConfig {
    const rowId = presentation?.rowId ?? (traitId ? `${sectionId}.${traitId}` : sectionId);
    return {
        id: rowId,
        labelKey: presentation?.labelKey ?? `billing.comparison.row.${rowId}`,
        cell: { kind: 'entitlement', key: entitlementKey },
        status: 'available',
        icon: presentation?.icon,
        ...(lineMarks.length > 0 ? { lineMarks } : {})
    };
}

/**
 * Generates the comparison rows owned by a vertical's section catalog.
 *
 * A row is emitted for every section with an `entitlementKey` and for every
 * trait with one; a trait whose key another row already emitted is skipped
 * (`qr` and `qrMetrics` share the QR-metrics entitlement). Sections without an
 * entitlement key (common sections, `nightInfo`) produce no row.
 *
 * @param input - Vertical and, optionally, an injected catalog (tests).
 * @param input.vertical - Vertical whose catalog drives the rows.
 * @param input.sections - Catalog to read; defaults to the real one.
 * @returns The generated group.
 */
export function buildCatalogComparisonGroup<V extends CatalogComparisonVertical>({
    vertical,
    sections
}: {
    readonly vertical: V;
    readonly sections?: readonly CatalogSectionLike[] | undefined;
}): GroupConfig {
    const catalog =
        sections ?? (LISTING_SECTIONS[vertical] as unknown as readonly CatalogSectionLike[]);
    const presentation = CATALOG_PRESENTATION[vertical];
    const emittedKeys = new Set<string>();
    const rows: RowConfig[] = [];

    for (const section of catalog) {
        const lineMarks = resolveSectionBusinessLines({
            vertical,
            sectionId: section.id as ListingSectionId<V>
        }).map((line) => ({ value: line.value, urlSlug: line.urlSlug }));

        const entitlementKey = section.entitlementKey;
        if (entitlementKey && !emittedKeys.has(entitlementKey)) {
            emittedKeys.add(entitlementKey);
            rows.push(
                buildRow({
                    sectionId: section.id,
                    entitlementKey,
                    presentation: presentation[section.id]?.section,
                    lineMarks
                })
            );
        }

        for (const trait of section.traits ?? []) {
            const traitKey = trait.entitlementKey;
            if (!traitKey || emittedKeys.has(traitKey)) continue;
            emittedKeys.add(traitKey);
            rows.push(
                buildRow({
                    sectionId: section.id,
                    traitId: trait.id,
                    entitlementKey: traitKey,
                    presentation: presentation[section.id]?.traits?.[trait.id],
                    lineMarks
                })
            );
        }
    }

    return { id: CATALOG_SECTIONS_GROUP_ID, rows };
}

/**
 * Renders the business-line marks of one row.
 *
 * The phrase is a literal i18n key; the business-line name comes from the
 * locale's existing `venue.owner.businessLines.<value>.label` entry. No catalog
 * value is compared here — the mark was resolved by the schemas helper.
 *
 * @param input - The row's marks and the active translator.
 * @returns The localized phrase(s), joined when a row has more than one owner.
 */
export function getLineMarkText({
    lineMarks,
    t
}: {
    readonly lineMarks: readonly LineMark[];
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}): string {
    return lineMarks
        .map((mark) => {
            const name = t(`venue.owner.businessLines.${mark.value}.label`, mark.value);
            return t('billing.comparison.lineMark', undefined, { rubro: name });
        })
        .join(' · ');
}
