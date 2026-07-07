/**
 * @file experience-type-icons.ts
 * @description Canonical experience-type → icon mapping for `apps/web`
 * (HOS-97). Maps every `ExperienceTypeEnum` value to a representative
 * `@repo/icons` component so the experience quick-filter chip row and any
 * future experience UI surface render a consistent icon per type.
 *
 * Unlike `accommodation-type-icons.ts` (a thin re-export of a cross-app
 * `@repo/icons/domain` module), this mapping lives locally in `apps/web`
 * because gastronomy/experience listings are web-only today — there is no
 * `@repo/icons/domain/experience-type.ts` shared with `apps/admin` yet.
 */
import {
    BicyclesIcon,
    BirdWatchingIcon,
    CarIcon,
    CompassIcon,
    CulturalCenterIcon,
    DropIcon,
    HistoricMuseumIcon,
    type IconProps,
    KayakRentalIcon,
    MotorhomeParkingIcon,
    NaturalReserveIcon,
    RecreationalBoatingIcon,
    RuralActivitiesIcon,
    SportFishingIcon,
    TagIcon
} from '@repo/icons';
import { ExperienceTypeEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

interface ExperienceTypeParams {
    /** Experience type from the API (case-insensitive, e.g. `"BOAT_TRIP"`). */
    readonly type: string;
}

/**
 * Canonical experience-type → icon map. Keys are every `ExperienceTypeEnum`
 * value (the `Record` type enforces exhaustiveness at compile time).
 *
 * Every type resolves to a visually distinct glyph except `QUAD_RENTAL`,
 * which reuses `MotorhomeParkingIcon` (a van glyph) because `@repo/icons`
 * has no dedicated ATV/quad-bike icon — the closest available vehicle glyph
 * once `CarIcon` is already claimed by `CAR_RENTAL`. `WINE_TASTING` uses
 * `DropIcon` (a generic liquid-drop glyph) as the closest available concept
 * to "tasting" — there is no wine/grape icon in the catalog yet. Both are
 * flagged for owner review.
 */
const EXPERIENCE_TYPE_ICONS: Readonly<Record<ExperienceTypeEnum, ComponentType<IconProps>>> = {
    [ExperienceTypeEnum.CAR_RENTAL]: CarIcon,
    [ExperienceTypeEnum.BIKE_RENTAL]: BicyclesIcon,
    [ExperienceTypeEnum.KAYAK_RENTAL]: KayakRentalIcon,
    [ExperienceTypeEnum.QUAD_RENTAL]: MotorhomeParkingIcon,
    [ExperienceTypeEnum.TOUR_GUIDE]: CompassIcon,
    [ExperienceTypeEnum.GUIDED_VISIT]: HistoricMuseumIcon,
    [ExperienceTypeEnum.EXCURSION]: NaturalReserveIcon,
    [ExperienceTypeEnum.BOAT_TRIP]: RecreationalBoatingIcon,
    [ExperienceTypeEnum.FISHING_CHARTER]: SportFishingIcon,
    [ExperienceTypeEnum.BIRD_WATCHING]: BirdWatchingIcon,
    [ExperienceTypeEnum.CULTURAL_TOUR]: CulturalCenterIcon,
    [ExperienceTypeEnum.WINE_TASTING]: DropIcon,
    [ExperienceTypeEnum.OUTDOOR_ADVENTURE]: RuralActivitiesIcon,
    [ExperienceTypeEnum.OTHER]: TagIcon
};

/**
 * Fallback icon for experience type values not present in the canonical map
 * (e.g. a future enum value the UI hasn't been updated for yet). Matches the
 * `OTHER` icon, mirroring the `@repo/icons` event-category `other` fallback
 * pattern (`TagIcon`).
 */
export const EXPERIENCE_TYPE_FALLBACK_ICON: ComponentType<IconProps> = TagIcon;

/**
 * Resolve the representative icon component for a given experience type.
 *
 * @param params.type - Experience type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or {@link EXPERIENCE_TYPE_FALLBACK_ICON}.
 *
 * @example
 * ```ts
 * getExperienceTypeIcon({ type: 'BOAT_TRIP' }); // RecreationalBoatingIcon
 * getExperienceTypeIcon({ type: 'boat_trip' }); // RecreationalBoatingIcon (case-insensitive)
 * getExperienceTypeIcon({ type: 'unknown' });    // EXPERIENCE_TYPE_FALLBACK_ICON
 * ```
 */
export function getExperienceTypeIcon({ type }: ExperienceTypeParams): ComponentType<IconProps> {
    const normalized = type.toUpperCase() as ExperienceTypeEnum;
    return EXPERIENCE_TYPE_ICONS[normalized] ?? EXPERIENCE_TYPE_FALLBACK_ICON;
}
