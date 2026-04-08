/**
 * @file accommodation-card-icons.ts
 * @description Icon resolver for accommodation card amenity icons.
 * Maps amenity icon names and keys to their corresponding @repo/icons components.
 */

import type { CardAmenityFeature } from '@/data/types';
import {
    AirConditioningIcon,
    BbqGrillIcon,
    BreakfastIcon,
    CarIcon,
    CoffeeIcon,
    KitchenIcon,
    ParkingIcon,
    PoolIcon,
    RestaurantIcon,
    SharedKitchenIcon,
    SpaServicesIcon,
    ThermalPoolsIcon,
    WifiHighIcon,
    WifiIcon
} from '@repo/icons';

/** Icon component type (all share the same signature) */
type IconComponent = typeof WifiIcon;

/** Map from icon identifiers to imported components.
 *  Supports both raw names ("Wifi") and seed-style suffixed names ("WifiIcon"). */
const ICON_NAME_MAP: Readonly<Record<string, IconComponent>> = {
    WifiHigh: WifiHighIcon,
    WifiHighIcon: WifiHighIcon,
    Wifi: WifiIcon,
    WifiIcon: WifiIcon,
    Waves: PoolIcon,
    Pool: PoolIcon,
    PoolIcon: PoolIcon,
    Car: CarIcon,
    CarIcon: CarIcon,
    Parking: ParkingIcon,
    ParkingIcon: ParkingIcon,
    FireSimple: BbqGrillIcon,
    Bbq: BbqGrillIcon,
    BbqGrill: BbqGrillIcon,
    BbqGrillIcon: BbqGrillIcon,
    Coffee: CoffeeIcon,
    CoffeeIcon: CoffeeIcon,
    CoffeeMaker: CoffeeIcon,
    CoffeeMakerIcon: CoffeeIcon,
    Breakfast: BreakfastIcon,
    BreakfastIcon: BreakfastIcon,
    CookingPot: KitchenIcon,
    Kitchen: KitchenIcon,
    KitchenIcon: KitchenIcon,
    SharedKitchen: SharedKitchenIcon,
    SharedKitchenIcon: SharedKitchenIcon,
    Snowflake: AirConditioningIcon,
    AirConditioning: AirConditioningIcon,
    AirConditioningIcon: AirConditioningIcon,
    Heating: AirConditioningIcon,
    HeatingIcon: AirConditioningIcon,
    Sparkle: SpaServicesIcon,
    Spa: SpaServicesIcon,
    SpaServices: SpaServicesIcon,
    SpaServicesIcon: SpaServicesIcon,
    ForkKnife: RestaurantIcon,
    Restaurant: RestaurantIcon,
    RestaurantIcon: RestaurantIcon,
    ThermalPool: ThermalPoolsIcon,
    ThermalPools: ThermalPoolsIcon,
    ThermalPoolsIcon: ThermalPoolsIcon,
    Lightning: WifiHighIcon,
    Shower: PoolIcon,
    Lock: ParkingIcon
};

/** Fallback map from amenity key/slug to icon component. */
const KEY_MAP: Readonly<Record<string, IconComponent>> = {
    wifi: WifiHighIcon,
    pool: PoolIcon,
    parking: ParkingIcon,
    bbq: BbqGrillIcon,
    breakfast: BreakfastIcon,
    coffee: CoffeeIcon,
    kitchen: KitchenIcon,
    'shared-kitchen': SharedKitchenIcon,
    ac: AirConditioningIcon,
    'air-conditioning': AirConditioningIcon,
    spa: SpaServicesIcon,
    restaurant: RestaurantIcon,
    'thermal-pool': ThermalPoolsIcon,
    'beach-access': PoolIcon,
    bathrooms: PoolIcon,
    electricity: WifiHighIcon,
    locker: ParkingIcon
};

/**
 * Resolves the Phosphor icon name stored in amenity data to the corresponding
 * `@repo/icons` component. Unknown names fall back to `WifiIcon`.
 *
 * @param amenity - The amenity item containing the `icon` field.
 * @returns The resolved icon component.
 */
export function resolveAmenityIcon(amenity: CardAmenityFeature): IconComponent {
    return ICON_NAME_MAP[amenity.icon ?? ''] ?? KEY_MAP[amenity.key] ?? WifiIcon;
}
