/**
 * @file icon-map.ts
 * @description Local icon resolver for the web app. Maps icon name strings
 * used by filter configs (amenities, features, section-headers, priority
 * chips) and homepage data files to their actual icon components.
 *
 * WHY THIS EXISTS:
 * Importing the full `@repo/icons/resolver` statically pulls in every one of
 * the ~230+ icon wrappers into any chunk that references it. For client-side
 * React islands (FilterSidebar, IconChipsFilter, SectionHeader, Badge) that
 * causes a ~991KB raw chunk of nothing-but-icons. This module breaks that
 * dependency by importing ONLY the icons actually used by the web app via
 * named tree-shakeable exports from `@repo/icons`.
 *
 * UNIVERSE:
 * The icon universe is fully enumerable from static source files:
 *   - Amenity icons: `packages/seed/src/data/amenity/*.json` `.icon` fields
 *   - Feature icons: `packages/seed/src/data/feature/*.json` `.icon` fields
 *   - Section-header icons: hard-coded strings in `apps/web/src/pages/[lang]/alojamientos/index.astro`
 *   - Priority-chip icons: hard-coded strings in the same page (WifiIcon, PoolIcon, CarIcon, DogIcon)
 *   - Homepage feature icons: `apps/web/src/data/homepage-features.ts`
 *
 * ADDING ICONS: when the seed catalog gains a new `icon` value, add the
 * corresponding named import here and add the entry to WEB_ICON_MAP.
 * Keep this file alphabetised.
 *
 * DO NOT import from `@repo/icons/resolver` — that pulls in every icon.
 */

