/**
 * @file venue-type-icons.ts
 * @description Canonical venue-type → icon mapping for `apps/web`
 * (HOS-97). Maps every `VenueTypeEnum` value to a representative
 * `@repo/icons` component so the venue quick-filter chip row and any
 * future venue UI surface render a consistent icon per type.
 *
 * `@repo/icons` has no dedicated icons for a handful of venue-specific
 * concepts (brewery, ice-cream shop, takeaway/rotisserie, food truck), so
 * those types use the closest sensible glyph from the existing catalog
 * rather than an invented icon name — see the inline notes on
 * {@link VENUE_TYPE_ICONS} for the reasoning per type.
 *
 * Unlike `accommodation-type-icons.ts` (a thin re-export of a cross-app
 * `@repo/icons/domain` module), this mapping lives locally in `apps/web`
 * because venue/experience listings are web-only today — there is no
 * shared venue-type icon module used by `apps/admin` yet.
 */
import {
    BarServiceIcon,
    CoffeeIcon,
    ForkKnifeIcon,
    type IconProps,
    MotorhomeParkingIcon,
    PackageIcon,
    RestaurantIcon,
    SnowflakeIcon,
    TraditionalBakeryIcon,
    TraditionalGrillIcon,
    TraditionalPubIcon
} from '@repo/icons';
import { VenueTypeEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

interface VenueTypeParams {
    /** Venue type from the API (case-insensitive, e.g. `"RESTAURANT"`). */
    readonly type: string;
}

/**
 * Canonical venue-type → icon map. Keys are every `VenueTypeEnum`
 * value (the `Record` type enforces exhaustiveness at compile time).
 *
 * Notes on the less obvious picks:
 * - `BAR` and `CERVECERIA` both render a beer-stein glyph (`BarServiceIcon` /
 *   `TraditionalPubIcon` — distinct components, same underlying Phosphor
 *   icon) because `@repo/icons` has no separate brewery/beer-mug icon. Both
 *   types are drink-focused venues, so this is a deliberate, reviewed
 *   tradeoff rather than an oversight — flagged for owner review.
 * - `HELADERIA` (ice-cream shop) uses `SnowflakeIcon` — the closest
 *   "cold/frozen" glyph available; there is no ice-cream/gelato icon yet.
 * - `ROTISERIA` (takeaway/prepared-food shop) uses `PackageIcon` — a
 *   takeaway-box glyph; weak but the closest available concept.
 * - `FOOD_TRUCK` uses `MotorhomeParkingIcon` (a van glyph) — the closest
 *   vehicle icon available; there is no dedicated truck icon.
 */
export const VENUE_TYPE_ICONS: Readonly<Record<VenueTypeEnum, ComponentType<IconProps>>> = {
    [VenueTypeEnum.RESTAURANT]: RestaurantIcon,
    [VenueTypeEnum.BAR]: BarServiceIcon,
    [VenueTypeEnum.CAFE]: CoffeeIcon,
    [VenueTypeEnum.PARRILLA]: TraditionalGrillIcon,
    [VenueTypeEnum.CERVECERIA]: TraditionalPubIcon,
    [VenueTypeEnum.HELADERIA]: SnowflakeIcon,
    [VenueTypeEnum.PANADERIA]: TraditionalBakeryIcon,
    [VenueTypeEnum.ROTISERIA]: PackageIcon,
    [VenueTypeEnum.FOOD_TRUCK]: MotorhomeParkingIcon
};

/**
 * Fallback icon for venue type values not present in the canonical map
 * (e.g. a future enum value the UI hasn't been updated for yet).
 */
export const VENUE_TYPE_FALLBACK_ICON: ComponentType<IconProps> = ForkKnifeIcon;

/**
 * Resolve the representative icon component for a given venue type.
 *
 * @param params.type - Venue type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or {@link VENUE_TYPE_FALLBACK_ICON}.
 *
 * @example
 * ```ts
 * getVenueTypeIcon({ type: 'RESTAURANT' }); // RestaurantIcon
 * getVenueTypeIcon({ type: 'restaurant' }); // RestaurantIcon (case-insensitive)
 * getVenueTypeIcon({ type: 'unknown' });     // VENUE_TYPE_FALLBACK_ICON
 * ```
 */
export function getVenueTypeIcon({ type }: VenueTypeParams): ComponentType<IconProps> {
    const normalized = type.toUpperCase() as VenueTypeEnum;
    return VENUE_TYPE_ICONS[normalized] ?? VENUE_TYPE_FALLBACK_ICON;
}
