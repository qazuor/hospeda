/**
 * @file poi-type-icons.ts
 * @description Canonical `PointOfInterestTypeEnum` → icon mapping for
 * `apps/web` (HOS-113 Phase 4). Maps every POI `type` value to a
 * representative `@repo/icons` component so `DestinationPOISection.astro`
 * renders a consistent icon per landmark category.
 *
 * The `icon` field on the POI row itself stores a Material-Symbols-style
 * slug (e.g. `"stadium"`, `"beach_access"`) that has no matching entry in
 * `@repo/icons`' resolver — that vocabulary belongs to a different icon
 * system. Rather than introduce a second, largely-empty icon-name mapping
 * table for it, this module resolves the icon from the closed, 9-value
 * `type` enum instead (mirrors `experience-type-icons.ts`'s HOS-97 pattern),
 * which guarantees every seeded and future POI renders a real icon.
 */
import {
    BeachIcon,
    HistoricMonumentIcon,
    type IconProps,
    MainSquareIcon,
    MunicipalStadiumIcon,
    MuseumIcon,
    NaturalReserveIcon,
    ParkIcon,
    PrivateViewpointIcon,
    TagIcon
} from '@repo/icons';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

interface PointOfInterestTypeParams {
    /** POI type from the API (case-insensitive, e.g. `"BEACH"`). */
    readonly type: string;
}

/**
 * Canonical POI-type → icon map. Keys are every `PointOfInterestTypeEnum`
 * value (the `Record` type enforces exhaustiveness at compile time).
 *
 * `VIEWPOINT` reuses `PrivateViewpointIcon` (an amenities-category icon) —
 * `@repo/icons` has no dedicated public-viewpoint/lookout glyph in the
 * attractions category yet, and it is the closest available concept.
 */
const POINT_OF_INTEREST_TYPE_ICONS: Readonly<
    Record<PointOfInterestTypeEnum, ComponentType<IconProps>>
> = {
    [PointOfInterestTypeEnum.BEACH]: BeachIcon,
    [PointOfInterestTypeEnum.STADIUM]: MunicipalStadiumIcon,
    [PointOfInterestTypeEnum.PARK]: ParkIcon,
    [PointOfInterestTypeEnum.MUSEUM]: MuseumIcon,
    [PointOfInterestTypeEnum.PLAZA]: MainSquareIcon,
    [PointOfInterestTypeEnum.MONUMENT]: HistoricMonumentIcon,
    [PointOfInterestTypeEnum.VIEWPOINT]: PrivateViewpointIcon,
    [PointOfInterestTypeEnum.NATURAL]: NaturalReserveIcon,
    [PointOfInterestTypeEnum.OTHER]: TagIcon
};

/**
 * Fallback icon for POI type values not present in the canonical map (e.g. a
 * future enum value the UI hasn't been updated for yet). Matches the `OTHER`
 * icon, mirroring the experience-type fallback convention.
 */
export const POINT_OF_INTEREST_TYPE_FALLBACK_ICON: ComponentType<IconProps> = TagIcon;

/**
 * Resolve the representative icon component for a given POI type.
 *
 * @param params.type - POI type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or {@link POINT_OF_INTEREST_TYPE_FALLBACK_ICON}.
 *
 * @example
 * ```ts
 * getPointOfInterestTypeIcon({ type: 'BEACH' }); // BeachIcon
 * getPointOfInterestTypeIcon({ type: 'beach' }); // BeachIcon (case-insensitive)
 * getPointOfInterestTypeIcon({ type: 'unknown' }); // POINT_OF_INTEREST_TYPE_FALLBACK_ICON
 * ```
 */
export function getPointOfInterestTypeIcon({
    type
}: PointOfInterestTypeParams): ComponentType<IconProps> {
    const normalized = type.toUpperCase() as PointOfInterestTypeEnum;
    return POINT_OF_INTEREST_TYPE_ICONS[normalized] ?? POINT_OF_INTEREST_TYPE_FALLBACK_ICON;
}
