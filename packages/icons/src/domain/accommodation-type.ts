/**
 * @file domain/accommodation-type.ts
 * @description Single source of truth for the accommodation-type → visual
 * mapping ({ icon, colorToken, textToken }). Shared by `apps/web` and
 * `apps/admin` so a given accommodation type renders with the SAME icon and
 * the SAME colors in both surfaces.
 *
 * The color tokens are the SHORT design-token names (e.g. `'hospeda-forest'`,
 * `'accent'`). Consumers resolve them to CSS custom-property strings via
 * {@link getAccommodationTypeColorScheme}, which mirrors the web app's
 * historical `scheme()`/`resolveToken()` helpers byte-for-byte so existing
 * snapshots/tests stay green.
 *
 * Keys are lowercase accommodation-type slugs (matching the lowercased
 * `AccommodationTypeEnum` values). Unknown types fall back to the generic
 * `AccommodationIcon` + the `accent` color token.
 *
 * NOTE: this module intentionally does NOT depend on `@repo/schemas` — it keys
 * on plain string slugs so `@repo/icons` stays dependency-free and bundles in
 * both the React (admin) and Astro/React (web) toolchains.
 */

import type { ComponentType } from 'react';
import { BedroomsIcon } from '../icons/accommodation/BedroomsIcon';
import { CarIcon } from '../icons/amenities/CarIcon';
import { PoolIcon } from '../icons/amenities/PoolIcon';
import { TouristRanchIcon } from '../icons/attractions/TouristRanchIcon';
import { AccommodationIcon } from '../icons/entities/AccommodationIcon';
import { TentIcon } from '../icons/features/TentIcon';
import { TreeIcon } from '../icons/features/TreeIcon';
import { BellIcon } from '../icons/system/BellIcon';
import { BuildingsIcon } from '../icons/system/BuildingsIcon';
import { HomeIcon } from '../icons/system/HomeIcon';
import { UsersIcon } from '../icons/system/UsersIcon';
import type { IconProps } from '../types';

/**
 * Color scheme for a badge / pill. All values are valid CSS property values
 * referencing semantic design tokens, intended for inline `style` use:
 * `background-color: ${scheme.bg}; color: ${scheme.text}; border-color: ${scheme.border};`
 */
export interface AccommodationTypeColorScheme {
    /** CSS `background-color` value (e.g. `oklch(from var(--brand-accent) l c h / 0.15)`). */
    readonly bg: string;
    /** CSS `color` value (e.g. `var(--brand-accent)`). */
    readonly text: string;
    /** CSS `border-color` value (e.g. `oklch(from var(--brand-accent) l c h / 0.30)`). */
    readonly border: string;
}

/**
 * Canonical visual descriptor for an accommodation type: the icon component
 * plus the design-token names used to color its badge.
 */
export interface AccommodationTypeVisual {
    /** Representative icon component from `@repo/icons`. */
    readonly icon: ComponentType<IconProps>;
    /** Short color-token name for the badge background / text (e.g. `'hospeda-forest'`). */
    readonly colorToken: string;
    /** Optional short color-token name for the text, when it differs from `colorToken`. */
    readonly textToken?: string;
}

/**
 * Canonical accommodation-type → visual map. Keys are lowercase type slugs.
 * The icon + color choices are the single source of truth previously split
 * between `apps/web/src/lib/accommodation-type-icons.ts` and
 * `apps/web/src/lib/colors.ts`.
 *
 * Each `colorToken` is a per-type design token (`accommodation-type-<type>`)
 * defined in `@repo/design-tokens`. Those tokens reference distinct base
 * palettes (layered color model), so every type now has its OWN hue. Because
 * each per-type token is already a saturated, type-specific color, the
 * `contrast` variant derives a legible light fill + dark text directly from
 * its hue — no `textToken` override is needed (and they have been dropped).
 */
export const ACCOMMODATION_TYPE_VISUALS: Readonly<Record<string, AccommodationTypeVisual>> = {
    apartment: { icon: BuildingsIcon, colorToken: 'accommodation-type-apartment' },
    house: { icon: HomeIcon, colorToken: 'accommodation-type-house' },
    country_house: { icon: TouristRanchIcon, colorToken: 'accommodation-type-country-house' },
    cabin: { icon: TreeIcon, colorToken: 'accommodation-type-cabin' },
    hotel: { icon: BellIcon, colorToken: 'accommodation-type-hotel' },
    hostel: { icon: UsersIcon, colorToken: 'accommodation-type-hostel' },
    camping: { icon: TentIcon, colorToken: 'accommodation-type-camping' },
    room: { icon: BedroomsIcon, colorToken: 'accommodation-type-room' },
    motel: { icon: CarIcon, colorToken: 'accommodation-type-motel' },
    resort: { icon: PoolIcon, colorToken: 'accommodation-type-resort' }
};

/**
 * Fallback visual for accommodation types not present in the canonical map.
 * Uses the hotel per-type token (accent-based orange) as a neutral default.
 */
export const ACCOMMODATION_TYPE_FALLBACK_VISUAL: AccommodationTypeVisual = {
    icon: AccommodationIcon,
    colorToken: 'accommodation-type-hotel'
};

