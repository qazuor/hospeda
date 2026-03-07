/**
 * @file accommodation-types.ts
 * @description Static data for accommodation type filter chips and search form options.
 * Provides two exports: ACCOMMODATION_TYPES for icon-based filter pills,
 * and ACCOMMODATION_TYPE_NAMES for plain-text select dropdowns.
 */
import {
    BuildingIcon,
    BuildingsIcon,
    CastleTurretIcon,
    HomeIcon,
    TentIcon,
    TreeIcon
} from '@repo/icons';
import type { AccommodationType } from './types';

/** Accommodation type filter chips with icons for the AccommodationsSection filter zone */
export const ACCOMMODATION_TYPES: readonly AccommodationType[] = [
    { id: 'hotel', name: 'Hoteles', icon: BuildingIcon, filter: 'tipo=hotel' },
    { id: 'cabana', name: 'Cabanas', icon: HomeIcon, filter: 'tipo=cabana' },
    { id: 'apart', name: 'Apart Hotels', icon: BuildingsIcon, filter: 'tipo=apart' },
    { id: 'glamping', name: 'Glamping', icon: TentIcon, filter: 'tipo=glamping' },
    { id: 'resort', name: 'Resorts', icon: CastleTurretIcon, filter: 'tipo=resort' },
    { id: 'lodge', name: 'Lodges', icon: TreeIcon, filter: 'tipo=lodge' }
] as const;

/** Flat list of accommodation type names for search form selects */
export const ACCOMMODATION_TYPE_NAMES: readonly string[] = [
    'Hotel',
    'Cabana',
    'Apart Hotel',
    'Hostel',
    'Camping',
    'Casa de Campo',
    'Glamping',
    'Bungalow'
] as const;
