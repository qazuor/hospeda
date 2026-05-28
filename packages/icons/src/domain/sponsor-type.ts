/**
 * @file domain/sponsor-type.ts
 * @description Single source of truth for the sponsor-type → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * sponsor type renders with the SAME icon and the SAME color in both surfaces.
 *
 * Keys are uppercase `ClientTypeEnum` values used for sponsor classification.
 * Unknown types fall back to `MegaphoneIcon` + the `sponsor-type-post-sponsor` token.
 */

import type { ComponentType } from 'react';
import { BuildingIcon } from '../icons/system/BuildingIcon';
import { MegaphoneIcon } from '../icons/system/MegaphoneIcon';
import { StarIcon } from '../icons/system/StarIcon';
import type { IconProps } from '../types';

export interface SponsorTypeColorScheme {
    readonly bg: string;
    readonly text: string;
    readonly border: string;
}

export interface SponsorTypeVisual {
    readonly icon: ComponentType<IconProps>;
    /** Per-type design-token name (e.g. `'sponsor-type-host'`). */
    readonly colorToken: string;
}

/**
 * Canonical sponsor-type → visual map. Keys match the uppercase
 * `ClientTypeEnum` values used for sponsor classification.
 */
export const SPONSOR_TYPE_VISUALS: Readonly<Record<string, SponsorTypeVisual>> = {
    POST_SPONSOR: { icon: MegaphoneIcon, colorToken: 'sponsor-type-post-sponsor' },
    ADVERTISER: { icon: StarIcon, colorToken: 'sponsor-type-advertiser' },
    HOST: { icon: BuildingIcon, colorToken: 'sponsor-type-host' }
};

export const SPONSOR_TYPE_FALLBACK_VISUAL: SponsorTypeVisual = {
    icon: MegaphoneIcon,
    colorToken: 'sponsor-type-post-sponsor'
};

interface SponsorTypeParams {
    /** Type slug (case-insensitive, e.g. `'POST_SPONSOR'` or `'host'`). */
    readonly type: string;
}

export function getSponsorTypeVisual({ type }: SponsorTypeParams): SponsorTypeVisual {
    return SPONSOR_TYPE_VISUALS[type.toUpperCase()] ?? SPONSOR_TYPE_FALLBACK_VISUAL;
}

export function getSponsorTypeIcon({ type }: SponsorTypeParams): ComponentType<IconProps> {
    return getSponsorTypeVisual({ type }).icon;
}

export type SponsorTypeColorVariant = 'subtle' | 'contrast';

export function getSponsorTypeColorScheme({
    type,
    variant = 'subtle'
}: SponsorTypeParams & {
    readonly variant?: SponsorTypeColorVariant;
}): SponsorTypeColorScheme {
    const cssToken = getSponsorTypeVisual({ type }).colorToken;

    if (variant === 'contrast') {
        return {
            bg: `oklch(from var(--${cssToken}) 0.95 calc(c * 0.55) h)`,
            text: `oklch(from var(--${cssToken}) 0.4 c h)`,
            border: `oklch(from var(--${cssToken}) 0.88 calc(c * 0.55) h)`
        };
    }

    return {
        bg: `oklch(from var(--${cssToken}) l c h / 0.15)`,
        text: `var(--${cssToken})`,
        border: `oklch(from var(--${cssToken}) l c h / 0.3)`
    };
}
