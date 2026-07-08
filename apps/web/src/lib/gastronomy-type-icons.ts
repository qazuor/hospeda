/**
 * @file gastronomy-type-icons.ts
 * @description Canonical gastronomy-type → icon mapping for `apps/web`
 * (HOS-97). Maps every `GastronomyTypeEnum` value to a representative
 * `@repo/icons` component so the gastronomy quick-filter chip row and any
 * future gastronomy UI surface render a consistent icon per type.
 *
 * `@repo/icons` has no dedicated icons for a handful of gastronomy-specific
 * concepts (brewery, ice-cream shop, takeaway/rotisserie, food truck), so
 * those types use the closest sensible glyph from the existing catalog
 * rather than an invented icon name — see the inline notes on
 * {@link GASTRONOMY_TYPE_ICONS} for the reasoning per type.
 *
 * Unlike `accommodation-type-icons.ts` (a thin re-export of a cross-app
 * `@repo/icons/domain` module), this mapping lives locally in `apps/web`
 * because gastronomy/experience listings are web-only today — there is no
 * `@repo/icons/domain/gastronomy-type.ts` shared with `apps/admin` yet.
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
import { GastronomyTypeEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

interface GastronomyTypeParams {
    /** Gastronomy type from the API (case-insensitive, e.g. `"RESTAURANT"`). */
    readonly type: string;
}

/**
 * Canonical gastronomy-type → icon map. Keys are every `GastronomyTypeEnum`
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
const GASTRONOMY_TYPE_ICONS: Readonly<Record<GastronomyTypeEnum, ComponentType<IconProps>>> = {
    [GastronomyTypeEnum.RESTAURANT]: RestaurantIcon,
    [GastronomyTypeEnum.BAR]: BarServiceIcon,
    [GastronomyTypeEnum.CAFE]: CoffeeIcon,
    [GastronomyTypeEnum.PARRILLA]: TraditionalGrillIcon,
    [GastronomyTypeEnum.CERVECERIA]: TraditionalPubIcon,
    [GastronomyTypeEnum.HELADERIA]: SnowflakeIcon,
    [GastronomyTypeEnum.PANADERIA]: TraditionalBakeryIcon,
    [GastronomyTypeEnum.ROTISERIA]: PackageIcon,
    [GastronomyTypeEnum.FOOD_TRUCK]: MotorhomeParkingIcon
};

/**
 * Fallback icon for gastronomy type values not present in the canonical map
 * (e.g. a future enum value the UI hasn't been updated for yet).
 */
export const GASTRONOMY_TYPE_FALLBACK_ICON: ComponentType<IconProps> = ForkKnifeIcon;

/**
 * Resolve the representative icon component for a given gastronomy type.
 *
 * @param params.type - Gastronomy type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or {@link GASTRONOMY_TYPE_FALLBACK_ICON}.
 *
 * @example
 * ```ts
 * getGastronomyTypeIcon({ type: 'RESTAURANT' }); // RestaurantIcon
 * getGastronomyTypeIcon({ type: 'restaurant' }); // RestaurantIcon (case-insensitive)
 * getGastronomyTypeIcon({ type: 'unknown' });     // GASTRONOMY_TYPE_FALLBACK_ICON
 * ```
 */
export function getGastronomyTypeIcon({ type }: GastronomyTypeParams): ComponentType<IconProps> {
    const normalized = type.toUpperCase() as GastronomyTypeEnum;
    return GASTRONOMY_TYPE_ICONS[normalized] ?? GASTRONOMY_TYPE_FALLBACK_ICON;
}
