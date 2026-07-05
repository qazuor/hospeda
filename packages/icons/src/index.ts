/**
 * @repo/icons - Universal Icon Components
 *
 * SVG-based icon components that work in both React and Astro
 * without requiring hydration.
 */

// Export custom brand-mark factory (single-color SVG logos that aren't part
// of the Phosphor catalog, e.g. payment provider marks).
export { createBrandIcon } from './create-brand-icon';
// Export Phosphor icon factory
export { createPhosphorIcon } from './create-phosphor-icon';
export type {
    AccommodationTypeColorScheme,
    AccommodationTypeVisual
} from './domain/accommodation-type';
// Export domain mappings (accommodation type → icon + color tokens). Single
// source of truth shared by apps/web and apps/admin.
export {
    ACCOMMODATION_TYPE_FALLBACK_VISUAL,
    ACCOMMODATION_TYPE_VISUALS,
    getAccommodationTypeColorScheme,
    getAccommodationTypeColorTokens,
    getAccommodationTypeIcon,
    getAccommodationTypeVisual
} from './domain/accommodation-type';
export type {
    AmenityTypeColorScheme,
    AmenityTypeColorVariant,
    AmenityTypeVisual
} from './domain/amenity-type';
// Amenity-type → icon + color tokens. Single source of truth shared by apps/web
// and apps/admin.
export {
    AMENITY_TYPE_FALLBACK_VISUAL,
    AMENITY_TYPE_VISUALS,
    getAmenityTypeColorScheme,
    getAmenityTypeIcon,
    getAmenityTypeVisual
} from './domain/amenity-type';

// Attraction icon slug (Material Symbols) → Phosphor component. Single source of
// truth shared by apps/web and apps/admin.
export { getAttractionIcon } from './domain/attraction-icon';
export type {
    AuthProviderColorScheme,
    AuthProviderColorVariant,
    AuthProviderVisual
} from './domain/auth-provider';
// Auth-provider → icon + color tokens. Single source of truth shared by apps/web
// and apps/admin.
export {
    AUTH_PROVIDER_FALLBACK_VISUAL,
    AUTH_PROVIDER_VISUALS,
    getAuthProviderColorScheme,
    getAuthProviderIcon,
    getAuthProviderVisual
} from './domain/auth-provider';
export type {
    EventCategoryColorScheme,
    EventCategoryColorVariant,
    EventCategoryVisual
} from './domain/event-category';
// Event-category → icon + color tokens. Single source of truth shared by
// apps/web and apps/admin.
export {
    EVENT_CATEGORY_FALLBACK_VISUAL,
    EVENT_CATEGORY_VISUALS,
    getEventCategoryColorScheme,
    getEventCategoryIcon,
    getEventCategoryVisual
} from './domain/event-category';
export type {
    PostCategoryColorScheme,
    PostCategoryColorVariant,
    PostCategoryVisual
} from './domain/post-category';
// Post-category → icon + color tokens. Single source of truth shared by
// apps/web and apps/admin.
export {
    getPostCategoryColorScheme,
    getPostCategoryIcon,
    getPostCategoryVisual,
    POST_CATEGORY_FALLBACK_VISUAL,
    POST_CATEGORY_VISUALS
} from './domain/post-category';
export type {
    SponsorTypeColorScheme,
    SponsorTypeColorVariant,
    SponsorTypeVisual
} from './domain/sponsor-type';
// Sponsor-type → icon + color tokens. Single source of truth shared by apps/web
// and apps/admin.
export {
    getSponsorTypeColorScheme,
    getSponsorTypeIcon,
    getSponsorTypeVisual,
    SPONSOR_TYPE_FALLBACK_VISUAL,
    SPONSOR_TYPE_VISUALS
} from './domain/sponsor-type';
export type {
    UserRoleColorScheme,
    UserRoleColorVariant,
    UserRoleVisual
} from './domain/user-role';
// User-role → icon + color tokens. Single source of truth shared by apps/web
// and apps/admin.
export {
    getUserRoleColorScheme,
    getUserRoleIcon,
    getUserRoleVisual,
    USER_ROLE_FALLBACK_VISUAL,
    USER_ROLE_VISUALS
} from './domain/user-role';
// Export booking icons
// Accommodation icons
export { BathroomsIcon } from './icons/accommodation/BathroomsIcon';
export { BedroomsIcon } from './icons/accommodation/BedroomsIcon';
export { SmokingAllowedIcon } from './icons/accommodation/SmokingAllowedIcon';
// Export actions icons
export { AskToAiIcon } from './icons/actions/AskToAiIcon';
export { CancelIcon } from './icons/actions/CancelIcon';
export { ConfirmIcon } from './icons/actions/ConfirmIcon';
export { CopyIcon } from './icons/actions/CopyIcon';
export { DeleteIcon } from './icons/actions/DeleteIcon';
export { DownloadIcon } from './icons/actions/DownloadIcon';
export { EditIcon } from './icons/actions/EditIcon';
export { ExportIcon } from './icons/actions/ExportIcon';
export { FaqsIcon } from './icons/actions/FaqsIcon';
export { ImportIcon } from './icons/actions/ImportIcon';
export { PrintIcon } from './icons/actions/PrintIcon';
export { RotateCcwIcon } from './icons/actions/RotateCcwIcon';
export { SaveIcon } from './icons/actions/SaveIcon';
export { ShareIcon } from './icons/actions/ShareIcon';
export { SynchronizeIcon } from './icons/actions/SynchronizeIcon';
export { UploadIcon } from './icons/actions/UploadIcon';

