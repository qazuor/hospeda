/**
 * Icon resolver utility.
 * Maps icon name strings (stored in DB) to actual icon components.
 * Single source of truth for string -> component resolution.
 *
 * Covers icons stored as strings in the database: amenities, features,
 * attractions, entities, booking states, social links, and communication.
 * Admin/system/action icons are imported statically and excluded here.
 */
import type { IconProps } from './types';

// Amenity icons
import { AirConditioningIcon } from './icons/amenities/AirConditioningIcon';
import { BabyMonitorIcon } from './icons/amenities/BabyMonitorIcon';
import { BalconyIcon } from './icons/amenities/BalconyIcon';
import { BarServiceIcon } from './icons/amenities/BarServiceIcon';
import { BbqGrillIcon } from './icons/amenities/BbqGrillIcon';
import { BeachEquipmentIcon } from './icons/amenities/BeachEquipmentIcon';
import { BeachUmbrellaIcon } from './icons/amenities/BeachUmbrellaIcon';
import { BedLinensIcon } from './icons/amenities/BedLinensIcon';
import { BicyclesIcon } from './icons/amenities/BicyclesIcon';
import { BlackoutCurtainsIcon } from './icons/amenities/BlackoutCurtainsIcon';
import { BoardGamesIcon } from './icons/amenities/BoardGamesIcon';
import { BooksAndMagazinesIcon } from './icons/amenities/BooksAndMagazinesIcon';
import { BreakfastIcon } from './icons/amenities/BreakfastIcon';
import { CoffeeMakerIcon } from './icons/amenities/CoffeeMakerIcon';
import { CoveredGrillAreaIcon } from './icons/amenities/CoveredGrillAreaIcon';
import { CoveredParkingIcon } from './icons/amenities/CoveredParkingIcon';
import { CoworkingSpaceIcon } from './icons/amenities/CoworkingSpaceIcon';
import { DailyCleaningIcon } from './icons/amenities/DailyCleaningIcon';
import { DockAccessIcon } from './icons/amenities/DockAccessIcon';
import { ElectricBlanketIcon } from './icons/amenities/ElectricBlanketIcon';
import { ElevatorIcon } from './icons/amenities/ElevatorIcon';
import { FanIcon } from './icons/amenities/FanIcon';
import { FireExtinguisherIcon } from './icons/amenities/FireExtinguisherIcon';
import { FireplaceIcon } from './icons/amenities/FireplaceIcon';
import { FirstAidKitIcon } from './icons/amenities/FirstAidKitIcon';
import { FishingEquipmentIcon } from './icons/amenities/FishingEquipmentIcon';
import { FullBoardIcon } from './icons/amenities/FullBoardIcon';
import { GymIcon } from './icons/amenities/GymIcon';
import { HairDryerIcon } from './icons/amenities/HairDryerIcon';
import { HeatedPoolIcon } from './icons/amenities/HeatedPoolIcon';
import { HeatingIcon } from './icons/amenities/HeatingIcon';
import { HighChairIcon } from './icons/amenities/HighChairIcon';
import { InternationalAdaptersIcon } from './icons/amenities/InternationalAdaptersIcon';
import { JacuzziIcon } from './icons/amenities/JacuzziIcon';
import { KayakRentalIcon } from './icons/amenities/KayakRentalIcon';
import { KettleIcon } from './icons/amenities/KettleIcon';
import { KidsGamesIcon } from './icons/amenities/KidsGamesIcon';
import { KitchenIcon } from './icons/amenities/KitchenIcon';
import { LaundryServiceIcon } from './icons/amenities/LaundryServiceIcon';
import { LuggageStorageIcon } from './icons/amenities/LuggageStorageIcon';
import { MicrowaveIcon } from './icons/amenities/MicrowaveIcon';
import { MiniBarIcon } from './icons/amenities/MiniBarIcon';
import { MotorhomeParkingIcon } from './icons/amenities/MotorhomeParkingIcon';
import { OrganicGardenIcon } from './icons/amenities/OrganicGardenIcon';
import { OutdoorFurnitureIcon } from './icons/amenities/OutdoorFurnitureIcon';
import { OutdoorKitchenIcon } from './icons/amenities/OutdoorKitchenIcon';
import { OutdoorLightingIcon } from './icons/amenities/OutdoorLightingIcon';
import { ParkingIcon } from './icons/amenities/ParkingIcon';
import { PetAllowedIcon } from './icons/amenities/PetAllowedIcon';
import { PlaygroundIcon } from './icons/amenities/PlaygroundIcon';
import { PoolIcon } from './icons/amenities/PoolIcon';
import { PrivateGardenIcon } from './icons/amenities/PrivateGardenIcon';
import { PrivateViewpointIcon } from './icons/amenities/PrivateViewpointIcon';
import { Reception24hIcon } from './icons/amenities/Reception24hIcon';
import { RefrigeratorIcon } from './icons/amenities/RefrigeratorIcon';
import { RelaxationAreaIcon } from './icons/amenities/RelaxationAreaIcon';
import { RiverViewIcon } from './icons/amenities/RiverViewIcon';
import { RoomServiceIcon } from './icons/amenities/RoomServiceIcon';
import { RoomTvIcon } from './icons/amenities/RoomTvIcon';
import { SafeIcon } from './icons/amenities/SafeIcon';
import { SaunaIcon } from './icons/amenities/SaunaIcon';
import { SecureParkingIcon } from './icons/amenities/SecureParkingIcon';
import { SharedKitchenIcon } from './icons/amenities/SharedKitchenIcon';
import { SharedPatioIcon } from './icons/amenities/SharedPatioIcon';
import { SmartTvIcon } from './icons/amenities/SmartTvIcon';
import { SmokeDetectorIcon } from './icons/amenities/SmokeDetectorIcon';
import { SoapDispenserIcon } from './icons/amenities/SoapDispenserIcon';
import { SolarShowersIcon } from './icons/amenities/SolarShowersIcon';
import { SpaServicesIcon } from './icons/amenities/SpaServicesIcon';
import { StoveIcon } from './icons/amenities/StoveIcon';
import { TerraceIcon } from './icons/amenities/TerraceIcon';
import { TowelsIcon } from './icons/amenities/TowelsIcon';
import { TransferServiceIcon } from './icons/amenities/TransferServiceIcon';
import { TvIcon } from './icons/amenities/TvIcon';
import { UtensilsIcon } from './icons/amenities/UtensilsIcon';
import { WalkingTrailIcon } from './icons/amenities/WalkingTrailIcon';
import { WasherIcon } from './icons/amenities/WasherIcon';
import { WaterDispenserIcon } from './icons/amenities/WaterDispenserIcon';
import { WifiIcon } from './icons/amenities/WifiIcon';
import { WorkshopSpaceIcon } from './icons/amenities/WorkshopSpaceIcon';
import { YogaMeditationIcon } from './icons/amenities/YogaMeditationIcon';

