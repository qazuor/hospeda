/**
 * @file domain/attraction-icon.ts
 * @description Single source of truth for the attraction `icon` slug → Phosphor
 * icon component mapping. The seed catalog stores Material Symbols slugs (e.g.
 * `"nature_reserve"`, `"hiking"`, `"directions_boat"`) on `attractions.icon`;
 * this module resolves them to the corresponding `@repo/icons` component so
 * `apps/web` and `apps/admin` render the SAME icon for a given attraction.
 *
 * Anything not in the table — typos, new entries, future additions — falls back
 * to `MapIcon` so a chip still renders an icon instead of a blank gap.
 *
 * Icon components are imported via direct relative paths (not the package
 * index) to avoid a circular import: the index re-exports this module.
 */

import type { ComponentType } from 'react';
import { BeachUmbrellaIcon } from '../icons/amenities/BeachUmbrellaIcon';
import { BicyclesIcon } from '../icons/amenities/BicyclesIcon';
import { BoardGamesIcon } from '../icons/amenities/BoardGamesIcon';
import { CoffeeIcon } from '../icons/amenities/CoffeeIcon';
import { FireIcon } from '../icons/amenities/FireIcon';
import { FishingEquipmentIcon } from '../icons/amenities/FishingEquipmentIcon';
import { GymIcon } from '../icons/amenities/GymIcon';
import { KayakRentalIcon } from '../icons/amenities/KayakRentalIcon';
import { KidsGamesIcon } from '../icons/amenities/KidsGamesIcon';
import { OrganicGardenIcon } from '../icons/amenities/OrganicGardenIcon';
import { PetAllowedIcon } from '../icons/amenities/PetAllowedIcon';
import { PoolIcon } from '../icons/amenities/PoolIcon';
import { WalkingTrailIcon } from '../icons/amenities/WalkingTrailIcon';
import { WaterDispenserIcon } from '../icons/amenities/WaterDispenserIcon';
import { AgriculturalCenterIcon } from '../icons/attractions/AgriculturalCenterIcon';
import { AmphitheaterIcon } from '../icons/attractions/AmphitheaterIcon';
import { ArchaeologicalSiteIcon } from '../icons/attractions/ArchaeologicalSiteIcon';
import { BeachIcon } from '../icons/attractions/BeachIcon';
import { BirdIcon } from '../icons/attractions/BirdIcon';
import { BirdWatchingIcon } from '../icons/attractions/BirdWatchingIcon';
import { BridgeIcon } from '../icons/attractions/BridgeIcon';
import { CasinoIcon } from '../icons/attractions/CasinoIcon';
import { CastleTurretIcon } from '../icons/attractions/CastleTurretIcon';
import { CathedralIcon } from '../icons/attractions/CathedralIcon';
import { ChildrensPlaygroundIcon } from '../icons/attractions/ChildrensPlaygroundIcon';
import { ColonialChurchIcon } from '../icons/attractions/ColonialChurchIcon';
import { EducationalFarmIcon } from '../icons/attractions/EducationalFarmIcon';
import { FestivalPlazaIcon } from '../icons/attractions/FestivalPlazaIcon';
import { GastronomicMarketIcon } from '../icons/attractions/GastronomicMarketIcon';
import { GovernmentBuildingIcon } from '../icons/attractions/GovernmentBuildingIcon';
import { HistoricMonumentIcon } from '../icons/attractions/HistoricMonumentIcon';
import { HistoricMuseumIcon } from '../icons/attractions/HistoricMuseumIcon';
import { LocalDiscoIcon } from '../icons/attractions/LocalDiscoIcon';
import { MunicipalCinemaIcon } from '../icons/attractions/MunicipalCinemaIcon';
import { MunicipalParkIcon } from '../icons/attractions/MunicipalParkIcon';
import { MunicipalStadiumIcon } from '../icons/attractions/MunicipalStadiumIcon';
import { MuseumIcon } from '../icons/attractions/MuseumIcon';
import { NatureReserveIcon } from '../icons/attractions/NatureReserveIcon';
import { ParkIcon } from '../icons/attractions/ParkIcon';
import { RecreationalBoatingIcon } from '../icons/attractions/RecreationalBoatingIcon';
import { RestaurantIcon } from '../icons/attractions/RestaurantIcon';
import { RiverBeachIcon } from '../icons/attractions/RiverBeachIcon';
import { ShoppingCenterIcon } from '../icons/attractions/ShoppingCenterIcon';
import { SoccerFieldIcon } from '../icons/attractions/SoccerFieldIcon';
import { SportFishingIcon } from '../icons/attractions/SportFishingIcon';
import { SportsCenterIcon } from '../icons/attractions/SportsCenterIcon';
import { ThermalSpaIcon } from '../icons/attractions/ThermalSpaIcon';
import { TraditionalBakeryIcon } from '../icons/attractions/TraditionalBakeryIcon';
import { TraditionalPubIcon } from '../icons/attractions/TraditionalPubIcon';
import { EventLocationIcon } from '../icons/entities/EventLocationIcon';
import { CampingAreaIcon } from '../icons/features/CampingAreaIcon';
import { EcologicalIcon } from '../icons/features/EcologicalIcon';
import { FamilySuitableIcon } from '../icons/features/FamilySuitableIcon';
import { SelfCheckInIcon } from '../icons/features/SelfCheckInIcon';
import { AudioIcon } from '../icons/system/AudioIcon';
import { BuildingIcon } from '../icons/system/BuildingIcon';
import { BuildingsIcon } from '../icons/system/BuildingsIcon';
import { CompassIcon } from '../icons/system/CompassIcon';
import { GalleryIcon } from '../icons/system/GalleryIcon';
import { HomeIcon } from '../icons/system/HomeIcon';
import { MapIcon } from '../icons/system/MapIcon';
import { PaletteIcon } from '../icons/system/PaletteIcon';
import { ShieldIcon } from '../icons/system/ShieldIcon';
import { ShoppingCartIcon } from '../icons/system/ShoppingCartIcon';
import { UsersIcon } from '../icons/system/UsersIcon';
import type { IconProps } from '../types';