// Export admin icons
export { AnalyticsIcon } from './icons/admin/AnalyticsIcon';
export { BackupIcon } from './icons/admin/BackupIcon';
export { DashboardIcon } from './icons/admin/DashboardIcon';
export { ListIcon } from './icons/admin/ListIcon';
export { LogsIcon } from './icons/admin/LogsIcon';
export { MetricsIcon } from './icons/admin/MetricsIcon';
export { MonitoringIcon } from './icons/admin/MonitoringIcon';
export { PermissionsIcon } from './icons/admin/PermissionsIcon';
export { ReportsIcon } from './icons/admin/ReportsIcon';
export { RolesIcon } from './icons/admin/RolesIcon';
export { SectionIcon } from './icons/admin/SectionIcon';
export { StatisticsIcon } from './icons/admin/StatisticsIcon';
export { TagIcon } from './icons/admin/TagIcon';
export { TagsIcon } from './icons/admin/TagsIcon';
export { UsersManagementIcon } from './icons/admin/UsersManagementIcon';
export { ViewAllIcon } from './icons/admin/ViewAllIcon';

// Export amenity icons
export { AirConditioningIcon } from './icons/amenities/AirConditioningIcon';
export { BabyMonitorIcon } from './icons/amenities/BabyMonitorIcon';
export { BalconyIcon } from './icons/amenities/BalconyIcon';
export { BarServiceIcon } from './icons/amenities/BarServiceIcon';
export { BbqGrillIcon } from './icons/amenities/BbqGrillIcon';
export { BeachEquipmentIcon } from './icons/amenities/BeachEquipmentIcon';
// Outdoor amenities
export { BeachUmbrellaIcon } from './icons/amenities/BeachUmbrellaIcon';
export { BedLinensIcon } from './icons/amenities/BedLinensIcon';
export { BicyclesIcon } from './icons/amenities/BicyclesIcon';
export { BlackoutCurtainsIcon } from './icons/amenities/BlackoutCurtainsIcon';
export { BoardGamesIcon } from './icons/amenities/BoardGamesIcon';
export { BooksAndMagazinesIcon } from './icons/amenities/BooksAndMagazinesIcon';
export { BreakfastIcon } from './icons/amenities/BreakfastIcon';
export { BroomIcon } from './icons/amenities/BroomIcon';
export { CarIcon } from './icons/amenities/CarIcon';
export { ClockIcon } from './icons/amenities/ClockIcon';
export { CoffeeIcon } from './icons/amenities/CoffeeIcon';
export { CoffeeMakerIcon } from './icons/amenities/CoffeeMakerIcon';
export { CoveredGrillAreaIcon } from './icons/amenities/CoveredGrillAreaIcon';
export { CoveredParkingIcon } from './icons/amenities/CoveredParkingIcon';
export { CoworkingSpaceIcon } from './icons/amenities/CoworkingSpaceIcon';
export { DailyCleaningIcon } from './icons/amenities/DailyCleaningIcon';
export { DockAccessIcon } from './icons/amenities/DockAccessIcon';
export { DogIcon } from './icons/amenities/DogIcon';
export { DoubleGlazingIcon } from './icons/amenities/DoubleGlazingIcon';
export { DropIcon } from './icons/amenities/DropIcon';
export { ElectricBlanketIcon } from './icons/amenities/ElectricBlanketIcon';
export { ElectricFireplaceIcon } from './icons/amenities/ElectricFireplaceIcon';
export { ElevatorIcon } from './icons/amenities/ElevatorIcon';
export { FanIcon } from './icons/amenities/FanIcon';
export { FireExtinguisherIcon } from './icons/amenities/FireExtinguisherIcon';
export { FireIcon } from './icons/amenities/FireIcon';
export { FireplaceIcon } from './icons/amenities/FireplaceIcon';
export { FirstAidKitIcon } from './icons/amenities/FirstAidKitIcon';
export { FishingEquipmentIcon } from './icons/amenities/FishingEquipmentIcon';
export { FullBoardIcon } from './icons/amenities/FullBoardIcon';
export { GymIcon } from './icons/amenities/GymIcon';
export { HairDryerIcon } from './icons/amenities/HairDryerIcon';
export { HeatedPoolIcon } from './icons/amenities/HeatedPoolIcon';
export { HeatingIcon } from './icons/amenities/HeatingIcon';
export { HighChairIcon } from './icons/amenities/HighChairIcon';
export { InternationalAdaptersIcon } from './icons/amenities/InternationalAdaptersIcon';
export { JacuzziIcon } from './icons/amenities/JacuzziIcon';
export { KayakRentalIcon } from './icons/amenities/KayakRentalIcon';
export { KettleIcon } from './icons/amenities/KettleIcon';
export { KidsGamesIcon } from './icons/amenities/KidsGamesIcon';
export { KitchenIcon } from './icons/amenities/KitchenIcon';
export { LaundryServiceIcon } from './icons/amenities/LaundryServiceIcon';
export { LuggageStorageIcon } from './icons/amenities/LuggageStorageIcon';
export { MicrowaveIcon } from './icons/amenities/MicrowaveIcon';
export { MiniBarIcon } from './icons/amenities/MiniBarIcon';
export { MotorhomeParkingIcon } from './icons/amenities/MotorhomeParkingIcon';
export { OrganicGardenIcon } from './icons/amenities/OrganicGardenIcon';
export { OutdoorFurnitureIcon } from './icons/amenities/OutdoorFurnitureIcon';
export { OutdoorKitchenIcon } from './icons/amenities/OutdoorKitchenIcon';
export { OutdoorLightingIcon } from './icons/amenities/OutdoorLightingIcon';
export { ParkingIcon } from './icons/amenities/ParkingIcon';
export { PetAllowedIcon } from './icons/amenities/PetAllowedIcon';
export { PlaygroundIcon } from './icons/amenities/PlaygroundIcon';
export { PoolIcon } from './icons/amenities/PoolIcon';
export { PrivateGardenIcon } from './icons/amenities/PrivateGardenIcon';
export { PrivateViewpointIcon } from './icons/amenities/PrivateViewpointIcon';
export { Reception24hIcon } from './icons/amenities/Reception24hIcon';
export { RefrigeratorIcon } from './icons/amenities/RefrigeratorIcon';
export { RelaxationAreaIcon } from './icons/amenities/RelaxationAreaIcon';
export { RiverViewIcon } from './icons/amenities/RiverViewIcon';
export { RoomServiceIcon } from './icons/amenities/RoomServiceIcon';
export { RoomTvIcon } from './icons/amenities/RoomTvIcon';
export { SafeIcon } from './icons/amenities/SafeIcon';
export { SaunaIcon } from './icons/amenities/SaunaIcon';
export { SecureParkingIcon } from './icons/amenities/SecureParkingIcon';
export { SharedKitchenIcon } from './icons/amenities/SharedKitchenIcon';
export { SharedPatioIcon } from './icons/amenities/SharedPatioIcon';
export { ShirtIcon } from './icons/amenities/ShirtIcon';
export { ShoppingServiceIcon } from './icons/amenities/ShoppingServiceIcon';
export { SmartTvIcon } from './icons/amenities/SmartTvIcon';
export { SmokeDetectorIcon } from './icons/amenities/SmokeDetectorIcon';
export { SoapDispenserIcon } from './icons/amenities/SoapDispenserIcon';
export { SolarShowersIcon } from './icons/amenities/SolarShowersIcon';
export { SpaServicesIcon } from './icons/amenities/SpaServicesIcon';
export { StoveIcon } from './icons/amenities/StoveIcon';
export { TerraceIcon } from './icons/amenities/TerraceIcon';
export { TowelsIcon } from './icons/amenities/TowelsIcon';
export { TransferServiceIcon } from './icons/amenities/TransferServiceIcon';
export { TvIcon } from './icons/amenities/TvIcon';
export { UnderfloorHeatingIcon } from './icons/amenities/UnderfloorHeatingIcon';
export { UtensilsIcon } from './icons/amenities/UtensilsIcon';
export { WalkingTrailIcon } from './icons/amenities/WalkingTrailIcon';
export { WasherIcon } from './icons/amenities/WasherIcon';
export { WaterDispenserIcon } from './icons/amenities/WaterDispenserIcon';
export { WifiHighIcon } from './icons/amenities/WifiHighIcon';
export { WifiIcon } from './icons/amenities/WifiIcon';
export { WorkshopSpaceIcon } from './icons/amenities/WorkshopSpaceIcon';
export { YogaMeditationIcon } from './icons/amenities/YogaMeditationIcon';
// Export attraction icons
export { AgriculturalCenterIcon } from './icons/attractions/AgriculturalCenterIcon';
export { AmphitheaterIcon } from './icons/attractions/AmphitheaterIcon';
export { ArchaeologicalSiteIcon } from './icons/attractions/ArchaeologicalSiteIcon';
export { ArtisanalCheeseIcon } from './icons/attractions/ArtisanalCheeseIcon';
export { AthleticsTrackIcon } from './icons/attractions/AthleticsTrackIcon';
export { AviariumIcon } from './icons/attractions/AviariumIcon';
export { BallroomIcon } from './icons/attractions/BallroomIcon';
export { BeachIcon } from './icons/attractions/BeachIcon';
export { BirdIcon } from './icons/attractions/BirdIcon';
export { BirdWatchingIcon } from './icons/attractions/BirdWatchingIcon';
export { BridgeIcon } from './icons/attractions/BridgeIcon';
export { CarnavalHeadquartersIcon } from './icons/attractions/CarnavalHeadquartersIcon';
export { CarnavalMuseumIcon } from './icons/attractions/CarnavalMuseumIcon';
export { CarnavalVenueIcon } from './icons/attractions/CarnavalVenueIcon';
export { CarnavalWorkshopIcon } from './icons/attractions/CarnavalWorkshopIcon';
export { CasinoIcon } from './icons/attractions/CasinoIcon';
export { CastleTurretIcon } from './icons/attractions/CastleTurretIcon';
export { CathedralIcon } from './icons/attractions/CathedralIcon';
export { ChildrensPlaygroundIcon } from './icons/attractions/ChildrensPlaygroundIcon';
export { CitrusPlantationIcon } from './icons/attractions/CitrusPlantationIcon';
export { CitrusTourIcon } from './icons/attractions/CitrusTourIcon';
export { ColonialChurchIcon } from './icons/attractions/ColonialChurchIcon';
export { CommercialZoneIcon } from './icons/attractions/CommercialZoneIcon';
export { CraftsFairIcon } from './icons/attractions/CraftsFairIcon';
export { CreoleInnIcon } from './icons/attractions/CreoleInnIcon';
export { CulturalCenterIcon } from './icons/attractions/CulturalCenterIcon';
export { DeltaExplorerIcon } from './icons/attractions/DeltaExplorerIcon';
export { EducationalFarmIcon } from './icons/attractions/EducationalFarmIcon';
export { EventCenterIcon } from './icons/attractions/EventCenterIcon';
export { FamilyThermalIcon } from './icons/attractions/FamilyThermalIcon';
export { FestivalPlazaIcon } from './icons/attractions/FestivalPlazaIcon';
export { FishingPierIcon } from './icons/attractions/FishingPierIcon';
export { GamingPlazaIcon } from './icons/attractions/GamingPlazaIcon';
export { GastronomicMarketIcon } from './icons/attractions/GastronomicMarketIcon';
export { GovernmentBuildingIcon } from './icons/attractions/GovernmentBuildingIcon';
export { HistoricHouseIcon } from './icons/attractions/HistoricHouseIcon';
export { HistoricMonumentIcon } from './icons/attractions/HistoricMonumentIcon';
export { HistoricMuseumIcon } from './icons/attractions/HistoricMuseumIcon';
export { HistoricPalaceIcon } from './icons/attractions/HistoricPalaceIcon';
export { InterpretationCenterIcon } from './icons/attractions/InterpretationCenterIcon';
export { LocalDiscoIcon } from './icons/attractions/LocalDiscoIcon';
export { MainSquareIcon } from './icons/attractions/MainSquareIcon';
export { MultisportComplexIcon } from './icons/attractions/MultisportComplexIcon';
export { MunicipalBeachIcon } from './icons/attractions/MunicipalBeachIcon';
export { MunicipalCinemaIcon } from './icons/attractions/MunicipalCinemaIcon';
export { MunicipalGymIcon } from './icons/attractions/MunicipalGymIcon';
export { MunicipalParkIcon } from './icons/attractions/MunicipalParkIcon';
export { MunicipalStadiumIcon } from './icons/attractions/MunicipalStadiumIcon';
export { MuseumIcon } from './icons/attractions/MuseumIcon';
export { NaturalReserveIcon } from './icons/attractions/NaturalReserveIcon';
export { NaturalSpaIcon } from './icons/attractions/NaturalSpaIcon';
export { NatureReserveIcon } from './icons/attractions/NatureReserveIcon';
export { NavigableChannelIcon } from './icons/attractions/NavigableChannelIcon';
export { ParkIcon } from './icons/attractions/ParkIcon';
export { PedestrianWalkwayIcon } from './icons/attractions/PedestrianWalkwayIcon';
export { ProtectedAreaIcon } from './icons/attractions/ProtectedAreaIcon';
export { RecreationalBoatingIcon } from './icons/attractions/RecreationalBoatingIcon';
export { RegionalMuseumIcon } from './icons/attractions/RegionalMuseumIcon';
export { RestaurantIcon } from './icons/attractions/RestaurantIcon';
export { RiverBeachIcon } from './icons/attractions/RiverBeachIcon';
export { RiverKayakIcon } from './icons/attractions/RiverKayakIcon';
export { ShoppingCenterIcon } from './icons/attractions/ShoppingCenterIcon';
export { SoccerFieldIcon } from './icons/attractions/SoccerFieldIcon';
export { SportFishingIcon } from './icons/attractions/SportFishingIcon';
export { SportsCenterIcon } from './icons/attractions/SportsCenterIcon';
export { SportsComplexIcon } from './icons/attractions/SportsComplexIcon';
export { ThermalAquaParkIcon } from './icons/attractions/ThermalAquaParkIcon';
export { ThermalPoolsIcon } from './icons/attractions/ThermalPoolsIcon';
export { ThermalSpaIcon } from './icons/attractions/ThermalSpaIcon';
export { TouristPierIcon } from './icons/attractions/TouristPierIcon';
export { TouristRanchIcon } from './icons/attractions/TouristRanchIcon';
export { TraditionalBakeryIcon } from './icons/attractions/TraditionalBakeryIcon';
export { TraditionalGrillIcon } from './icons/attractions/TraditionalGrillIcon';
export { TraditionalPubIcon } from './icons/attractions/TraditionalPubIcon';
export { WellnessCenterIcon } from './icons/attractions/WellnessCenterIcon';
export { WetlandsIcon } from './icons/attractions/WetlandsIcon';
export { AvailableBookingIcon } from './icons/booking/AvailableBookingIcon';
export { AvailableIcon } from './icons/booking/AvailableIcon';
export { CancelledBookingIcon } from './icons/booking/CancelledBookingIcon';
export { CancelledIcon } from './icons/booking/CancelledIcon';
export { CheckInBookingIcon } from './icons/booking/CheckInBookingIcon';
export { CheckInIcon } from './icons/booking/CheckInIcon';
export { CheckOutBookingIcon } from './icons/booking/CheckOutBookingIcon';
export { CheckOutIcon } from './icons/booking/CheckOutIcon';
export { ConfirmedBookingIcon } from './icons/booking/ConfirmedBookingIcon';
export { ConfirmedIcon } from './icons/booking/ConfirmedIcon';
export { GuestsBookingIcon } from './icons/booking/GuestsBookingIcon';
export { GuestsIcon } from './icons/booking/GuestsIcon';
export { PendingBookingIcon } from './icons/booking/PendingBookingIcon';
export { PendingIcon } from './icons/booking/PendingIcon';
export { ReserveBookingIcon } from './icons/booking/ReserveBookingIcon';
export { ReserveIcon } from './icons/booking/ReserveIcon';
export { RoomsBookingIcon } from './icons/booking/RoomsBookingIcon';
export { RoomsIcon } from './icons/booking/RoomsIcon';
export { UnavailableBookingIcon } from './icons/booking/UnavailableBookingIcon';
export { UnavailableIcon } from './icons/booking/UnavailableIcon';
// Export communication icons
export { ChatIcon } from './icons/communication/ChatIcon';
export { ContactoIcon } from './icons/communication/ContactoIcon';
export { EmailIcon } from './icons/communication/EmailIcon';
export { LanguageIcon } from './icons/communication/LanguageIcon';
export { NewsletterIcon } from './icons/communication/NewsletterIcon';
export { PhoneIcon } from './icons/communication/PhoneIcon';
export { SmsIcon } from './icons/communication/SmsIcon';
// Export entity icons
export { AccommodationIcon } from './icons/entities/AccommodationIcon';
export { ContentIcon } from './icons/entities/ContentIcon';
export { CouponsIcon } from './icons/entities/CouponsIcon';
export { DestinationIcon } from './icons/entities/DestinationIcon';
export { EventIcon } from './icons/entities/EventIcon';
export { EventLocationIcon } from './icons/entities/EventLocationIcon';
export { EventOrganizerIcon } from './icons/entities/EventOrganizerIcon';
export { OffersIcon } from './icons/entities/OffersIcon';
export { PermissionIcon } from './icons/entities/PermissionIcon';
export { PostIcon } from './icons/entities/PostIcon';
export { PostSponsorIcon } from './icons/entities/PostSponsorIcon';
export { PostSponsorshipIcon } from './icons/entities/PostSponsorshipIcon';
export { PromotionsIcon } from './icons/entities/PromotionsIcon';
// Export feature icons
export { AccessibilityFriendlyIcon } from './icons/features/AccessibilityFriendlyIcon';
export { AdultsOnlyIcon } from './icons/features/AdultsOnlyIcon';
export { AnimalActivitiesIcon } from './icons/features/AnimalActivitiesIcon';
export { AnimalPenIcon } from './icons/features/AnimalPenIcon';
export { BilingualServiceIcon } from './icons/features/BilingualServiceIcon';
export { CampingAreaIcon } from './icons/features/CampingAreaIcon';
export { CampingSectorIcon } from './icons/features/CampingSectorIcon';
export { CentralAreaIcon } from './icons/features/CentralAreaIcon';
export { CouplesFriendlyIcon } from './icons/features/CouplesFriendlyIcon';
export { CoveredGalleryIcon } from './icons/features/CoveredGalleryIcon';
export { DairyProductionIcon } from './icons/features/DairyProductionIcon';
export { DigitalDetoxIcon } from './icons/features/DigitalDetoxIcon';
export { EcoConstructionIcon } from './icons/features/EcoConstructionIcon';
export { EcologicalIcon } from './icons/features/EcologicalIcon';
export { EntirePropertyIcon } from './icons/features/EntirePropertyIcon';
export { FamilySuitableIcon } from './icons/features/FamilySuitableIcon';
export { FirePitAreaIcon } from './icons/features/FirePitAreaIcon';
export { GravelAccessIcon } from './icons/features/GravelAccessIcon';
export { GroupFriendlyIcon } from './icons/features/GroupFriendlyIcon';
export { InternalParkingIcon } from './icons/features/InternalParkingIcon';
export { IsolatedLocationIcon } from './icons/features/IsolatedLocationIcon';
export { LGBTQFriendlyIcon } from './icons/features/LGBTQFriendlyIcon';
export { LocalCraftsIcon } from './icons/features/LocalCraftsIcon';
export { MinimalistStyleIcon } from './icons/features/MinimalistStyleIcon';
export { MinimumStayIcon } from './icons/features/MinimumStayIcon';
export { ModernStyleIcon } from './icons/features/ModernStyleIcon';
export { NaturalEnvironmentIcon } from './icons/features/NaturalEnvironmentIcon';
export { NoCellSignalIcon } from './icons/features/NoCellSignalIcon';
export { OrganizedActivitiesIcon } from './icons/features/OrganizedActivitiesIcon';
export { OwnProductionIcon } from './icons/features/OwnProductionIcon';
export { PanoramicViewIcon } from './icons/features/PanoramicViewIcon';
export { PavedAccessIcon } from './icons/features/PavedAccessIcon';
export { PerimeterFenceIcon } from './icons/features/PerimeterFenceIcon';
export { PerimeterLightingIcon } from './icons/features/PerimeterLightingIcon';
export { PetAreaIcon } from './icons/features/PetAreaIcon';
export { PetFriendlyIcon } from './icons/features/PetFriendlyIcon';
export { PlasticFreeIcon } from './icons/features/PlasticFreeIcon';
export { PrivateGrillIcon } from './icons/features/PrivateGrillIcon';
export { ProfessionalStaffIcon } from './icons/features/ProfessionalStaffIcon';
export { QuietEnvironmentIcon } from './icons/features/QuietEnvironmentIcon';
export { QuietZoneIcon } from './icons/features/QuietZoneIcon';
export { RainwaterHarvestingIcon } from './icons/features/RainwaterHarvestingIcon';
export { RenewableEnergyIcon } from './icons/features/RenewableEnergyIcon';
export { ResidentialAreaIcon } from './icons/features/ResidentialAreaIcon';
export { RiverFrontIcon } from './icons/features/RiverFrontIcon';
export { RoomRentalIcon } from './icons/features/RoomRentalIcon';
export { RuralActivitiesIcon } from './icons/features/RuralActivitiesIcon';
export { RuralAreaIcon } from './icons/features/RuralAreaIcon';
export { RusticStyleIcon } from './icons/features/RusticStyleIcon';
export { Security24hIcon } from './icons/features/Security24hIcon';
export { SelfCheckInIcon } from './icons/features/SelfCheckInIcon';
export { SeniorFriendlyIcon } from './icons/features/SeniorFriendlyIcon';
export { SharedSpaceIcon } from './icons/features/SharedSpaceIcon';
export { SmartHomeIcon } from './icons/features/SmartHomeIcon';
export { SmokingAreaIcon } from './icons/features/SmokingAreaIcon';
export { SpaFrontIcon } from './icons/features/SpaFrontIcon';
export { TentIcon } from './icons/features/TentIcon';
export { ThemedRoomsIcon } from './icons/features/ThemedRoomsIcon';
export { TouristInfoIcon } from './icons/features/TouristInfoIcon';
export { TreeIcon } from './icons/features/TreeIcon';
export { WasteRecyclingIcon } from './icons/features/WasteRecyclingIcon';
// Export payment brand icons
export { AmericanExpressIcon } from './icons/payment/AmericanExpressIcon';
export { MasterCardIcon } from './icons/payment/MasterCardIcon';
export { MercadoPagoIcon } from './icons/payment/MercadoPagoIcon';
export { VisaIcon } from './icons/payment/VisaIcon';
// Export social icons
export { FacebookIcon } from './icons/social/FacebookIcon';
export { GithubIcon } from './icons/social/GithubIcon';
export { GoogleIcon } from './icons/social/GoogleIcon';
export { InstagramIcon } from './icons/social/InstagramIcon';
export { LinkedInIcon } from './icons/social/LinkedInIcon';
export { TiktokIcon } from './icons/social/TiktokIcon';
export { TwitterIcon, XIcon } from './icons/social/TwitterIcon';
export { WebIcon } from './icons/social/WebIcon';
export { WhatsappIcon } from './icons/social/WhatsappIcon';
export { YoutubeIcon } from './icons/social/YoutubeIcon';
// Additional system icons (Phosphor-based)
export { ActivityIcon } from './icons/system/ActivityIcon';
// Export system icons
export { AddIcon } from './icons/system/AddIcon';
export { AddressIcon } from './icons/system/AddressIcon';
export { AdminIcon } from './icons/system/AdminIcon';
export { AlertCircleIcon } from './icons/system/AlertCircleIcon';
export { AlertsIcon } from './icons/system/AlertsIcon';
export { AlertTriangleIcon } from './icons/system/AlertTriangleIcon';
export { ArrowLeftIcon } from './icons/system/ArrowLeftIcon';
export { ArrowRightIcon } from './icons/system/ArrowRightIcon';
export { AudioIcon } from './icons/system/AudioIcon';
export { BarChartIcon } from './icons/system/BarChartIcon';
export { BedIcon } from './icons/system/BedIcon';
export { BellIcon } from './icons/system/BellIcon';
export { BoldIcon } from './icons/system/BoldIcon';
export { BookmarkIcon } from './icons/system/BookmarkIcon';
export { BreadcrumbsIcon } from './icons/system/BreadcrumbsIcon';
export { BriefcaseIcon } from './icons/system/BriefcaseIcon';
export { BuildingIcon } from './icons/system/BuildingIcon';
export { BuildingsIcon } from './icons/system/BuildingsIcon';
export { CalendarDotsIcon } from './icons/system/CalendarDotsIcon';
export { CalendarIcon } from './icons/system/CalendarIcon';
export { CheckCircleIcon } from './icons/system/CheckCircleIcon';
export { CheckIcon } from './icons/system/CheckIcon';
export { ChevronDownIcon } from './icons/system/ChevronDownIcon';
export { ChevronLeftIcon } from './icons/system/ChevronLeftIcon';
export { ChevronRightIcon } from './icons/system/ChevronRightIcon';
export { ChevronsUpDownIcon } from './icons/system/ChevronsUpDownIcon';
export { ChevronUpIcon } from './icons/system/ChevronUpIcon';
export { CircleIcon } from './icons/system/CircleIcon';
export { CloseIcon } from './icons/system/CloseIcon';
export { ColumnIcon } from './icons/system/ColumnIcon';
export { CompassIcon } from './icons/system/CompassIcon';
export { ConfettiIcon } from './icons/system/ConfettiIcon';
export { ConfigurationIcon } from './icons/system/ConfigurationIcon';
export { CreateIcon } from './icons/system/CreateIcon';
export { CreditCardIcon } from './icons/system/CreditCardIcon';
export { CrownIcon } from './icons/system/CrownIcon';
export { DarkThemeIcon } from './icons/system/DarkThemeIcon';
export { DateIcon } from './icons/system/DateIcon';
export { DebugIcon } from './icons/system/DebugIcon';
export { DocumentIcon } from './icons/system/DocumentIcon';
export { DollarSignIcon } from './icons/system/DollarSignIcon';
export { DropdownIcon } from './icons/system/DropdownIcon';
export { ExcelIcon } from './icons/system/ExcelIcon';
export { ExternalLinkIcon } from './icons/system/ExternalLinkIcon';
export { EyeIcon } from './icons/system/EyeIcon';
export { EyeOffIcon } from './icons/system/EyeOffIcon';
export { FavoriteIcon } from './icons/system/FavoriteIcon';
export { FileTextIcon } from './icons/system/FileTextIcon';
export { FilterIcon } from './icons/system/FilterIcon';
export { FirstPageIcon } from './icons/system/FirstPageIcon';
export { ForkKnifeIcon } from './icons/system/ForkKnifeIcon';
export { FullscreenIcon } from './icons/system/FullscreenIcon';
export { GalleryIcon } from './icons/system/GalleryIcon';
export { GlobeIcon } from './icons/system/GlobeIcon';
export { GridIcon } from './icons/system/GridIcon';
export { GripVerticalIcon } from './icons/system/GripVerticalIcon';
export { HamburgerIcon } from './icons/system/HamburgerIcon';
export { HomeIcon } from './icons/system/HomeIcon';
export { HuespedesIcon } from './icons/system/HuespedesIcon';
export { HuespedIcon } from './icons/system/HuespedIcon';
export { ImageIcon } from './icons/system/ImageIcon';
export { InfoIcon } from './icons/system/InfoIcon';
export { ItalicIcon } from './icons/system/ItalicIcon';
export { LastPageIcon } from './icons/system/LastPageIcon';
export { LightThemeIcon } from './icons/system/LightThemeIcon';
export { LinkIcon } from './icons/system/LinkIcon';
export { ListOrderedIcon } from './icons/system/ListOrderedIcon';
export { LoaderIcon } from './icons/system/LoaderIcon';
export { LoadMoreIcon } from './icons/system/LoadMoreIcon';
export { LocationIcon } from './icons/system/LocationIcon';
export { LockIcon } from './icons/system/LockIcon';
export { LogoutIcon } from './icons/system/LogoutIcon';
export { MailIcon } from './icons/system/MailIcon';
export { MapIcon } from './icons/system/MapIcon';
export { MegaphoneIcon } from './icons/system/MegaphoneIcon';
export { MenuIcon } from './icons/system/MenuIcon';
export { MinimizeIcon } from './icons/system/MinimizeIcon';
export { MinusIcon } from './icons/system/MinusIcon';
export { MonitorIcon } from './icons/system/MonitorIcon';
export { MoonIcon } from './icons/system/MoonIcon';
export { MoreHorizontalIcon } from './icons/system/MoreHorizontalIcon';
export { MousePointerClickIcon } from './icons/system/MousePointerClickIcon';
export { NextIcon } from './icons/system/NextIcon';
export { NotificationIcon } from './icons/system/NotificationIcon';
export { PackageIcon } from './icons/system/PackageIcon';
export { PaletteIcon } from './icons/system/PaletteIcon';
export { PdfIcon } from './icons/system/PdfIcon';
export { PlayIcon } from './icons/system/PlayIcon';
export { PowerIcon } from './icons/system/PowerIcon';
export { PowerOffIcon } from './icons/system/PowerOffIcon';
export { PreviousIcon } from './icons/system/PreviousIcon';
export { PriceIcon } from './icons/system/PriceIcon';
export { QuotesIcon } from './icons/system/QuotesIcon';
export { ReceiptIcon } from './icons/system/ReceiptIcon';
export { RefreshIcon } from './icons/system/RefreshIcon';
export { SearchIcon } from './icons/system/SearchIcon';
export { SettingsIcon } from './icons/system/SettingsIcon';
export { ShieldAlertIcon } from './icons/system/ShieldAlertIcon';
export { ShieldIcon } from './icons/system/ShieldIcon';
export { ShoppingCartIcon } from './icons/system/ShoppingCartIcon';
export { SortIcon } from './icons/system/SortIcon';
export { SparkleIcon } from './icons/system/SparkleIcon';
export { StarIcon } from './icons/system/StarIcon';
export { SunIcon } from './icons/system/SunIcon';
export { TelevisionIcon } from './icons/system/TelevisionIcon';
export { ThermometerIcon } from './icons/system/ThermometerIcon';
export { TrendingDownIcon } from './icons/system/TrendingDownIcon';
export { TrendingUpIcon } from './icons/system/TrendingUpIcon';
export { UnderlineIcon } from './icons/system/UnderlineIcon';
export { UserIcon } from './icons/system/UserIcon';
export { UserSwitchIcon } from './icons/system/UserSwitchIcon';
export { UsersIcon } from './icons/system/UsersIcon';
export { UsersThreeIcon } from './icons/system/UsersThreeIcon';
export { VideoIcon } from './icons/system/VideoIcon';
export { WebhookIcon } from './icons/system/WebhookIcon';
export { WheelchairIcon } from './icons/system/WheelchairIcon';
export { WrenchIcon } from './icons/system/WrenchIcon';
export { XCircleIcon } from './icons/system/XCircleIcon';
export { ZoomInIcon } from './icons/system/ZoomInIcon';
export { ZoomOutIcon } from './icons/system/ZoomOutIcon';
export { CloudFogIcon } from './icons/weather/CloudFogIcon';
// Export weather icons
export { CloudIcon } from './icons/weather/CloudIcon';
export { CloudLightningIcon } from './icons/weather/CloudLightningIcon';
export { CloudMoonIcon } from './icons/weather/CloudMoonIcon';
export { CloudRainIcon } from './icons/weather/CloudRainIcon';
export { CloudSnowIcon } from './icons/weather/CloudSnowIcon';
export { CloudSunIcon } from './icons/weather/CloudSunIcon';
export { SnowflakeIcon } from './icons/weather/SnowflakeIcon';
export { WindIcon } from './icons/weather/WindIcon';
export type { IconProps, IconWeight } from './types';
// Export types and constants
export { DEFAULT_DUOTONE_COLOR, ICON_SIZES } from './types';