// Feature icons
import { AccessibilityFriendlyIcon } from './icons/features/AccessibilityFriendlyIcon';
import { AdultsOnlyIcon } from './icons/features/AdultsOnlyIcon';
import { AnimalActivitiesIcon } from './icons/features/AnimalActivitiesIcon';
import { AnimalPenIcon } from './icons/features/AnimalPenIcon';
import { BilingualServiceIcon } from './icons/features/BilingualServiceIcon';
import { CampingAreaIcon } from './icons/features/CampingAreaIcon';
import { CampingSectorIcon } from './icons/features/CampingSectorIcon';
import { CentralAreaIcon } from './icons/features/CentralAreaIcon';
import { CouplesFriendlyIcon } from './icons/features/CouplesFriendlyIcon';
import { CoveredGalleryIcon } from './icons/features/CoveredGalleryIcon';
import { DigitalDetoxIcon } from './icons/features/DigitalDetoxIcon';
import { EcologicalIcon } from './icons/features/EcologicalIcon';
import { EntirePropertyIcon } from './icons/features/EntirePropertyIcon';
import { FamilySuitableIcon } from './icons/features/FamilySuitableIcon';
import { FirePitAreaIcon } from './icons/features/FirePitAreaIcon';
import { GravelAccessIcon } from './icons/features/GravelAccessIcon';
import { GroupFriendlyIcon } from './icons/features/GroupFriendlyIcon';
import { InternalParkingIcon } from './icons/features/InternalParkingIcon';
import { IsolatedLocationIcon } from './icons/features/IsolatedLocationIcon';
import { LGBTQFriendlyIcon } from './icons/features/LGBTQFriendlyIcon';
import { LocalCraftsIcon } from './icons/features/LocalCraftsIcon';
import { MinimalistStyleIcon } from './icons/features/MinimalistStyleIcon';
import { MinimumStayIcon } from './icons/features/MinimumStayIcon';
import { ModernStyleIcon } from './icons/features/ModernStyleIcon';
import { NaturalEnvironmentIcon } from './icons/features/NaturalEnvironmentIcon';
import { OrganizedActivitiesIcon } from './icons/features/OrganizedActivitiesIcon';
import { OwnProductionIcon } from './icons/features/OwnProductionIcon';
import { PanoramicViewIcon } from './icons/features/PanoramicViewIcon';
import { PavedAccessIcon } from './icons/features/PavedAccessIcon';
import { PerimeterFenceIcon } from './icons/features/PerimeterFenceIcon';
import { PerimeterLightingIcon } from './icons/features/PerimeterLightingIcon';
import { PetAreaIcon } from './icons/features/PetAreaIcon';
import { PetFriendlyIcon } from './icons/features/PetFriendlyIcon';
import { PrivateGrillIcon } from './icons/features/PrivateGrillIcon';
import { ProfessionalStaffIcon } from './icons/features/ProfessionalStaffIcon';
import { QuietEnvironmentIcon } from './icons/features/QuietEnvironmentIcon';
import { QuietZoneIcon } from './icons/features/QuietZoneIcon';
import { RenewableEnergyIcon } from './icons/features/RenewableEnergyIcon';
import { ResidentialAreaIcon } from './icons/features/ResidentialAreaIcon';
import { RiverFrontIcon } from './icons/features/RiverFrontIcon';
import { RoomRentalIcon } from './icons/features/RoomRentalIcon';
import { RuralActivitiesIcon } from './icons/features/RuralActivitiesIcon';
import { RuralAreaIcon } from './icons/features/RuralAreaIcon';
import { RusticStyleIcon } from './icons/features/RusticStyleIcon';
import { Security24hIcon } from './icons/features/Security24hIcon';
import { SelfCheckInIcon } from './icons/features/SelfCheckInIcon';
import { SeniorFriendlyIcon } from './icons/features/SeniorFriendlyIcon';
import { SharedSpaceIcon } from './icons/features/SharedSpaceIcon';
import { SmartHomeIcon } from './icons/features/SmartHomeIcon';
import { SmokingAreaIcon } from './icons/features/SmokingAreaIcon';
import { SpaFrontIcon } from './icons/features/SpaFrontIcon';
import { ThemedRoomsIcon } from './icons/features/ThemedRoomsIcon';
import { TouristInfoIcon } from './icons/features/TouristInfoIcon';
import { WasteRecyclingIcon } from './icons/features/WasteRecyclingIcon';

