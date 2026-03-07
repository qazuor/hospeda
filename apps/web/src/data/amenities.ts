/**
 * @file amenities.ts
 * @description Static data for amenity filter chips in the AccommodationsSection.
 */
import {
    CarIcon,
    CoffeeIcon,
    DogIcon,
    FireIcon,
    PoolIcon,
    SparkleIcon,
    WifiHighIcon
} from '@repo/icons';
import type { Amenity } from './types';

/** Amenity filter chips displayed in the accommodations section */
export const AMENITIES: readonly Amenity[] = [
    { id: 'wifi', name: 'Wi-Fi', icon: WifiHighIcon, filter: 'amenity=wifi' },
    {
        id: 'estacionamiento',
        name: 'Estacionamiento',
        icon: CarIcon,
        filter: 'amenity=estacionamiento'
    },
    { id: 'pileta', name: 'Pileta', icon: PoolIcon, filter: 'amenity=pileta' },
    { id: 'mascotas', name: 'Pet Friendly', icon: DogIcon, filter: 'amenity=mascotas' },
    { id: 'spa', name: 'Spa', icon: SparkleIcon, filter: 'amenity=spa' },
    { id: 'desayuno', name: 'Desayuno', icon: CoffeeIcon, filter: 'amenity=desayuno' },
    { id: 'parrilla', name: 'Parrilla', icon: FireIcon, filter: 'amenity=parrilla' }
] as const;
