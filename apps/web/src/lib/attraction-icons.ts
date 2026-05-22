/**
 * @file attraction-icons.ts
 * @description Maps the Material Symbols slug stored on `attractions.icon`
 * (e.g. `"directions_walk"`, `"kayaking"`, `"flutter_dash"`) to a Phosphor
 * icon component exported by `@repo/icons`. Used by the destinations
 * listing filter row and any other surface that wants to put a visual cue
 * next to an attraction label.
 *
 * The seed catalog (`packages/seed/src/data/attraction/*.json`) ships ~70
 * unique slugs. Anything not in the table — typos, new entries, future
 * additions — falls back to `MapIcon` so the chip still renders an icon
 * instead of a blank gap.
 */

import {
    AgriculturalCenterIcon,
    AmphitheaterIcon,
    ArchaeologicalSiteIcon,
    AudioIcon,
    BeachIcon,
    BeachUmbrellaIcon,
    BicyclesIcon,
    BirdIcon,
    BirdWatchingIcon,
    BoardGamesIcon,
    BridgeIcon,
    BuildingIcon,
    BuildingsIcon,
    CampingAreaIcon,
    CasinoIcon,
    CastleTurretIcon,
    CathedralIcon,
    ChildrensPlaygroundIcon,
    CoffeeIcon,
    ColonialChurchIcon,
    CompassIcon,
    EcologicalIcon,
    EducationalFarmIcon,
    EventLocationIcon,
    FamilySuitableIcon,
    FestivalPlazaIcon,
    FireIcon,
    FishingEquipmentIcon,
    GalleryIcon,
    GastronomicMarketIcon,
    GovernmentBuildingIcon,
    GymIcon,
    HistoricMonumentIcon,
    HistoricMuseumIcon,
    HomeIcon,
    type IconProps,
    KayakRentalIcon,
    KidsGamesIcon,
    LocalDiscoIcon,
    MapIcon,
    MunicipalCinemaIcon,
    MunicipalParkIcon,
    MunicipalStadiumIcon,
    MuseumIcon,
    NatureReserveIcon,
    OrganicGardenIcon,
    PaletteIcon,
    ParkIcon,
    PetAllowedIcon,
    PoolIcon,
    RecreationalBoatingIcon,
    RestaurantIcon,
    RiverBeachIcon,
    SelfCheckInIcon,
    ShieldIcon,
    ShoppingCartIcon,
    ShoppingCenterIcon,
    SoccerFieldIcon,
    SportFishingIcon,
    SportsCenterIcon,
    ThermalSpaIcon,
    TraditionalBakeryIcon,
    TraditionalPubIcon,
    UsersIcon,
    WalkingTrailIcon,
    WaterDispenserIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/**
 * Material Symbols slug → Phosphor icon component lookup table.
 *
 * Keys mirror the strings emitted by `packages/seed/src/data/attraction/*.json`
 * exactly. Values are React components rendered by `@astrojs/react` during
 * SSR — no client hydration is involved when consumed from an `.astro` file.
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

interface GetAttractionIconParams {
    /** Material Symbols slug as stored on the attraction (case-insensitive). */
    readonly icon?: string | null;
}

/**
 * Resolve the Phosphor icon component for a given attraction icon slug.
 *
 * @param params.icon - Attraction icon slug. Comparison is case-insensitive.
 * @returns The matching icon component, or `MapIcon` as fallback.
 */
export function getAttractionIcon({ icon }: GetAttractionIconParams): ComponentType<IconProps> {
    if (!icon) return MapIcon;
    return ATTRACTION_ICONS[icon.toLowerCase()] ?? MapIcon;
}