// Entity icons
import { AccommodationIcon } from './icons/entities/AccommodationIcon';
import { ContentIcon } from './icons/entities/ContentIcon';
import { CouponsIcon } from './icons/entities/CouponsIcon';
import { DestinationIcon } from './icons/entities/DestinationIcon';
import { EventIcon } from './icons/entities/EventIcon';
import { EventLocationIcon } from './icons/entities/EventLocationIcon';
import { EventOrganizerIcon } from './icons/entities/EventOrganizerIcon';
import { OffersIcon } from './icons/entities/OffersIcon';
import { PermissionIcon } from './icons/entities/PermissionIcon';
import { PostIcon } from './icons/entities/PostIcon';
import { PostSponsorIcon } from './icons/entities/PostSponsorIcon';
import { PostSponsorshipIcon } from './icons/entities/PostSponsorshipIcon';
import { PromotionsIcon } from './icons/entities/PromotionsIcon';

// Booking state icons
import { AvailableIcon } from './icons/booking/AvailableIcon';
import { CancelledIcon } from './icons/booking/CancelledIcon';
import { CheckInIcon } from './icons/booking/CheckInIcon';
import { CheckOutIcon } from './icons/booking/CheckOutIcon';
import { ConfirmedIcon } from './icons/booking/ConfirmedIcon';
import { GuestsIcon } from './icons/booking/GuestsIcon';
import { PendingIcon } from './icons/booking/PendingIcon';
import { ReserveIcon } from './icons/booking/ReserveIcon';
import { RoomsIcon } from './icons/booking/RoomsIcon';
import { UnavailableIcon } from './icons/booking/UnavailableIcon';

