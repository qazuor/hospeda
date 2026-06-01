/**
 * @file domain/event-category.ts
 * @description Single source of truth for the event-category → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * event category renders with the SAME icon and the SAME color in both
 * surfaces.
 *
 * The color tokens are the per-category design-token names (e.g.
 * `'event-category-music'`), defined in `@repo/design-tokens`. Each token is a
 * `var()` reference to an existing base palette's shade-500 primitive, so the
 * categories reuse the brand/semantic palettes rather than introducing new
 * hues. Consumers resolve a token to CSS strings via
 * {@link getEventCategoryColorScheme}.
 *
 * Keys are lowercase category slugs (matching the lowercased
 * `EventCategoryEnum` values). Unknown categories fall back to the generic
 * `TagIcon` + the `event-category-other` token.
 *
 * NOTE: this module intentionally does NOT depend on `@repo/schemas` — it keys
 * on plain string slugs so `@repo/icons` stays dependency-free and bundles in
 * both the React (admin) and Astro/React (web) toolchains.
 */

import type { ComponentType } from 'react';
import { TagIcon } from '../icons/admin/TagIcon';
import { AthleticsTrackIcon } from '../icons/attractions/AthleticsTrackIcon';
import { CraftsFairIcon } from '../icons/attractions/CraftsFairIcon';
import { MuseumIcon } from '../icons/attractions/MuseumIcon';
import { RestaurantIcon } from '../icons/attractions/RestaurantIcon';
import { TreeIcon } from '../icons/features/TreeIcon';
import { AudioIcon } from '../icons/system/AudioIcon';
import { SparkleIcon } from '../icons/system/SparkleIcon';
import type { IconProps } from '../types';

/**
 * Color scheme for a badge / pill. All values are valid CSS property values
 * referencing per-category design tokens, intended for inline `style` use:
 * `background-color: ${scheme.bg}; color: ${scheme.text}; border-color: ${scheme.border};`
 */
export interface EventCategoryColorScheme {
    /** CSS `background-color` value. */
    readonly bg: string;
    /** CSS `color` value. */
    readonly text: string;
    /** CSS `border-color` value. */
    readonly border: string;
}

/**
 * Canonical visual descriptor for an event category: the icon component plus
 * the design-token name used to color its badge.
 */
export interface EventCategoryVisual {
    /** Representative icon component from `@repo/icons`. */
    readonly icon: ComponentType<IconProps>;
    /** Per-category design-token name (e.g. `'event-category-music'`). */
    readonly colorToken: string;
}

/**
 * Canonical event-category → visual map. Keys are lowercase category slugs.
 * Each `colorToken` is a per-category design token (`event-category-<category>`)
 * defined in `@repo/design-tokens`, which references an existing base palette
 * matching the category's historical badge color.
 */
export const EVENT_CATEGORY_VISUALS: Readonly<Record<string, EventCategoryVisual>> = {
    culture: { icon: MuseumIcon, colorToken: 'event-category-culture' },
    sports: { icon: AthleticsTrackIcon, colorToken: 'event-category-sports' },
    festival: { icon: SparkleIcon, colorToken: 'event-category-festival' },
    workshop: { icon: CraftsFairIcon, colorToken: 'event-category-workshop' },
    music: { icon: AudioIcon, colorToken: 'event-category-music' },
    gastronomy: { icon: RestaurantIcon, colorToken: 'event-category-gastronomy' },
    nature: { icon: TreeIcon, colorToken: 'event-category-nature' },
    other: { icon: TagIcon, colorToken: 'event-category-other' }
};

/**
 * Fallback visual for categories not present in the canonical map. Uses the
 * generic tag icon + the neutral `other` token.
 */
export const EVENT_CATEGORY_FALLBACK_VISUAL: EventCategoryVisual = {
    icon: TagIcon,
    colorToken: 'event-category-other'
};

interface EventCategoryParams {
    /** Event category slug (case-insensitive, e.g. `'MUSIC'` or `'gastronomy'`). */
    readonly category: string;
}

/**
 * Resolve the canonical visual descriptor for an event category.
 *
 * @param params.category - Category slug. Comparison is case-insensitive.
 * @returns The matching {@link EventCategoryVisual}, or the fallback.
 */
export function getEventCategoryVisual({ category }: EventCategoryParams): EventCategoryVisual {
    return EVENT_CATEGORY_VISUALS[category.toLowerCase()] ?? EVENT_CATEGORY_FALLBACK_VISUAL;
}

/**
 * Resolve the representative icon component for a given event category.
 *
 * @param params.category - Category slug. Comparison is case-insensitive.
 * @returns The matching icon component, or `TagIcon` as fallback.
 */
export function getEventCategoryIcon({ category }: EventCategoryParams): ComponentType<IconProps> {
    return getEventCategoryVisual({ category }).icon;
}

/**
 * Visual variants for {@link getEventCategoryColorScheme}.
 * - `subtle` (default): translucent pill (bg 0.15 / text token / border 0.30).
 * - `contrast`: light fill + dark text derived from the SAME hue (admin pill).
 */
export type EventCategoryColorVariant = 'subtle' | 'contrast';

/**
 * Build an {@link EventCategoryColorScheme} for an event category. Both
 * variants consume the centralized per-category token, so the hue stays the
 * single source of truth — only the fill/text treatment differs.
 *
 * @param params.category - Category slug. Comparison is case-insensitive.
 * @param params.variant - Pill treatment. Defaults to `subtle`.
 * @returns A {@link EventCategoryColorScheme} with CSS bg/text/border values.
 */
export function getEventCategoryColorScheme({
    category,
    variant = 'subtle'
}: EventCategoryParams & {
    readonly variant?: EventCategoryColorVariant;
}): EventCategoryColorScheme {
    // Per-category tokens map 1:1 to their CSS custom property (no aliasing).
    const cssToken = getEventCategoryVisual({ category }).colorToken;

    if (variant === 'contrast') {
        return {
            bg: `oklch(from var(--${cssToken}) 0.95 calc(c * 0.55) h)`,
            text: `oklch(from var(--${cssToken}) 0.4 c h)`,
            border: `oklch(from var(--${cssToken}) 0.88 calc(c * 0.55) h)`
        };
    }

    // SPEC-176 T-006: precomputed a15/a30 tokens provide Chrome-109-safe sRGB
    // fallbacks for badge bg and border without regressing modern browsers.
    return {
        bg: `var(--${cssToken}-a15)`,
        text: `var(--${cssToken})`,
        border: `var(--${cssToken}-a30)`
    };
}
