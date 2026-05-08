/**
 * @file accommodation-type-icons.ts
 * @description Single source of truth that maps each accommodation type
 * (per `AccommodationTypeEnum` in `@repo/schemas`) to a representative icon
 * component from `@repo/icons`. Used by `AccommodationTypeBadge` so every
 * pill ships with a small visual cue beside the label.
 *
 * Unknown types fall back to the generic `AccommodationIcon` (a bed glyph)
 * so the badge still renders something even if the API returns a value the
 * UI hasn't catalogued yet.
 */

import {
    AccommodationIcon,
    BedroomsIcon,
    BellIcon,
    BuildingsIcon,
    CarIcon,
    HomeIcon,
    type IconProps,
    PoolIcon,
    TentIcon,
    TouristRanchIcon,
    TreeIcon,
    UsersIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

const ACCOMMODATION_TYPE_ICONS: Readonly<Record<string, ComponentType<IconProps>>> = {
    apartment: BuildingsIcon,
    house: HomeIcon,
    country_house: TouristRanchIcon,
    cabin: TreeIcon,
    hotel: BellIcon,
    hostel: UsersIcon,
    camping: TentIcon,
    room: BedroomsIcon,
    motel: CarIcon,
    resort: PoolIcon
};

interface GetAccommodationTypeIconParams {
    /** Accommodation type slug (case-insensitive, e.g. `"HOTEL"` or `"country_house"`). */
    readonly type: string;
}

/**
 * Resolve the representative icon component for a given accommodation type.
 *
 * @param params.type - Accommodation type slug. Comparison is case-insensitive.
 * @returns The matching icon component, or `AccommodationIcon` as fallback.
 */
export function getAccommodationTypeIcon({
    type
}: GetAccommodationTypeIconParams): ComponentType<IconProps> {
    const normalized = type.toLowerCase();
    return ACCOMMODATION_TYPE_ICONS[normalized] ?? AccommodationIcon;
}
