/**
 * @file domain/post-category.ts
 * @description Single source of truth for the post-category → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * post category renders with the SAME icon and the SAME color in both
 * surfaces.
 *
 * The color tokens are the per-category design-token names (e.g.
 * `'post-category-music'`), defined in `@repo/design-tokens`. Each token is a
 * `var()` reference to an existing base palette's shade-500 primitive, so the
 * categories reuse the brand/semantic palettes rather than introducing new
 * hues. Consumers resolve a token to CSS strings via
 * {@link getPostCategoryColorScheme}.
 *
 * Keys are lowercase category slugs (matching the lowercased
 * `PostCategoryEnum` values). Unknown categories fall back to the generic
 * `TagIcon` + the `post-category-general` token.
 *
 * NOTE: this module intentionally does NOT depend on `@repo/schemas` — it keys
 * on plain string slugs so `@repo/icons` stays dependency-free.
 */

import type { ComponentType } from 'react';
import { TagIcon } from '../icons/admin/TagIcon';
import { AthleticsTrackIcon } from '../icons/attractions/AthleticsTrackIcon';
import { BeachIcon } from '../icons/attractions/BeachIcon';
import { CarnavalVenueIcon } from '../icons/attractions/CarnavalVenueIcon';
import { CulturalCenterIcon } from '../icons/attractions/CulturalCenterIcon';
import { FestivalPlazaIcon } from '../icons/attractions/FestivalPlazaIcon';
import { HistoricMonumentIcon } from '../icons/attractions/HistoricMonumentIcon';
import { LocalDiscoIcon } from '../icons/attractions/LocalDiscoIcon';
import { MuseumIcon } from '../icons/attractions/MuseumIcon';
import { RestaurantIcon } from '../icons/attractions/RestaurantIcon';
import { WellnessCenterIcon } from '../icons/attractions/WellnessCenterIcon';
import { FamilySuitableIcon } from '../icons/features/FamilySuitableIcon';
import { RuralAreaIcon } from '../icons/features/RuralAreaIcon';
import { TreeIcon } from '../icons/features/TreeIcon';
import { CalendarDotsIcon } from '../icons/system/CalendarDotsIcon';
import { CompassIcon } from '../icons/system/CompassIcon';
import { InfoIcon } from '../icons/system/InfoIcon';
import { PaletteIcon } from '../icons/system/PaletteIcon';
import type { IconProps } from '../types';

/**
 * Color scheme for a badge / pill. All values are valid CSS property values
 * referencing per-category design tokens.
 */
export interface PostCategoryColorScheme {
    readonly bg: string;
    readonly text: string;
    readonly border: string;
}

/**
 * Canonical visual descriptor for a post category: the icon component plus
 * the design-token name used to color its badge.
 */
export interface PostCategoryVisual {
    readonly icon: ComponentType<IconProps>;
    /** Per-category design-token name (e.g. `'post-category-music'`). */
    readonly colorToken: string;
}

/**
 * Canonical post-category → visual map. Keys are lowercase category slugs.
 * Each `colorToken` is a per-category design token (`post-category-<category>`)
 * defined in `@repo/design-tokens`, which references an existing base palette
 * matching the category's historical badge color.
 */
export const POST_CATEGORY_VISUALS: Readonly<Record<string, PostCategoryVisual>> = {
    events: { icon: CalendarDotsIcon, colorToken: 'post-category-events' },
    culture: { icon: MuseumIcon, colorToken: 'post-category-culture' },
    gastronomy: { icon: RestaurantIcon, colorToken: 'post-category-gastronomy' },
    nature: { icon: TreeIcon, colorToken: 'post-category-nature' },
    tourism: { icon: CompassIcon, colorToken: 'post-category-tourism' },
    general: { icon: TagIcon, colorToken: 'post-category-general' },
    sport: { icon: AthleticsTrackIcon, colorToken: 'post-category-sport' },
    carnival: { icon: CarnavalVenueIcon, colorToken: 'post-category-carnival' },
    nightlife: { icon: LocalDiscoIcon, colorToken: 'post-category-nightlife' },
    history: { icon: HistoricMonumentIcon, colorToken: 'post-category-history' },
    traditions: { icon: CulturalCenterIcon, colorToken: 'post-category-traditions' },
    wellness: { icon: WellnessCenterIcon, colorToken: 'post-category-wellness' },
    family: { icon: FamilySuitableIcon, colorToken: 'post-category-family' },
    tips: { icon: InfoIcon, colorToken: 'post-category-tips' },
    art: { icon: PaletteIcon, colorToken: 'post-category-art' },
    beach: { icon: BeachIcon, colorToken: 'post-category-beach' },
    rural: { icon: RuralAreaIcon, colorToken: 'post-category-rural' },
    festivals: { icon: FestivalPlazaIcon, colorToken: 'post-category-festivals' }
};

/**
 * Fallback visual for categories not present in the canonical map.
 */
export const POST_CATEGORY_FALLBACK_VISUAL: PostCategoryVisual = {
    icon: TagIcon,
    colorToken: 'post-category-general'
};

interface PostCategoryParams {
    /** Post category slug (case-insensitive, e.g. `'CULTURE'` or `'gastronomy'`). */
    readonly category: string;
}

/**
 * Resolve the canonical visual descriptor for a post category.
 */
export function getPostCategoryVisual({ category }: PostCategoryParams): PostCategoryVisual {
    return POST_CATEGORY_VISUALS[category.toLowerCase()] ?? POST_CATEGORY_FALLBACK_VISUAL;
}

/**
 * Resolve the representative icon component for a given post category.
 */
export function getPostCategoryIcon({ category }: PostCategoryParams): ComponentType<IconProps> {
    return getPostCategoryVisual({ category }).icon;
}

/**
 * Visual variants for {@link getPostCategoryColorScheme}.
 * - `subtle` (default): translucent pill (bg 0.15 / text token / border 0.30).
 * - `contrast`: light fill + dark text derived from the SAME hue (admin pill).
 */
export type PostCategoryColorVariant = 'subtle' | 'contrast';

/**
 * Build a {@link PostCategoryColorScheme} for a post category. Both variants
 * consume the centralized per-category token, so the hue stays the single
 * source of truth — only the fill/text treatment differs.
 */
export function getPostCategoryColorScheme({
    category,
    variant = 'subtle'
}: PostCategoryParams & {
    readonly variant?: PostCategoryColorVariant;
}): PostCategoryColorScheme {
    // Per-category tokens map 1:1 to their CSS custom property (no aliasing).
    const cssToken = getPostCategoryVisual({ category }).colorToken;

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