import type { IconProps } from '@repo/icons';
import {
    // --- Feature icons ---
    AccessibilityFriendlyIcon,
    // --- Entity icons (section headers) ---
    AccommodationIcon,
    AdultsOnlyIcon,
    // --- Amenity icons ---
    AirConditioningIcon,
    AnimalActivitiesIcon,
    AnimalPenIcon,
    BabyMonitorIcon,
    BalconyIcon,
    BarServiceIcon,
    BbqGrillIcon,
    BeachEquipmentIcon,
    BeachUmbrellaIcon,
    BedLinensIcon,
    BicyclesIcon,
    BilingualServiceIcon,
    BlackoutCurtainsIcon,
    BoardGamesIcon,
    BooksAndMagazinesIcon,
    BreakfastIcon,
    // --- System icons (section headers + homepage features) ---
    BuildingIcon,
    CalendarDotsIcon,
    CampingAreaIcon,
    CampingSectorIcon,
    CarIcon,
    CentralAreaIcon,
    CoffeeMakerIcon,
    CompassIcon,
    CouplesFriendlyIcon,
    CoveredGalleryIcon,
    CoveredGrillAreaIcon,
    CoveredParkingIcon,
    CoworkingSpaceIcon,
    DailyCleaningIcon,
    DairyProductionIcon,
    DigitalDetoxIcon,
    DockAccessIcon,
    DogIcon,
    DoubleGlazingIcon,
    EcoConstructionIcon,
    EcologicalIcon,
    ElectricBlanketIcon,
    ElevatorIcon,
    EntirePropertyIcon,
    FamilySuitableIcon,
    FanIcon,
    FireExtinguisherIcon,
    FirePitAreaIcon,
    FireplaceIcon,
    FirstAidKitIcon,
    FishingEquipmentIcon,
    FullBoardIcon,
    GravelAccessIcon,
    GroupFriendlyIcon,
    GymIcon,
    HairDryerIcon,
    HeatedPoolIcon,
    HeatingIcon,
    HighChairIcon,
    InternalParkingIcon,
    InternationalAdaptersIcon,
    IsolatedLocationIcon,
    JacuzziIcon,
    KayakRentalIcon,
    KettleIcon,
    KidsGamesIcon,
    KitchenIcon,
    LGBTQFriendlyIcon,
    LaundryServiceIcon,
    LocalCraftsIcon,
    LuggageStorageIcon,
    MapIcon,
    MicrowaveIcon,
    MiniBarIcon,
    MinimalistStyleIcon,
    MinimumStayIcon,
    ModernStyleIcon,
    MotorhomeParkingIcon,
    NaturalEnvironmentIcon,
    NoCellSignalIcon,
    OrganicGardenIcon,
    OrganizedActivitiesIcon,
    OutdoorFurnitureIcon,
    OutdoorKitchenIcon,
    OutdoorLightingIcon,
    OwnProductionIcon,
    PanoramicViewIcon,
    ParkingIcon,
    PavedAccessIcon,
    PerimeterFenceIcon,
    PerimeterLightingIcon,
    PetAllowedIcon,
    PetAreaIcon,
    PetFriendlyIcon,
    PlasticFreeIcon,
    PlaygroundIcon,
    PoolIcon,
    PostIcon,
    PriceIcon,
    PrivateGardenIcon,
    PrivateGrillIcon,
    PrivateViewpointIcon,
    ProfessionalStaffIcon,
    QuietEnvironmentIcon,
    QuietZoneIcon,
    RainwaterHarvestingIcon,
    Reception24hIcon,
    RefrigeratorIcon,
    RelaxationAreaIcon,
    RenewableEnergyIcon,
    ResidentialAreaIcon,
    RiverFrontIcon,
    RiverViewIcon,
    RoomRentalIcon,
    RoomServiceIcon,
    RoomTvIcon,
    RuralActivitiesIcon,
    RuralAreaIcon,
    RusticStyleIcon,
    SafeIcon,
    SaunaIcon,
    SearchIcon,
    SecureParkingIcon,
    Security24hIcon,
    SelfCheckInIcon,
    SeniorFriendlyIcon,
    SharedKitchenIcon,
    SharedPatioIcon,
    SharedSpaceIcon,
    ShieldIcon,
    ShirtIcon,
    ShoppingServiceIcon,
    SmartHomeIcon,
    SmartTvIcon,
    SmokeDetectorIcon,
    SmokingAreaIcon,
    SoapDispenserIcon,
    SolarShowersIcon,
    SpaFrontIcon,
    SpaServicesIcon,
    SparkleIcon,
    StarIcon,
    StoveIcon,
    TerraceIcon,
    ThemedRoomsIcon,
    TouristInfoIcon,
    TowelsIcon,
    TransferServiceIcon,
    TreeIcon,
    TvIcon,
    UsersIcon,
    UtensilsIcon,
    WalkingTrailIcon,
    WasherIcon,
    WasteRecyclingIcon,
    WaterDispenserIcon,
    WifiIcon,
    WorkshopSpaceIcon,
    YogaMeditationIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/**
 * Map of icon name strings to their React components.
 *
 * Covers all icons reachable from client-side web islands:
 *  - FilterSidebar amenity + feature icon-chips (data-driven, sourced from the
 *    seed catalog in `packages/seed/src/data/{amenity,feature}/`)
 *  - SectionHeader icons (hard-coded in alojamientos/index.astro)
 *  - Priority-chip icons (WifiIcon, PoolIcon, CarIcon, DogIcon)
 *  - Homepage feature icons (BuildingIcon, CalendarDotsIcon, etc.)
 */
const WEB_ICON_MAP: Record<string, ComponentType<IconProps>> = {
    // --- Entity icons ---
    AccommodationIcon,
    // --- System icons ---
    BuildingIcon,
    CalendarDotsIcon,
    CompassIcon,
    MapIcon,
    PostIcon,
    PriceIcon,
    SearchIcon,
    ShieldIcon,
    SparkleIcon,
    StarIcon,
    UsersIcon,
    // --- Amenity icons (alphabetical) ---
    AirConditioningIcon,
    BabyMonitorIcon,
    BalconyIcon,
    BarServiceIcon,
    BbqGrillIcon,
    BeachEquipmentIcon,
    BeachUmbrellaIcon,
    BedLinensIcon,
    BicyclesIcon,
    BlackoutCurtainsIcon,
    BoardGamesIcon,
    BooksAndMagazinesIcon,
    BreakfastIcon,
    CarIcon,
    CoffeeMakerIcon,
    CoveredGrillAreaIcon,
    CoveredParkingIcon,
    CoworkingSpaceIcon,
    DailyCleaningIcon,
    DockAccessIcon,
    DogIcon,
    DoubleGlazingIcon,
    ElectricBlanketIcon,
    ElevatorIcon,
    FanIcon,
    FireExtinguisherIcon,
    FireplaceIcon,
    FirstAidKitIcon,
    FishingEquipmentIcon,
    FullBoardIcon,
    GymIcon,
    HairDryerIcon,
    HeatedPoolIcon,
    HeatingIcon,
    HighChairIcon,
    InternationalAdaptersIcon,
    JacuzziIcon,
    KayakRentalIcon,
    KettleIcon,
    KidsGamesIcon,
    KitchenIcon,
    LaundryServiceIcon,
    LuggageStorageIcon,
    MicrowaveIcon,
    MiniBarIcon,
    MotorhomeParkingIcon,
    OrganicGardenIcon,
    OutdoorFurnitureIcon,
    OutdoorKitchenIcon,
    OutdoorLightingIcon,
    ParkingIcon,
    PetAllowedIcon,
    PlaygroundIcon,
    PoolIcon,
    PrivateGardenIcon,
    PrivateViewpointIcon,
    Reception24hIcon,
    RefrigeratorIcon,
    RelaxationAreaIcon,
    RiverViewIcon,
    RoomServiceIcon,
    RoomTvIcon,
    SafeIcon,
    SaunaIcon,
    SecureParkingIcon,
    SharedKitchenIcon,
    SharedPatioIcon,
    ShirtIcon,
    ShoppingServiceIcon,
    SmartTvIcon,
    SmokeDetectorIcon,
    SoapDispenserIcon,
    SolarShowersIcon,
    SpaServicesIcon,
    StoveIcon,
    TerraceIcon,
    TowelsIcon,
    TransferServiceIcon,
    TvIcon,
    UtensilsIcon,
    WalkingTrailIcon,
    WasherIcon,
    WaterDispenserIcon,
    WifiIcon,
    // --- Feature icons (alphabetical) ---
    AccessibilityFriendlyIcon,
    AdultsOnlyIcon,
    AnimalActivitiesIcon,
    AnimalPenIcon,
    BilingualServiceIcon,
    CampingAreaIcon,
    CampingSectorIcon,
    CentralAreaIcon,
    CouplesFriendlyIcon,
    CoveredGalleryIcon,
    DairyProductionIcon,
    DigitalDetoxIcon,
    EcoConstructionIcon,
    EcologicalIcon,
    EntirePropertyIcon,
    FamilySuitableIcon,
    FirePitAreaIcon,
    GravelAccessIcon,
    GroupFriendlyIcon,
    InternalParkingIcon,
    IsolatedLocationIcon,
    LGBTQFriendlyIcon,
    LocalCraftsIcon,
    MinimalistStyleIcon,
    MinimumStayIcon,
    ModernStyleIcon,
    NaturalEnvironmentIcon,
    NoCellSignalIcon,
    OrganizedActivitiesIcon,
    OwnProductionIcon,
    PanoramicViewIcon,
    PavedAccessIcon,
    PerimeterFenceIcon,
    PerimeterLightingIcon,
    PetAreaIcon,
    PetFriendlyIcon,
    PlasticFreeIcon,
    PrivateGrillIcon,
    ProfessionalStaffIcon,
    QuietEnvironmentIcon,
    QuietZoneIcon,
    RainwaterHarvestingIcon,
    RenewableEnergyIcon,
    ResidentialAreaIcon,
    RiverFrontIcon,
    RoomRentalIcon,
    RuralActivitiesIcon,
    RuralAreaIcon,
    RusticStyleIcon,
    Security24hIcon,
    SelfCheckInIcon,
    SeniorFriendlyIcon,
    SharedSpaceIcon,
    SmartHomeIcon,
    SmokingAreaIcon,
    SpaFrontIcon,
    ThemedRoomsIcon,
    TouristInfoIcon,
    TreeIcon,
    WasteRecyclingIcon,
    WorkshopSpaceIcon,
    YogaMeditationIcon
};

/**
 * Resolve an icon name string to its React component.
 * Returns undefined if the icon name is not in the local web map.
 *
 * Use this instead of `resolveIcon` from `@repo/icons/resolver` in any
 * code path that reaches client-side islands — the full resolver imports
 * all 230+ icons and defeats tree-shaking.
 *
 * @example
 * ```ts
 * const Icon = resolveWebIcon({ iconName: 'WifiIcon' });
 * if (Icon) return <Icon size={24} />;
 * ```
 */
export function resolveWebIcon({
    iconName
}: {
    readonly iconName: string;
}): ComponentType<IconProps> | undefined {
    return WEB_ICON_MAP[iconName];
}