// Social icons (stored in DB as contact/social link types)
import { FacebookIcon } from './icons/social/FacebookIcon';
import { InstagramIcon } from './icons/social/InstagramIcon';
import { TwitterIcon } from './icons/social/TwitterIcon';
import { WebIcon } from './icons/social/WebIcon';
import { WhatsappIcon } from './icons/social/WhatsappIcon';

// Communication icons (stored in DB as contact channel types)
import { ChatIcon } from './icons/communication/ChatIcon';
import { ContactoIcon } from './icons/communication/ContactoIcon';
import { EmailIcon } from './icons/communication/EmailIcon';
import { LanguageIcon } from './icons/communication/LanguageIcon';
import { NewsletterIcon } from './icons/communication/NewsletterIcon';
import { PhoneIcon } from './icons/communication/PhoneIcon';
import { SmsIcon } from './icons/communication/SmsIcon';

// Attraction icons (stored in DB as attraction category types)
import { AgriculturalCenterIcon } from './icons/attractions/AgriculturalCenterIcon';
import { AmphitheaterIcon } from './icons/attractions/AmphitheaterIcon';
import { ArchaeologicalSiteIcon } from './icons/attractions/ArchaeologicalSiteIcon';
import { BeachIcon } from './icons/attractions/BeachIcon';
import { BirdWatchingIcon } from './icons/attractions/BirdWatchingIcon';
import { CarnavalVenueIcon } from './icons/attractions/CarnavalVenueIcon';
import { CasinoIcon } from './icons/attractions/CasinoIcon';
import { CathedralIcon } from './icons/attractions/CathedralIcon';
import { ColonialChurchIcon } from './icons/attractions/ColonialChurchIcon';
import { CraftsFairIcon } from './icons/attractions/CraftsFairIcon';
import { CulturalCenterIcon } from './icons/attractions/CulturalCenterIcon';
import { EducationalFarmIcon } from './icons/attractions/EducationalFarmIcon';
import { EventCenterIcon } from './icons/attractions/EventCenterIcon';
import { FamilyThermalIcon } from './icons/attractions/FamilyThermalIcon';
import { FishingPierIcon } from './icons/attractions/FishingPierIcon';
import { GastronomicMarketIcon } from './icons/attractions/GastronomicMarketIcon';
import { HistoricMonumentIcon } from './icons/attractions/HistoricMonumentIcon';
import { HistoricMuseumIcon } from './icons/attractions/HistoricMuseumIcon';
import { MainSquareIcon } from './icons/attractions/MainSquareIcon';
import { MunicipalBeachIcon } from './icons/attractions/MunicipalBeachIcon';
import { MunicipalParkIcon } from './icons/attractions/MunicipalParkIcon';
import { MunicipalStadiumIcon } from './icons/attractions/MunicipalStadiumIcon';
import { MuseumIcon } from './icons/attractions/MuseumIcon';
import { NaturalReserveIcon } from './icons/attractions/NaturalReserveIcon';
import { NatureReserveIcon } from './icons/attractions/NatureReserveIcon';
import { ParkIcon } from './icons/attractions/ParkIcon';
import { ProtectedAreaIcon } from './icons/attractions/ProtectedAreaIcon';
import { RecreationalBoatingIcon } from './icons/attractions/RecreationalBoatingIcon';
import { RestaurantIcon } from './icons/attractions/RestaurantIcon';
import { RiverBeachIcon } from './icons/attractions/RiverBeachIcon';
import { RiverKayakIcon } from './icons/attractions/RiverKayakIcon';
import { ShoppingCenterIcon } from './icons/attractions/ShoppingCenterIcon';
import { SoccerFieldIcon } from './icons/attractions/SoccerFieldIcon';
import { SportFishingIcon } from './icons/attractions/SportFishingIcon';
import { SportsCenterIcon } from './icons/attractions/SportsCenterIcon';
import { ThermalAquaParkIcon } from './icons/attractions/ThermalAquaParkIcon';
import { ThermalPoolsIcon } from './icons/attractions/ThermalPoolsIcon';
import { ThermalSpaIcon } from './icons/attractions/ThermalSpaIcon';
import { TouristPierIcon } from './icons/attractions/TouristPierIcon';
import { TouristRanchIcon } from './icons/attractions/TouristRanchIcon';
import { WellnessCenterIcon } from './icons/attractions/WellnessCenterIcon';
import { WetlandsIcon } from './icons/attractions/WetlandsIcon';

