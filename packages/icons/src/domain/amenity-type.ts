/**
 * @file domain/amenity-type.ts
 * @description Single source of truth for the amenity-type → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * amenity type renders with the SAME icon and the SAME color in both surfaces.
 *
 * Keys are uppercase enum values (matching `AmenitiesTypeEnum`).
 * Unknown types fall back to `WrenchIcon` + the `amenity-type-general-appliances` token.
 */

import type { ComponentType } from 'react';
import { WifiIcon } from '../icons/amenities/WifiIcon';
import { TreeIcon } from '../icons/features/TreeIcon';
import { BedIcon } from '../icons/system/BedIcon';
import { BellIcon } from '../icons/system/BellIcon';
import { BriefcaseIcon } from '../icons/system/BriefcaseIcon';
import { ForkKnifeIcon } from '../icons/system/ForkKnifeIcon';
import { ShieldIcon } from '../icons/system/ShieldIcon';
import { TelevisionIcon } from '../icons/system/TelevisionIcon';
import { ThermometerIcon } from '../icons/system/ThermometerIcon';
import { UsersThreeIcon } from '../icons/system/UsersThreeIcon';
import { WheelchairIcon } from '../icons/system/WheelchairIcon';
import { WrenchIcon } from '../icons/system/WrenchIcon';
import type { IconProps } from '../types';

export interface AmenityTypeColorScheme {
    readonly bg: string;
    readonly text: string;
    readonly border: string;
}

export interface AmenityTypeVisual {
    readonly icon: ComponentType<IconProps>;
    /** Per-type design-token name (e.g. `'amenity-type-kitchen'`). */
    readonly colorToken: string;
}

/**
 * Canonical amenity-type → visual map. Keys are uppercase enum values.
 */
export const AMENITY_TYPE_VISUALS: Readonly<Record<string, AmenityTypeVisual>> = {
    CLIMATE_CONTROL: { icon: ThermometerIcon, colorToken: 'amenity-type-climate-control' },
    CONNECTIVITY: { icon: WifiIcon, colorToken: 'amenity-type-connectivity' },
    ENTERTAINMENT: { icon: TelevisionIcon, colorToken: 'amenity-type-entertainment' },
    KITCHEN: { icon: ForkKnifeIcon, colorToken: 'amenity-type-kitchen' },
    BED_AND_BATH: { icon: BedIcon, colorToken: 'amenity-type-bed-and-bath' },
    OUTDOORS: { icon: TreeIcon, colorToken: 'amenity-type-outdoors' },
    ACCESSIBILITY: { icon: WheelchairIcon, colorToken: 'amenity-type-accessibility' },
    SERVICES: { icon: BellIcon, colorToken: 'amenity-type-services' },
    SAFETY: { icon: ShieldIcon, colorToken: 'amenity-type-safety' },
    FAMILY_FRIENDLY: { icon: UsersThreeIcon, colorToken: 'amenity-type-family-friendly' },
    WORK_FRIENDLY: { icon: BriefcaseIcon, colorToken: 'amenity-type-work-friendly' },
    GENERAL_APPLIANCES: { icon: WrenchIcon, colorToken: 'amenity-type-general-appliances' }
};

export const AMENITY_TYPE_FALLBACK_VISUAL: AmenityTypeVisual = {
    icon: WrenchIcon,
    colorToken: 'amenity-type-general-appliances'
};

interface AmenityTypeParams {
    /** Type slug (case-insensitive, e.g. `'KITCHEN'` or `'bed_and_bath'`). */
    readonly type: string;
}

export function getAmenityTypeVisual({ type }: AmenityTypeParams): AmenityTypeVisual {
    return AMENITY_TYPE_VISUALS[type.toUpperCase()] ?? AMENITY_TYPE_FALLBACK_VISUAL;
}

export function getAmenityTypeIcon({ type }: AmenityTypeParams): ComponentType<IconProps> {
    return getAmenityTypeVisual({ type }).icon;
}

export type AmenityTypeColorVariant = 'subtle' | 'contrast';

export function getAmenityTypeColorScheme({
    type,
    variant = 'subtle'
}: AmenityTypeParams & {
    readonly variant?: AmenityTypeColorVariant;
}): AmenityTypeColorScheme {
    const cssToken = getAmenityTypeVisual({ type }).colorToken;

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