/**
 * Material Symbols slug → Phosphor icon component lookup table.
 *
 * Keys mirror the strings emitted by `packages/seed/src/data/attraction/*.json`
 * exactly (lowercase).
 */
const ATTRACTION_ICONS: Readonly<Record<string, ComponentType<IconProps>>> = {
    account_balance: GovernmentBuildingIcon,
    agriculture: AgriculturalCenterIcon,
    anchor: RecreationalBoatingIcon,
    archaeology: ArchaeologicalSiteIcon,
    bakery_dining: TraditionalBakeryIcon,
    beach_access: BeachUmbrellaIcon,
    cake: TraditionalBakeryIcon,
    casino: CasinoIcon,
    castle: CastleTurretIcon,
    celebration: FestivalPlazaIcon,
    cheese: RestaurantIcon,
    church: ColonialChurchIcon,
    cottage: HomeIcon,
    directions_boat: RecreationalBoatingIcon,
    directions_boat_filled: RecreationalBoatingIcon,
    directions_run: WalkingTrailIcon,
    directions_walk: WalkingTrailIcon,
    eco: EcologicalIcon,
    event: EventLocationIcon,
    explore: CompassIcon,
    factory: BuildingIcon,
    family_restroom: FamilySuitableIcon,
    festival: FestivalPlazaIcon,
    fishing: FishingEquipmentIcon,
    fitness_center: GymIcon,
    flutter_dash: BirdWatchingIcon,
    gavel: ShieldIcon,
    handyman: BuildingIcon,
    hiking: WalkingTrailIcon,
    home: HomeIcon,
    hot_tub: ThermalSpaIcon,
    kayaking: KayakRentalIcon,
    local_florist: OrganicGardenIcon,
    location_city: BuildingsIcon,
    marina: RecreationalBoatingIcon,
    monument: HistoricMonumentIcon,
    movie: MunicipalCinemaIcon,
    museum: MuseumIcon,
    music_note: AudioIcon,
    nature_people: ParkIcon,
    nature_reserve: NatureReserveIcon,
    nightlife: LocalDiscoIcon,
    palette: PaletteIcon,
    park: MunicipalParkIcon,
    pets: PetAllowedIcon,
    phishing: SportFishingIcon,
    playground: ChildrensPlaygroundIcon,
    pool: PoolIcon,
    restaurant: RestaurantIcon,
    sailing: RecreationalBoatingIcon,
    school: EducationalFarmIcon,
    self_care: SelfCheckInIcon,
    shield: ShieldIcon,
    shopping_mall: ShoppingCenterIcon,
    spa: ThermalSpaIcon,
    sports: SportsCenterIcon,
    sports_bar: TraditionalPubIcon,
    sports_esports: BoardGamesIcon,
    sports_soccer: SoccerFieldIcon,
    stadium: MunicipalStadiumIcon,
    store: ShoppingCartIcon,
    storefront: GastronomicMarketIcon,
    temple_buddhist: CathedralIcon,
    theater_comedy: AmphitheaterIcon,
    tour: CompassIcon,
    toys: KidsGamesIcon,
    water: WaterDispenserIcon,
    water_body: RiverBeachIcon,
    water_slide: PoolIcon,
    // Aliases that occasionally surface from older/free-typed data.
    beach: BeachIcon,
    bicycle: BicyclesIcon,
    bird: BirdIcon,
    birds: BirdIcon,
    bridge: BridgeIcon,
    camping: CampingAreaIcon,
    cinema: MunicipalCinemaIcon,
    coffee: CoffeeIcon,
    farm: EducationalFarmIcon,
    fire: FireIcon,
    gallery: GalleryIcon,
    history: HistoricMuseumIcon,
    kids: KidsGamesIcon,
    users: UsersIcon
};

/**
 * Resolve the Phosphor icon component for a given attraction icon slug.
 *
 * @param params.icon - Attraction icon slug (Material Symbols). Case-insensitive.
 * @returns The matching icon component, or `MapIcon` as fallback.
 */
export function getAttractionIcon({
    icon
}: { readonly icon?: string | null }): ComponentType<IconProps> {
    if (!icon) return MapIcon;
    return ATTRACTION_ICONS[icon.toLowerCase()] ?? MapIcon;
}