interface AccommodationTypeParams {
    /** Accommodation type slug (case-insensitive, e.g. `'HOTEL'` or `'country_house'`). */
    readonly type: string;
}

/**
 * Resolve the canonical visual descriptor for an accommodation type.
 *
 * @param params.type - Accommodation type slug. Comparison is case-insensitive.
 * @returns The matching {@link AccommodationTypeVisual}, or the fallback.
 */
export function getAccommodationTypeVisual({
    type
}: AccommodationTypeParams): AccommodationTypeVisual {
    return ACCOMMODATION_TYPE_VISUALS[type.toLowerCase()] ?? ACCOMMODATION_TYPE_FALLBACK_VISUAL;
}

/**
 * Resolve the representative icon component for a given accommodation type.
 *
 * @param params.type - Accommodation type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or `AccommodationIcon` as fallback.
 */
export function getAccommodationTypeIcon({
    type
}: AccommodationTypeParams): ComponentType<IconProps> {
    return getAccommodationTypeVisual({ type }).icon;
}

/**
 * Resolve the short color-token names for a given accommodation type.
 *
 * @param params.type - Accommodation type slug. Comparison is case-insensitive.
 * @returns `{ colorToken, textToken? }` short token names (not CSS strings).
 */
export function getAccommodationTypeColorTokens({ type }: AccommodationTypeParams): {
    readonly colorToken: string;
    readonly textToken?: string;
} {
    const { colorToken, textToken } = getAccommodationTypeVisual({ type });
    return textToken === undefined ? { colorToken } : { colorToken, textToken };
}

/**
 * Maps short token names to their full CSS custom-property names. Tokens that
 * already map 1:1 (e.g. `hospeda-forest` → `--hospeda-forest`) are not listed
 * here since the default pass-through handles them.
 *
 * This is the exact mapping the web app used in `lib/colors.ts` so the emitted
 * CSS strings stay byte-for-byte identical across the refactor.
 */
const TOKEN_TO_CSS_VAR: Readonly<Record<string, string>> = {
    accent: 'brand-accent',
    primary: 'brand-primary',
    secondary: 'brand-secondary',
    foreground: 'core-foreground',
    card: 'core-card',
    'muted-foreground': 'core-muted-foreground',
    'primary-foreground': 'primary-foreground',
    'info-foreground': 'info-foreground',
    'warning-foreground': 'warning-foreground'
};

/** Resolve a short token name to its full CSS custom-property name. */
function resolveToken(token: string): string {
    return TOKEN_TO_CSS_VAR[token] ?? token;
}

/**
 * Visual variants for {@link getAccommodationTypeColorScheme}.
 * - `subtle` (default): the web app's translucent pill (bg 0.15 / text token /
 *   border 0.30). Byte-for-byte identical to the historical `scheme()` helper.
 * - `contrast`: keeps the same brand hue but forces a clearly visible light
 *   fill + dark text (the higher-contrast "pill" look used in the admin panel),
 *   so light tokens (sand/sky) and neutral tokens (muted) still read as a
 *   distinct, legible pill instead of washing out at 0.15 opacity.
 */
export type AccommodationTypeColorVariant = 'subtle' | 'contrast';

/**
 * Build an {@link AccommodationTypeColorScheme} for an accommodation type.
 *
 * The `subtle` variant's output strings are byte-for-byte equal to the web
 * app's historical `scheme()` helper so existing snapshots/tests pass; the
 * `contrast` variant derives a light fill + dark text from the SAME brand hue
 * token (admin panel). Both consume the centralized brand tokens, so the hue
 * stays the single source of truth — only the fill/text treatment differs.
 *
 * @param params.type - Accommodation type slug. Comparison is case-insensitive.
 * @param params.variant - Pill treatment. Defaults to `subtle`.
 * @returns A {@link AccommodationTypeColorScheme} with CSS bg/text/border values.
 */
export function getAccommodationTypeColorScheme({
    type,
    variant = 'subtle'
}: AccommodationTypeParams & {
    readonly variant?: AccommodationTypeColorVariant;
}): AccommodationTypeColorScheme {
    const { colorToken, textToken } = getAccommodationTypeColorTokens({ type });
    const cssToken = resolveToken(colorToken);

    if (variant === 'contrast') {
        // Keep the brand hue (from the token) but pin lightness/chroma so every
        // type renders a perceptible light fill with dark, legible text — the
        // admin pill look. Light-mode tuned (absolute lightness); admin
        // dark-mode is tracked as a separate follow-up.
        return {
            bg: `oklch(from var(--${cssToken}) 0.95 calc(c * 0.55) h)`,
            text: `oklch(from var(--${cssToken}) 0.4 c h)`,
            border: `oklch(from var(--${cssToken}) 0.88 calc(c * 0.55) h)`
        };
    }

    const cssText = resolveToken(textToken ?? colorToken);
    // SPEC-176 T-006: precomputed a15/a30 tokens provide Chrome-109-safe sRGB
    // fallbacks for badge bg and border without regressing modern browsers.
    // bg/border use cssToken (the color base), text uses cssText (may differ).
    return {
        bg: `var(--${cssToken}-a15)`,
        text: `var(--${cssText})`,
        border: `var(--${cssToken}-a30)`
    };
}