type IconComponent = React.ComponentType<IconProps>;

/**
 * Map of icon name strings to their corresponding icon components.
 * Icon names match the component names exported from @repo/icons.
 * Used to resolve DB-stored icon strings to renderable components.
 *
 * Covers all icons that may be stored as strings in the database:
 * amenities, features, attractions, entities, booking states,
 * social links, and communication channels.
 * Admin/system/action icons are imported statically and excluded here.
 */
export const ICON_MAP: Record<string, IconComponent> = {
    // Amenity icons
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
    CoffeeMakerIcon,
    CoveredGrillAreaIcon,
    CoveredParkingIcon,
    CoworkingSpaceIcon,
    DailyCleaningIcon,
    DockAccessIcon,
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
    WorkshopSpaceIcon,
    YogaMeditationIcon,

    // Feature icons
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
    DigitalDetoxIcon,
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
    OrganizedActivitiesIcon,
    OwnProductionIcon,
    PanoramicViewIcon,
    PavedAccessIcon,
    PerimeterFenceIcon,
    PerimeterLightingIcon,
    PetAreaIcon,
    PetFriendlyIcon,
    PrivateGrillIcon,
    ProfessionalStaffIcon,
    QuietEnvironmentIcon,
    QuietZoneIcon,
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
    WasteRecyclingIcon,

    // Entity icons
    AccommodationIcon,
    ContentIcon,
    CouponsIcon,
    DestinationIcon,
    EventIcon,
    EventLocationIcon,
    EventOrganizerIcon,
    OffersIcon,
    PermissionIcon,
    PostIcon,
    PostSponsorIcon,
    PostSponsorshipIcon,
    PromotionsIcon,

    // Booking state icons
    AvailableIcon,
    CancelledIcon,
    CheckInIcon,
    CheckOutIcon,
    ConfirmedIcon,
    GuestsIcon,
    PendingIcon,
    ReserveIcon,
    RoomsIcon,
    UnavailableIcon,

    // Social icons
    FacebookIcon,
    InstagramIcon,
    TwitterIcon,
    WebIcon,
    WhatsappIcon,

    // Communication icons
    ChatIcon,
    ContactoIcon,
    EmailIcon,
    LanguageIcon,
    NewsletterIcon,
    PhoneIcon,
    SmsIcon,

    // Attraction icons
    AgriculturalCenterIcon,
    AmphitheaterIcon,
    ArchaeologicalSiteIcon,
    BeachIcon,
    BirdWatchingIcon,
    CarnavalVenueIcon,
    CasinoIcon,
    CathedralIcon,
    ColonialChurchIcon,
    CraftsFairIcon,
    CulturalCenterIcon,
    EducationalFarmIcon,
    EventCenterIcon,
    FamilyThermalIcon,
    FishingPierIcon,
    GastronomicMarketIcon,
    HistoricMonumentIcon,
    HistoricMuseumIcon,
    MainSquareIcon,
    MunicipalBeachIcon,
    MunicipalParkIcon,
    MunicipalStadiumIcon,
    MuseumIcon,
    NaturalReserveIcon,
    NatureReserveIcon,
    ParkIcon,
    ProtectedAreaIcon,
    RecreationalBoatingIcon,
    RestaurantIcon,
    RiverBeachIcon,
    RiverKayakIcon,
    ShoppingCenterIcon,
    SoccerFieldIcon,
    SportFishingIcon,
    SportsCenterIcon,
    ThermalAquaParkIcon,
    ThermalPoolsIcon,
    ThermalSpaIcon,
    TouristPierIcon,
    TouristRanchIcon,
    WellnessCenterIcon,
    WetlandsIcon
};

/**
 * Resolves an icon name string to its corresponding icon component.
 *
 * @param iconName - The icon component name (e.g. "WifiIcon", "PoolIcon")
 * @returns The icon component if found, undefined otherwise
 *
 * @example
 * ```tsx
 * const Icon = resolveIcon('WifiIcon');
 * if (Icon) {
 *   return <Icon size={16} />;
 * }
 * ```
 */
export function resolveIcon({
    iconName
}: { readonly iconName: string }): IconComponent | undefined {
    return ICON_MAP[iconName];
}
