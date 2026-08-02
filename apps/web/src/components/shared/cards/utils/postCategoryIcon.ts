/**
 * @file postCategoryIcon.ts
 * @description Maps post categories to their icon component from `@repo/icons`,
 * so a blog card with no cover photo falls back to a large category icon — the
 * same treatment event cards already give their categories (see
 * {@link ./eventCategoryIcon.ts}).
 *
 * Categories that exist on BOTH entities deliberately resolve to the SAME icon
 * as the event map (`CULTURE`/`cultural`, `GASTRONOMY`/`gastronomy`,
 * `NATURE`/`nature`, `SPORT`/`sports`, `WELLNESS`/`wellness`, `FAMILY`/`family`,
 * `ART`/`art`, `FESTIVALS`/`festival`, `EVENTS`), so "Arte" looks the same
 * whether the reader is on an event card or a blog card.
 *
 * Unlike the event map this exposes only the component resolver: every caller
 * renders it dynamically (`const Icon = ...; <Icon />`) rather than through the
 * `===` branch-chain the two event card components still use.
 */

import {
    BeachIcon,
    CompassIcon,
    ConfettiIcon,
    CulturalCenterIcon,
    EventIcon,
    FestivalPlazaIcon,
    FileTextIcon,
    HistoricMonumentIcon,
    type IconProps,
    InfoIcon,
    LocalCraftsIcon,
    MoonIcon,
    MuseumIcon,
    NatureReserveIcon,
    RestaurantIcon,
    RuralAreaIcon,
    SportsCenterIcon,
    UsersIcon,
    WellnessCenterIcon
} from '@repo/icons';
import { PostCategoryEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

/**
 * Icon shown when a category is unknown or missing — the same "generic
 * article" icon `GENERAL` uses.
 */
const FALLBACK_ICON: ComponentType<IconProps> = FileTextIcon;

/**
 * Post category → icon component. Keyed by the uppercase
 * {@link PostCategoryEnum} value the API returns.
 */
const POST_CATEGORY_ICON_COMPONENTS: Readonly<Record<string, ComponentType<IconProps>>> = {
    [PostCategoryEnum.EVENTS]: EventIcon,
    [PostCategoryEnum.CULTURE]: CulturalCenterIcon,
    [PostCategoryEnum.GASTRONOMY]: RestaurantIcon,
    [PostCategoryEnum.NATURE]: NatureReserveIcon,
    [PostCategoryEnum.TOURISM]: CompassIcon,
    [PostCategoryEnum.GENERAL]: FileTextIcon,
    [PostCategoryEnum.SPORT]: SportsCenterIcon,
    [PostCategoryEnum.CARNIVAL]: ConfettiIcon,
    [PostCategoryEnum.NIGHTLIFE]: MoonIcon,
    [PostCategoryEnum.HISTORY]: HistoricMonumentIcon,
    [PostCategoryEnum.TRADITIONS]: LocalCraftsIcon,
    [PostCategoryEnum.WELLNESS]: WellnessCenterIcon,
    [PostCategoryEnum.FAMILY]: UsersIcon,
    [PostCategoryEnum.TIPS]: InfoIcon,
    [PostCategoryEnum.ART]: MuseumIcon,
    [PostCategoryEnum.BEACH]: BeachIcon,
    [PostCategoryEnum.RURAL]: RuralAreaIcon,
    [PostCategoryEnum.FESTIVALS]: FestivalPlazaIcon
};

/**
 * Resolves the icon component for a post category.
 *
 * Case-insensitive: callers pass whatever the API gave them without
 * normalising first.
 *
 * @param category - Raw category string, or `null`/`undefined` when the post
 *   carries none.
 * @returns The matching icon component, or the generic article icon.
 *
 * @example
 * ```astro
 * const CategoryIcon = getPostCategoryIconComponent('gastronomy');
 * <CategoryIcon size={96} weight="duotone" aria-hidden="true" />
 * ```
 */
export function getPostCategoryIconComponent(
    category: string | null | undefined
): ComponentType<IconProps> {
    if (!category) return FALLBACK_ICON;
    return POST_CATEGORY_ICON_COMPONENTS[category.toUpperCase()] ?? FALLBACK_ICON;
}
