# Icons Catalog

Complete reference of all available icons in `@repo/icons`, organized by category.

**Total Icons:** 386 icons across 12 categories

**Quick Navigation:**

- [Actions (15 icons)](#actions-15-icons)
- [Admin (16 icons)](#admin-16-icons)
- [Amenities (93 icons)](#amenities-93-icons)
- [Attractions (76 icons)](#attractions-76-icons)
- [Booking (16 icons)](#booking-16-icons)
- [Communication (7 icons)](#communication-7-icons)
- [Entities (13 icons)](#entities-13-icons)
- [Features (60 icons)](#features-60-icons)
- [Navigation (14 icons)](#navigation-14-icons)
- [Social (4 icons)](#social-4-icons)
- [System (52 icons)](#system-52-icons)
- [Utilities (20 icons)](#utilities-20-icons)

## Finding Icons

### Search Tips

1. **By Function**: Search for what the icon does (e.g., "delete", "save", "edit")
2. **By Category**: Browse relevant category section below
3. **By Name**: Use your IDE's autocomplete with `Icon` suffix
4. **By Context**: Check related icons in the same category

### Icon Naming Conventions

All icon components follow consistent naming:

- **Format**: `{Name}Icon`
- **PascalCase**: `AirConditioningIcon`, `CheckInIcon`
- **Descriptive**: Names indicate purpose, not appearance
- **Suffixed**: Always ends with `Icon`

Examples:

```tsx
import { SaveIcon, DeleteIcon, EditIcon } from '@repo/icons';
import { PoolIcon, WifiIcon, ParkingIcon } from '@repo/icons';
import { BeachIcon, MuseumIcon, RestaurantIcon } from '@repo/icons';
```

## Actions (15 icons)

Icons for user interface actions and operations.

**Usage Context:** Buttons, toolbars, action menus, forms, data operations

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Ask to AI | `AskToAiIcon` | AI assistance, smart suggestions |
| Cancel | `CancelIcon` | Cancel operations, dismiss dialogs |
| Confirm | `ConfirmIcon` | Confirm actions, approve requests |
| Copy | `CopyIcon` | Copy text, duplicate content |
| Delete | `DeleteIcon` | Remove items, delete records |
| Download | `DownloadIcon` | Download files, export data |
| Edit | `EditIcon` | Edit content, modify records |
| Export | `ExportIcon` | Export data, generate reports |
| FAQs | `FaqsIcon` | Help section, frequently asked questions |
| Import | `ImportIcon` | Import data, upload files |
| Print | `PrintIcon` | Print documents, generate PDFs |
| Save | `SaveIcon` | Save changes, persist data |
| Share | `ShareIcon` | Share content, social sharing |
| Synchronize | `SynchronizeIcon` | Sync data, refresh content |
| Upload | `UploadIcon` | Upload files, import media |

**Example Usage:**

```tsx
import { SaveIcon, CancelIcon, DeleteIcon } from '@repo/icons';

<div className="flex gap-2">
  <button className="btn-primary">
    <SaveIcon size={20} />
    Save
  </button>
  <button className="btn-secondary">
    <CancelIcon size={20} />
    Cancel
  </button>
  <button className="btn-danger">
    <DeleteIcon size={20} />
    Delete
  </button>
</div>
```

## Admin (16 icons)

Icons for administrative interfaces and dashboard functionality.

**Usage Context:** Admin panel, analytics, reports, system management

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Analytics | `AnalyticsIcon` | Analytics dashboard, metrics |
| Backup | `BackupIcon` | Backup operations, data recovery |
| Dashboard | `DashboardIcon` | Main dashboard, overview |
| List | `ListIcon` | List view, table display |
| Logs | `LogsIcon` | System logs, audit trails |
| Metrics | `MetricsIcon` | Performance metrics, KPIs |
| Monitoring | `MonitoringIcon` | System monitoring, health checks |
| Permissions | `PermissionsIcon` | Access control, permissions management |
| Reports | `ReportsIcon` | Generate reports, analytics |
| Roles | `RolesIcon` | User roles, role management |
| Section | `SectionIcon` | Content sections, categories |
| Statistics | `StatisticsIcon` | Statistics view, data visualization |
| Tag | `TagIcon` | Single tag, category tag |
| Tags | `TagsIcon` | Multiple tags, tag management |
| Users Management | `UsersManagementIcon` | User administration, account management |
| View All | `ViewAllIcon` | View all items, expand list |

**Example Usage:**

```tsx
import { DashboardIcon, AnalyticsIcon, ReportsIcon } from '@repo/icons';

<nav className="admin-nav">
  <a href="/admin">
    <DashboardIcon size="md" />
    Dashboard
  </a>
  <a href="/admin/analytics">
    <AnalyticsIcon size="md" />
    Analytics
  </a>
  <a href="/admin/reports">
    <ReportsIcon size="md" />
    Reports
  </a>
</nav>
```

## Amenities (93 icons)

The largest category - icons for accommodation amenities and facilities.

**Usage Context:** Property listings, amenity filters, accommodation features

### Climate Control (7 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Air Conditioning | `AirConditioningIcon` | AC units, climate control |
| Electric Blanket | `ElectricBlanketIcon` | Heated bedding |
| Electric Fireplace | `ElectricFireplaceIcon` | Electric heating |
| Fan | `FanIcon` | Ceiling fans, ventilation |
| Fireplace | `FireplaceIcon` | Wood fireplace, heating |
| Heating | `HeatingIcon` | Central heating, radiators |
| Underfloor Heating | `UnderfloorHeatingIcon` | Floor heating systems |

### Kitchen & Dining (11 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Breakfast | `BreakfastIcon` | Breakfast service, morning meals |
| Coffee Maker | `CoffeeMakerIcon` | Coffee machines, espresso |
| Full Board | `FullBoardIcon` | All meals included |
| Kettle | `KettleIcon` | Electric kettle, hot water |
| Kitchen | `KitchenIcon` | Full kitchen facilities |
| Microwave | `MicrowaveIcon` | Microwave oven |
| Outdoor Kitchen | `OutdoorKitchenIcon` | Outdoor cooking facilities |
| Refrigerator | `RefrigeratorIcon` | Fridge, cold storage |
| Shared Kitchen | `SharedKitchenIcon` | Common kitchen area |
| Stove | `StoveIcon` | Cooking stove, cooktop |
| Utensils | `UtensilsIcon` | Cooking utensils, cutlery |

### Entertainment (6 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Board Games | `BoardGamesIcon` | Games, entertainment |
| Books And Magazines | `BooksAndMagazinesIcon` | Reading materials |
| Kids Games | `KidsGamesIcon` | Children's activities |
| Room TV | `RoomTvIcon` | Television in room |
| Smart TV | `SmartTvIcon` | Smart TV, streaming |
| TV | `TvIcon` | Basic television |

### Outdoor Facilities (17 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Balcony | `BalconyIcon` | Private balcony |
| BBQ Grill | `BbqGrillIcon` | Barbecue facilities |
| Beach Equipment | `BeachEquipmentIcon` | Beach gear, umbrellas |
| Beach Umbrella | `BeachUmbrellaIcon` | Beach shade, umbrellas |
| Bicycles | `BicyclesIcon` | Bike rental, cycling |
| Covered Grill Area | `CoveredGrillAreaIcon` | Covered BBQ area |
| Fishing Equipment | `FishingEquipmentIcon` | Fishing gear |
| Heated Pool | `HeatedPoolIcon` | Temperature-controlled pool |
| Organic Garden | `OrganicGardenIcon` | Garden produce |
| Outdoor Furniture | `OutdoorFurnitureIcon` | Patio furniture |
| Outdoor Lighting | `OutdoorLightingIcon` | Exterior lighting |
| Pool | `PoolIcon` | Swimming pool |
| Private Garden | `PrivateGardenIcon` | Private garden area |
| Shared Patio | `SharedPatioIcon` | Common outdoor space |
| Solar Showers | `SolarShowersIcon` | Outdoor showers |
| Terrace | `TerraceIcon` | Terrace, patio |
| Walking Trail | `WalkingTrailIcon` | Nature trails |

### Parking & Access (5 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Covered Parking | `CoveredParkingIcon` | Covered parking spaces |
| Dock Access | `DockAccessIcon` | Boat dock, water access |
| Elevator | `ElevatorIcon` | Lift, accessibility |
| Motorhome Parking | `MotorhomeParkingIcon` | RV parking |
| Parking | `ParkingIcon` | General parking |
| Secure Parking | `SecureParkingIcon` | Gated parking, security |

### Safety & Security (4 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Fire Extinguisher | `FireExtinguisherIcon` | Fire safety equipment |
| First Aid Kit | `FirstAidKitIcon` | Medical supplies |
| Safe | `SafeIcon` | In-room safe |
| Smoke Detector | `SmokeDetectorIcon` | Fire detection |

### Services (10 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Bar Service | `BarServiceIcon` | Bar, drinks service |
| Daily Cleaning | `DailyCleaningIcon` | Housekeeping service |
| Laundry Service | `LaundryServiceIcon` | Washing service |
| Luggage Storage | `LuggageStorageIcon` | Bag storage |
| Reception 24h | `Reception24hIcon` | 24-hour reception |
| Room Service | `RoomServiceIcon` | In-room dining |
| Shopping Service | `ShoppingServiceIcon` | Shopping assistance |
| Transfer Service | `TransferServiceIcon` | Airport transfer |
| Washer | `WasherIcon` | Washing machine |
| Water Dispenser | `WaterDispenserIcon` | Drinking water |

### Bedroom & Bathroom (9 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Baby Monitor | `BabyMonitorIcon` | Infant monitoring |
| Bed Linens | `BedLinensIcon` | Quality bedding |
| Blackout Curtains | `BlackoutCurtainsIcon` | Light-blocking curtains |
| Broom | `BroomIcon` | Cleaning supplies |
| Double Glazing | `DoubleGlazingIcon` | Insulated windows |
| Hair Dryer | `HairDryerIcon` | Hair drying |
| High Chair | `HighChairIcon` | Baby dining chair |
| Soap Dispenser | `SoapDispenserIcon` | Soap, amenities |
| Towels | `TowelsIcon` | Bath towels, linens |

### Recreation & Wellness (11 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Coworking Space | `CoworkingSpaceIcon` | Remote work facilities |
| Gym | `GymIcon` | Fitness center |
| Jacuzzi | `JacuzziIcon` | Hot tub, spa bath |
| Playground | `PlaygroundIcon` | Children's play area |
| Private Viewpoint | `PrivateViewpointIcon` | Scenic viewing area |
| Relaxation Area | `RelaxationAreaIcon` | Rest area, lounge |
| River View | `RiverViewIcon` | Water views |
| Sauna | `SaunaIcon` | Sauna facilities |
| Spa Services | `SpaServicesIcon` | Spa treatments |
| Workshop Space | `WorkshopSpaceIcon` | Creative workspace |
| Yoga Meditation | `YogaMeditationIcon` | Yoga, meditation space |

### Water Activities (2 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Kayak Rental | `KayakRentalIcon` | Water sports equipment |
| Pet Allowed | `PetAllowedIcon` | Pet-friendly accommodation |

### Technology & Connectivity (3 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Clock | `ClockIcon` | Alarm clock |
| International Adapters | `InternationalAdaptersIcon` | Power adapters |
| Wifi | `WifiIcon` | Internet connectivity |

### Miscellaneous (8 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Mini Bar | `MiniBarIcon` | In-room refreshments |
| Shirt | `ShirtIcon` | Clothing, wardrobe |

**Example Usage:**

```tsx
import {
  WifiIcon,
  PoolIcon,
  ParkingIcon,
  AirConditioningIcon,
  KitchenIcon
} from '@repo/icons';

// Display amenities
<div className="amenities-grid">
  <div className="amenity">
    <WifiIcon size="lg" className="text-primary" />
    <span>Free WiFi</span>
  </div>
  <div className="amenity">
    <PoolIcon size="lg" className="text-blue-500" />
    <span>Swimming Pool</span>
  </div>
  <div className="amenity">
    <ParkingIcon size="lg" className="text-gray-700" />
    <span>Free Parking</span>
  </div>
  <div className="amenity">
    <AirConditioningIcon size="lg" className="text-cyan-500" />
    <span>Air Conditioning</span>
  </div>
  <div className="amenity">
    <KitchenIcon size="lg" className="text-orange-500" />
    <span>Full Kitchen</span>
  </div>
</div>
```

## Attractions (76 icons)

Icons for tourism attractions and points of interest in the Litoral region.

**Usage Context:** Tourism guides, attraction listings, destination content

### Cultural Attractions (19 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Amphitheater | `AmphitheaterIcon` | Outdoor theater, performances |
| Archaeological Site | `ArchaeologicalSiteIcon` | Historical excavations |
| Ballroom | `BallroomIcon` | Dance hall, events |
| Carnaval Headquarters | `CarnavalHeadquartersIcon` | Carnival center |
| Carnaval Museum | `CarnavalMuseumIcon` | Carnival museum |
| Carnaval Venue | `CarnavalVenueIcon` | Carnival location |
| Carnaval Workshop | `CarnavalWorkshopIcon` | Carnival preparation |
| Cathedral | `CathedralIcon` | Religious buildings |
| Colonial Church | `ColonialChurchIcon` | Historic churches |
| Cultural Center | `CulturalCenterIcon` | Cultural activities |
| Historic House | `HistoricHouseIcon` | Heritage buildings |
| Historic Monument | `HistoricMonumentIcon` | Monuments, memorials |
| Historic Museum | `HistoricMuseumIcon` | History museums |
| Historic Palace | `HistoricPalaceIcon` | Historic mansions |
| Interpretation Center | `InterpretationCenterIcon` | Educational centers |
| Museum | `MuseumIcon` | General museums |
| Regional Museum | `RegionalMuseumIcon` | Local history |
| Event Center | `EventCenterIcon` | Event venues |
| Government Building | `GovernmentBuildingIcon` | Official buildings |

### Natural Attractions (10 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Beach | `BeachIcon` | Beach areas |
| Bird Watching | `BirdWatchingIcon` | Bird observation |
| Municipal Beach | `MunicipalBeachIcon` | Public beaches |
| Natural Reserve | `NaturalReserveIcon` | Protected areas |
| Natural Spa | `NaturalSpaIcon` | Thermal springs |
| Nature Reserve | `NatureReserveIcon` | Conservation areas |
| Park | `ParkIcon` | Public parks |
| Protected Area | `ProtectedAreaIcon` | Protected zones |
| River Beach | `RiverBeachIcon` | River beaches |
| Wetlands | `WetlandsIcon` | Wetland areas |

### Sports & Recreation (15 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Athletics Track | `AthleticsTrackIcon` | Running tracks |
| Fishing Pier | `FishingPierIcon` | Fishing locations |
| Gaming Plaza | `GamingPlazaIcon` | Gaming areas |
| Multisport Complex | `MultisportComplexIcon` | Sports facilities |
| Municipal Gym | `MunicipalGymIcon` | Public gym |
| Municipal Stadium | `MunicipalStadiumIcon` | Stadiums |
| Recreational Boating | `RecreationalBoatingIcon` | Boat activities |
| River Kayak | `RiverKayakIcon` | Kayaking |
| Soccer Field | `SoccerFieldIcon` | Soccer facilities |
| Sport Fishing | `SportFishingIcon` | Sport fishing |
| Sports Center | `SportsCenterIcon` | Sports venues |
| Sports Complex | `SportsComplexIcon` | Multi-sport venues |
| Thermal Aqua Park | `ThermalAquaParkIcon` | Water parks |
| Thermal Pools | `ThermalPoolsIcon` | Thermal baths |
| Thermal Spa | `ThermalSpaIcon` | Spa facilities |

### Gastronomy & Shopping (8 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Artisanal Cheese | `ArtisanalCheeseIcon` | Local cheese |
| Crafts Fair | `CraftsFairIcon` | Artisan markets |
| Creole Inn | `CreoleInnIcon` | Traditional inns |
| Gastronomic Market | `GastronomicMarketIcon` | Food markets |
| Restaurant | `RestaurantIcon` | Dining venues |
| Shopping Center | `ShoppingCenterIcon` | Shopping malls |
| Traditional Bakery | `TraditionalBakeryIcon` | Local bakeries |
| Traditional Grill | `TraditionalGrillIcon` | BBQ restaurants |
| Traditional Pub | `TraditionalPubIcon` | Local bars |

### Agriculture & Rural (7 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Agricultural Center | `AgriculturalCenterIcon` | Farm centers |
| Citrus Plantation | `CitrusPlantationIcon` | Orange groves |
| Citrus Tour | `CitrusTourIcon` | Farm tours |
| Dairy Production | `DairyProductionIcon` | Dairy farms |
| Educational Farm | `EducationalFarmIcon` | Farm education |
| Tourist Ranch | `TouristRanchIcon` | Rural tourism |
| Aviarium | `AviariumIcon` | Bird facilities |

### Entertainment & Nightlife (4 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Casino | `CasinoIcon` | Gaming venues |
| Local Disco | `LocalDiscoIcon` | Nightclubs |
| Municipal Cinema | `MunicipalCinemaIcon` | Movie theaters |
| Wellness Center | `WellnessCenterIcon` | Health centers |

### Urban & Public Spaces (13 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Central Area | `CentralAreaIcon` | City center |
| Childrens Playground | `ChildrensPlaygroundIcon` | Play areas |
| Commercial Zone | `CommercialZoneIcon` | Shopping districts |
| Delta Explorer | `DeltaExplorerIcon` | Delta tours |
| Festival Plaza | `FestivalPlazaIcon` | Event plazas |
| Main Square | `MainSquareIcon` | Town squares |
| Municipal Park | `MunicipalParkIcon` | City parks |
| Navigable Channel | `NavigableChannelIcon` | Water channels |
| Pedestrian Walkway | `PedestrianWalkwayIcon` | Walking paths |
| Tourist Pier | `TouristPierIcon` | Tourist docks |

**Example Usage:**

```tsx
import {
  BeachIcon,
  MuseumIcon,
  RestaurantIcon,
  ParkIcon,
  ThermalSpaIcon
} from '@repo/icons';

// Display nearby attractions
<section className="attractions">
  <h3>Nearby Attractions</h3>
  <ul className="attraction-list">
    <li>
      <BeachIcon size="md" />
      <div>
        <h4>Playa Sol</h4>
        <p>2 km away</p>
      </div>
    </li>
    <li>
      <MuseumIcon size="md" />
      <div>
        <h4>Museo Regional</h4>
        <p>1.5 km away</p>
      </div>
    </li>
    <li>
      <RestaurantIcon size="md" />
      <div>
        <h4>Parrilla Don José</h4>
        <p>500m away</p>
      </div>
    </li>
  </ul>
</section>
```

## Booking (16 icons)

Icons for reservation and booking status representation.

**Usage Context:** Booking forms, status displays, reservation management

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Available | `AvailableIcon` | Available dates, open slots |
| Available Booking | `AvailableBookingIcon` | Availability status |
| Cancelled | `CancelledIcon` | Cancelled status |
| Cancelled Booking | `CancelledBookingIcon` | Cancelled reservation |
| Check In | `CheckInIcon` | Check-in process |
| Check In Booking | `CheckInBookingIcon` | Guest arrival |
| Check Out | `CheckOutIcon` | Check-out process |
| Check Out Booking | `CheckOutBookingIcon` | Guest departure |
| Confirmed | `ConfirmedIcon` | Confirmed status |
| Confirmed Booking | `ConfirmedBookingIcon` | Confirmed reservation |
| Guests | `GuestsIcon` | Guest count |
| Guests Booking | `GuestsBookingIcon` | Guest information |
| Pending | `PendingIcon` | Pending status |
| Pending Booking | `PendingBookingIcon` | Awaiting confirmation |
| Reserve | `ReserveIcon` | Make reservation |
| Reserve Booking | `ReserveBookingIcon` | Reservation action |
| Rooms | `RoomsIcon` | Room selection |
| Rooms Booking | `RoomsBookingIcon` | Room details |
| Unavailable | `UnavailableIcon` | Unavailable dates |
| Unavailable Booking | `UnavailableBookingIcon` | Blocked dates |

**Example Usage:**

```tsx
import {
  ConfirmedBookingIcon,
  PendingBookingIcon,
  CancelledBookingIcon,
  CheckInIcon,
  CheckOutIcon
} from '@repo/icons';

// Booking status badge
function BookingStatus({ status }: { status: string }) {
  const statusConfig = {
    confirmed: {
      icon: ConfirmedBookingIcon,
      label: 'Confirmed',
      className: 'text-green-600'
    },
    pending: {
      icon: PendingBookingIcon,
      label: 'Pending',
      className: 'text-yellow-600'
    },
    cancelled: {
      icon: CancelledBookingIcon,
      label: 'Cancelled',
      className: 'text-red-600'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${config.className}`}>
      <Icon size="sm" />
      <span>{config.label}</span>
    </div>
  );
}
```

## Communication (7 icons)

Icons for communication and contact methods.

**Usage Context:** Contact forms, support channels, messaging features

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Chat | `ChatIcon` | Live chat, messaging |
| Contacto | `ContactoIcon` | Contact information |
| Email | `EmailIcon` | Email communication |
| Language | `LanguageIcon` | Language selection |
| Newsletter | `NewsletterIcon` | Newsletter subscription |
| Phone | `PhoneIcon` | Phone contact |
| SMS | `SmsIcon` | Text messaging |

**Example Usage:**

```tsx
import { EmailIcon, PhoneIcon, ChatIcon, WhatsappIcon } from '@repo/icons';

<div className="contact-methods">
  <h3>Contact Us</h3>
  <div className="contact-grid">
    <a href="mailto:info@hospeda.com" className="contact-item">
      <EmailIcon size="lg" />
      <span>Email</span>
    </a>
    <a href="tel:+543445123456" className="contact-item">
      <PhoneIcon size="lg" />
      <span>Phone</span>
    </a>
    <button className="contact-item">
      <ChatIcon size="lg" />
      <span>Live Chat</span>
    </button>
    <a href="https://wa.me/543445123456" className="contact-item">
      <WhatsappIcon size="lg" />
      <span>WhatsApp</span>
    </a>
  </div>
</div>
```

## Entities (13 icons)

Icons representing core business entities in the Hospeda platform.

**Usage Context:** Navigation, entity selection, content type indicators

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Accommodation | `AccommodationIcon` | Lodging, properties |
| Content | `ContentIcon` | Content management |
| Coupons | `CouponsIcon` | Discount coupons |
| Destination | `DestinationIcon` | Travel destinations |
| Event | `EventIcon` | Events, activities |
| Event Location | `EventLocationIcon` | Event venues |
| Event Organizer | `EventOrganizerIcon` | Event organizers |
| Offers | `OffersIcon` | Special offers |
| Permission | `PermissionIcon` | Access permissions |
| Post | `PostIcon` | Blog posts, articles |
| Post Sponsor | `PostSponsorIcon` | Sponsored content |
| Post Sponsorship | `PostSponsorshipIcon` | Sponsorship management |
| Promotions | `PromotionsIcon` | Promotional content |

**Example Usage:**

```tsx
import {
  AccommodationIcon,
  EventIcon,
  DestinationIcon,
  OffersIcon
} from '@repo/icons';

// Content type selector
<nav className="entity-nav">
  <button>
    <AccommodationIcon size="md" />
    <span>Accommodations</span>
  </button>
  <button>
    <EventIcon size="md" />
    <span>Events</span>
  </button>
  <button>
    <DestinationIcon size="md" />
    <span>Destinations</span>
  </button>
  <button>
    <OffersIcon size="md" />
    <span>Special Offers</span>
  </button>
</nav>
```

## Features (60 icons)

Icons for property characteristics and special features.

**Usage Context:** Property details, feature highlights, accommodation attributes

### Accessibility & Safety (5 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Accessibility Friendly | `AccessibilityFriendlyIcon` | Wheelchair access |
| Perimeter Fence | `PerimeterFenceIcon` | Fenced property |
| Perimeter Lighting | `PerimeterLightingIcon` | Security lighting |
| Security 24h | `Security24hIcon` | 24-hour security |
| Self Check In | `SelfCheckInIcon` | Contactless check-in |

### Guest Types (6 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Adults Only | `AdultsOnlyIcon` | Adults-only policy |
| Couples Friendly | `CouplesFriendlyIcon` | Romantic getaways |
| Family Suitable | `FamilySuitableIcon` | Family-friendly |
| Group Friendly | `GroupFriendlyIcon` | Group accommodations |
| LGBTQ Friendly | `LGBTQFriendlyIcon` | LGBTQ-welcoming |
| Senior Friendly | `SeniorFriendlyIcon` | Senior-friendly |

### Property Type (8 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Camping Area | `CampingAreaIcon` | Camping facilities |
| Camping Sector | `CampingSectorIcon` | Camping zones |
| Entire Property | `EntirePropertyIcon` | Whole property rental |
| Internal Parking | `InternalParkingIcon` | On-site parking |
| Room Rental | `RoomRentalIcon` | Individual rooms |
| Shared Space | `SharedSpaceIcon` | Common areas |
| Themed Rooms | `ThemedRoomsIcon` | Themed accommodations |

### Location & Environment (10 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Central Area | `CentralAreaIcon` | Central location |
| Isolated Location | `IsolatedLocationIcon` | Remote location |
| Natural Environment | `NaturalEnvironmentIcon` | Nature setting |
| Panoramic View | `PanoramicViewIcon` | Scenic views |
| Quiet Environment | `QuietEnvironmentIcon` | Peaceful setting |
| Quiet Zone | `QuietZoneIcon` | Noise restrictions |
| Residential Area | `ResidentialAreaIcon` | Neighborhood setting |
| River Front | `RiverFrontIcon` | Waterfront property |
| Rural Area | `RuralAreaIcon` | Countryside location |
| Spa Front | `SpaFrontIcon` | Spa location |

### Style & Design (4 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Minimalist Style | `MinimalistStyleIcon` | Modern minimalist |
| Modern Style | `ModernStyleIcon` | Contemporary design |
| Rustic Style | `RusticStyleIcon` | Rustic charm |
| Smart Home | `SmartHomeIcon` | Smart technology |

### Eco-Friendly (7 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Eco Construction | `EcoConstructionIcon` | Sustainable building |
| Ecological | `EcologicalIcon` | Eco-friendly practices |
| Plastic Free | `PlasticFreeIcon` | No single-use plastic |
| Rainwater Harvesting | `RainwaterHarvestingIcon` | Water conservation |
| Renewable Energy | `RenewableEnergyIcon` | Solar/wind energy |
| Waste Recycling | `WasteRecyclingIcon` | Recycling program |

### Activities & Services (10 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Animal Activities | `AnimalActivitiesIcon` | Animal interactions |
| Animal Pen | `AnimalPenIcon` | Farm animals |
| Bilingual Service | `BilingualServiceIcon` | Multilingual staff |
| Digital Detox | `DigitalDetoxIcon` | Technology-free |
| Local Crafts | `LocalCraftsIcon` | Artisan products |
| Organized Activities | `OrganizedActivitiesIcon` | Activity programs |
| Own Production | `OwnProductionIcon` | Homegrown products |
| Professional Staff | `ProfessionalStaffIcon` | Trained personnel |
| Rural Activities | `RuralActivitiesIcon` | Farm activities |
| Tourist Info | `TouristInfoIcon` | Tourist information |

### Pet-Friendly (2 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Pet Area | `PetAreaIcon` | Pet facilities |
| Pet Friendly | `PetFriendlyIcon` | Pets allowed |

### Access & Infrastructure (8 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Covered Gallery | `CoveredGalleryIcon` | Covered walkways |
| Fire Pit Area | `FirePitAreaIcon` | Outdoor fire area |
| Gravel Access | `GravelAccessIcon` | Gravel road access |
| No Cell Signal | `NoCellSignalIcon` | Limited connectivity |
| Paved Access | `PavedAccessIcon` | Paved road access |
| Private Grill | `PrivateGrillIcon` | Private BBQ |
| Smoking Area | `SmokingAreaIcon` | Designated smoking |

### Special Features (4 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Minimum Stay | `MinimumStayIcon` | Minimum night requirement |

**Example Usage:**

```tsx
import {
  EcologicalIcon,
  PetFriendlyIcon,
  FamilySuitableIcon,
  PanoramicViewIcon,
  SelfCheckInIcon
} from '@repo/icons';

// Property feature highlights
<div className="features">
  <h3>Property Features</h3>
  <div className="feature-tags">
    <span className="feature-tag">
      <EcologicalIcon size="sm" />
      Eco-Friendly
    </span>
    <span className="feature-tag">
      <PetFriendlyIcon size="sm" />
      Pet Friendly
    </span>
    <span className="feature-tag">
      <FamilySuitableIcon size="sm" />
      Family Suitable
    </span>
    <span className="feature-tag">
      <PanoramicViewIcon size="sm" />
      Panoramic View
    </span>
    <span className="feature-tag">
      <SelfCheckInIcon size="sm" />
      Self Check-In
    </span>
  </div>
</div>
```

## Navigation (14 icons)

Icons for application navigation and user interface controls.

**Usage Context:** Menus, navigation bars, pagination, breadcrumbs

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Breadcrumbs | `BreadcrumbsIcon` | Breadcrumb navigation |
| Close | `CloseIcon` | Close dialogs, dismiss |
| Dropdown | `DropdownIcon` | Dropdown menus |
| First Page | `FirstPageIcon` | Jump to first page |
| Hamburger | `HamburgerIcon` | Mobile menu toggle |
| Home | `HomeIcon` | Homepage navigation |
| Last Page | `LastPageIcon` | Jump to last page |
| Load More | `LoadMoreIcon` | Load additional content |
| Menu | `MenuIcon` | Navigation menu |
| Next | `NextIcon` | Next page/item |
| Previous | `PreviousIcon` | Previous page/item |
| Refresh | `RefreshIcon` | Reload content |
| Search | `SearchIcon` | Search functionality |

**Example Usage:**

```tsx
import {
  HomeIcon,
  SearchIcon,
  MenuIcon,
  CloseIcon,
  RefreshIcon
} from '@repo/icons';

// Main navigation
<header>
  <nav className="navbar">
    <button className="menu-toggle">
      <MenuIcon size="md" />
    </button>

    <div className="nav-links">
      <a href="/">
        <HomeIcon size="sm" />
        Home
      </a>
      <button onClick={handleSearch}>
        <SearchIcon size="sm" />
        Search
      </button>
    </div>

    <button onClick={handleRefresh}>
      <RefreshIcon size="sm" />
    </button>
  </nav>
</header>

// Pagination
<div className="pagination">
  <button>
    <FirstPageIcon size="sm" />
  </button>
  <button>
    <PreviousIcon size="sm" />
  </button>
  <span>Page 1 of 10</span>
  <button>
    <NextIcon size="sm" />
  </button>
  <button>
    <LastPageIcon size="sm" />
  </button>
</div>
```

## Social (4 icons)

Icons for social media integration and sharing.

**Usage Context:** Social links, share buttons, social profiles

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Facebook | `FacebookIcon` | Facebook profile/sharing |
| Instagram | `InstagramIcon` | Instagram profile/sharing |
| Web | `WebIcon` | Website link |
| Whatsapp | `WhatsappIcon` | WhatsApp contact/sharing |

**Example Usage:**

```tsx
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  WebIcon
} from '@repo/icons';

// Social media links
<div className="social-links">
  <a
    href="https://facebook.com/hospeda"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Facebook"
  >
    <FacebookIcon size="lg" className="hover:text-blue-600" />
  </a>
  <a
    href="https://instagram.com/hospeda"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Instagram"
  >
    <InstagramIcon size="lg" className="hover:text-pink-600" />
  </a>
  <a
    href="https://wa.me/543445123456"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="WhatsApp"
  >
    <WhatsappIcon size="lg" className="hover:text-green-600" />
  </a>
  <a
    href="https://hospeda.com"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Website"
  >
    <WebIcon size="lg" className="hover:text-gray-600" />
  </a>
</div>

// Share buttons
<div className="share-options">
  <button onClick={shareOnFacebook}>
    <FacebookIcon size="md" />
    Share
  </button>
  <button onClick={shareOnWhatsapp}>
    <WhatsappIcon size="md" />
    Send
  </button>
</div>
```

## System (52 icons)

Core system and UI icons for general application functionality.

**Usage Context:** Forms, controls, system features, UI elements

### User & Authentication (6 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Admin | `AdminIcon` | Administrator access |
| Huesped | `HuespedIcon` | Guest (single) |
| Huespedes | `HuespedesIcon` | Guests (plural) |
| Logout | `LogoutIcon` | Sign out |
| User | `UserIcon` | User profile |
| Users | `UsersIcon` | Multiple users |

### Navigation & View (9 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Column | `ColumnIcon` | Column view |
| Fullscreen | `FullscreenIcon` | Fullscreen mode |
| Gallery | `GalleryIcon` | Gallery view |
| Map | `MapIcon` | Map view |
| Minimize | `MinimizeIcon` | Minimize window |
| Zoom In | `ZoomInIcon` | Zoom in |
| Zoom Out | `ZoomOutIcon` | Zoom out |

### Media & Content (5 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Audio | `AudioIcon` | Audio content |
| Document | `DocumentIcon` | Document files |
| Excel | `ExcelIcon` | Excel/spreadsheet files |
| PDF | `PdfIcon` | PDF documents |
| Video | `VideoIcon` | Video content |

### Actions & Controls (9 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Add | `AddIcon` | Add new items |
| Configuration | `ConfigurationIcon` | Configuration settings |
| Create | `CreateIcon` | Create new content |
| Debug | `DebugIcon` | Debugging, troubleshooting |
| Filter | `FilterIcon` | Filter results |
| Settings | `SettingsIcon` | Application settings |
| Sort | `SortIcon` | Sort data |

### Status & Notifications (5 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Alerts | `AlertsIcon` | System alerts |
| Alert Triangle | `AlertTriangleIcon` | Warning messages |
| Favorite | `FavoriteIcon` | Favorite items |
| Loader | `LoaderIcon` | Loading state |
| Notification | `NotificationIcon` | Notifications |
| Star | `StarIcon` | Ratings, favorites |

### Data & Information (9 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Address | `AddressIcon` | Location address |
| Calendar | `CalendarIcon` | Date selection |
| Date | `DateIcon` | Date display |
| Location | `LocationIcon` | Geographic location |
| Price | `PriceIcon` | Pricing information |

### Theme & Display (2 icons)

| Icon Name | Component Name | Common Usage |
|-----------|---------------|--------------|
| Dark Theme | `DarkThemeIcon` | Dark mode toggle |
| Light Theme | `LightThemeIcon` | Light mode toggle |

**Example Usage:**

```tsx
import {
  UserIcon,
  SettingsIcon,
  NotificationIcon,
  CalendarIcon,
  LocationIcon,
  StarIcon,
  FilterIcon,
  SortIcon
} from '@repo/icons';

// User menu
<div className="user-menu">
  <button>
    <UserIcon size="md" />
    Profile
  </button>
  <button>
    <SettingsIcon size="md" />
    Settings
  </button>
  <button>
    <NotificationIcon size="md" />
    Notifications
    <span className="badge">3</span>
  </button>
</div>

// Search filters
<div className="search-filters">
  <div className="filter-group">
    <CalendarIcon size="sm" />
    <input type="date" placeholder="Check-in" />
  </div>
  <div className="filter-group">
    <LocationIcon size="sm" />
    <input type="text" placeholder="Location" />
  </div>
  <div className="filter-buttons">
    <button>
      <FilterIcon size="sm" />
      Filters
    </button>
    <button>
      <SortIcon size="sm" />
      Sort
    </button>
  </div>
</div>

// Rating display
<div className="rating">
  {[1, 2, 3, 4, 5].map((star) => (
    <StarIcon
      key={star}
      size="sm"
      className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
    />
  ))}
</div>
```

## Utilities (20 icons)

**Note:** This section is reserved for utility icons that don't fit into the main categories above. Based on the current icon structure, utility icons are distributed across other categories (System, Actions, Navigation).

## Cross-Reference Guide

### Finding Icons by Use Case

#### Accommodation Listings

- **Core Info**: `AccommodationIcon`, `LocationIcon`, `PriceIcon`, `GuestsIcon`
- **Amenities**: `WifiIcon`, `PoolIcon`, `ParkingIcon`, `KitchenIcon`
- **Features**: `PetFriendlyIcon`, `FamilySuitableIcon`, `EcologicalIcon`

#### Booking Flow

- **Search**: `SearchIcon`, `CalendarIcon`, `LocationIcon`, `FilterIcon`
- **Status**: `AvailableIcon`, `ConfirmedBookingIcon`, `PendingBookingIcon`
- **Actions**: `ReserveIcon`, `CheckInIcon`, `CheckOutIcon`

#### Tourism Content

- **Attractions**: `BeachIcon`, `MuseumIcon`, `ParkIcon`, `RestaurantIcon`
- **Activities**: `SportFishingIcon`, `BirdWatchingIcon`, `ThermalSpaIcon`
- **Culture**: `CulturalCenterIcon`, `HistoricMuseumIcon`, `FestivalPlazaIcon`

#### Admin Dashboard

- **Overview**: `DashboardIcon`, `AnalyticsIcon`, `MetricsIcon`
- **Management**: `UsersManagementIcon`, `PermissionsIcon`, `RolesIcon`
- **Data**: `ReportsIcon`, `StatisticsIcon`, `LogsIcon`

#### User Interface

- **Navigation**: `HomeIcon`, `MenuIcon`, `SearchIcon`, `CloseIcon`
- **Actions**: `AddIcon`, `EditIcon`, `DeleteIcon`, `SaveIcon`
- **Controls**: `FilterIcon`, `SortIcon`, `RefreshIcon`

## Related Documentation

- **[Usage Guide](../guides/usage-guide.md)** - Detailed usage patterns and examples
- **[Usage Reference](./usage-reference.md)** - Complete API documentation
- **[Integration Guide](../guides/integration-guide.md)** - Framework integration
- **[Accessibility Guide](../guides/accessibility-guide.md)** - Accessibility best practices
- **[Performance Guide](../guides/performance-guide.md)** - Optimization techniques

## Icon Search Index

For quick searching, here are all 386 icons alphabetically:

- AccessibilityFriendlyIcon
- AccommodationIcon
- AddIcon
- AddressIcon
- AdminIcon
- AdultsOnlyIcon
- AgriculturalCenterIcon
- AirConditioningIcon
- AlertsIcon
- AlertTriangleIcon
- AmphitheaterIcon
- AnalyticsIcon
- AnimalActivitiesIcon
- AnimalPenIcon
- ArchaeologicalSiteIcon
- ArtisanalCheeseIcon
- AskToAiIcon
- AthleticsTrackIcon
- AudioIcon
- AvailableBookingIcon
- AvailableIcon
- AviariumIcon
- BabyMonitorIcon
- BackupIcon
- BalconyIcon
- BallroomIcon
- BarServiceIcon
- BbqGrillIcon
- BeachEquipmentIcon
- BeachIcon
- BeachUmbrellaIcon
- BedLinensIcon
- BicyclesIcon
- BilingualServiceIcon
- BirdWatchingIcon
- BlackoutCurtainsIcon
- BoardGamesIcon
- BooksAndMagazinesIcon
- BreadcrumbsIcon
- BreakfastIcon
- BroomIcon
- CalendarIcon
- CampingAreaIcon
- CampingSectorIcon
- CancelIcon
- CancelledBookingIcon
- CancelledIcon
- CarnavalHeadquartersIcon
- CarnavalMuseumIcon
- CarnavalVenueIcon
- CarnavalWorkshopIcon
- CasinoIcon
- CathedralIcon
- CentralAreaIcon
- ChatIcon
- CheckInBookingIcon
- CheckInIcon
- CheckOutBookingIcon
- CheckOutIcon
- ChildrensPlaygroundIcon
- CitrusPlantationIcon
- CitrusTourIcon
- ClockIcon
- CloseIcon
- CoffeeMakerIcon
- ColonialChurchIcon
- ColumnIcon
- CommercialZoneIcon
- ConfigurationIcon
- ConfirmIcon
- ConfirmedBookingIcon
- ConfirmedIcon
- ContactoIcon
- ContentIcon
- CopyIcon
- CouplesFriendlyIcon
- CouponsIcon
- CoveredGalleryIcon
- CoveredGrillAreaIcon
- CoveredParkingIcon
- CoworkingSpaceIcon
- CraftsFairIcon
- CreateIcon
- CreoleInnIcon
- CulturalCenterIcon
- DailyCleaningIcon
- DairyProductionIcon
- DarkThemeIcon
- DashboardIcon
- DateIcon
- DebugIcon
- DeleteIcon
- DeltaExplorerIcon
- DestinationIcon
- DigitalDetoxIcon
- DockAccessIcon
- DocumentIcon
- DoubleGlazingIcon
- DownloadIcon
- DropdownIcon
- EcoConstructionIcon
- EcologicalIcon
- EditIcon
- EducationalFarmIcon
- ElectricBlanketIcon
- ElectricFireplaceIcon
- ElevatorIcon
- EmailIcon
- EntirePropertyIcon
- EventCenterIcon
- EventIcon
- EventLocationIcon
- EventOrganizerIcon
- ExcelIcon
- ExportIcon
- FacebookIcon
- FamilySuitableIcon
- FamilyThermalIcon
- FanIcon
- FaqsIcon
- FavoriteIcon
- FestivalPlazaIcon
- FilterIcon
- FireExtinguisherIcon
- FirePitAreaIcon
- FireplaceIcon
- FirstAidKitIcon
- FirstPageIcon
- FishingEquipmentIcon
- FishingPierIcon
- FullBoardIcon
- FullscreenIcon
- GalleryIcon
- GamingPlazaIcon
- GastronomicMarketIcon
- GovernmentBuildingIcon
- GravelAccessIcon
- GroupFriendlyIcon
- GuestsBookingIcon
- GuestsIcon
- GymIcon
- HairDryerIcon
- HamburgerIcon
- HeatedPoolIcon
- HeatingIcon
- HighChairIcon
- HistoricHouseIcon
- HistoricMonumentIcon
- HistoricMuseumIcon
- HistoricPalaceIcon
- HomeIcon
- HuespedIcon
- HuespedesIcon
- ImportIcon
- InstagramIcon
- InternalParkingIcon
- InternationalAdaptersIcon
- InterpretationCenterIcon
- IsolatedLocationIcon
- JacuzziIcon
- KayakRentalIcon
- KettleIcon
- KidsGamesIcon
- KitchenIcon
- LanguageIcon
- LastPageIcon
- LaundryServiceIcon
- LGBTQFriendlyIcon
- LightThemeIcon
- ListIcon
- LoaderIcon
- LoadMoreIcon
- LocalCraftsIcon
- LocalDiscoIcon
- LocationIcon
- LogoutIcon
- LogsIcon
- LuggageStorageIcon
- MainSquareIcon
- MapIcon
- MenuIcon
- MetricsIcon
- MicrowaveIcon
- MiniBarIcon
- MinimalistStyleIcon
- MinimizeIcon
- MinimumStayIcon
- ModernStyleIcon
- MonitoringIcon
- MotorhomeParkingIcon
- MultisportComplexIcon
- MunicipalBeachIcon
- MunicipalCinemaIcon
- MunicipalGymIcon
- MunicipalParkIcon
- MunicipalStadiumIcon
- MuseumIcon
- NaturalEnvironmentIcon
- NaturalReserveIcon
- NaturalSpaIcon
- NatureReserveIcon
- NavigableChannelIcon
- NewsletterIcon
- NextIcon
- NoCellSignalIcon
- NotificationIcon
- OffersIcon
- OrganicGardenIcon
- OrganizedActivitiesIcon
- OutdoorFurnitureIcon
- OutdoorKitchenIcon
- OutdoorLightingIcon
- OwnProductionIcon
- PanoramicViewIcon
- ParkIcon
- ParkingIcon
- PavedAccessIcon
- PdfIcon
- PedestrianWalkwayIcon
- PendingBookingIcon
- PendingIcon
- PerimeterFenceIcon
- PerimeterLightingIcon
- PermissionIcon
- PermissionsIcon
- PetAllowedIcon
- PetAreaIcon
- PetFriendlyIcon
- PhoneIcon
- PlasticFreeIcon
- PlaygroundIcon
- PoolIcon
- PostIcon
- PostSponsorIcon
- PostSponsorshipIcon
- PreviousIcon
- PriceIcon
- PrintIcon
- PrivateGardenIcon
- PrivateGrillIcon
- PrivateViewpointIcon
- ProfessionalStaffIcon
- PromotionsIcon
- ProtectedAreaIcon
- QuietEnvironmentIcon
- QuietZoneIcon
- RainwaterHarvestingIcon
- Reception24hIcon
- RecreationalBoatingIcon
- RefreshIcon
- RefrigeratorIcon
- RegionalMuseumIcon
- RelaxationAreaIcon
- RenewableEnergyIcon
- ReportsIcon
- ReserveBookingIcon
- ReserveIcon
- ResidentialAreaIcon
- RestaurantIcon
- RiverBeachIcon
- RiverFrontIcon
- RiverKayakIcon
- RiverViewIcon
- RolesIcon
- RoomRentalIcon
- RoomServiceIcon
- RoomTvIcon
- RoomsBookingIcon
- RoomsIcon
- RuralActivitiesIcon
- RuralAreaIcon
- RusticStyleIcon
- SafeIcon
- SaunaIcon
- SaveIcon
- SearchIcon
- SectionIcon
- SecureParkingIcon
- Security24hIcon
- SelfCheckInIcon
- SeniorFriendlyIcon
- SettingsIcon
- SharedKitchenIcon
- SharedPatioIcon
- SharedSpaceIcon
- ShareIcon
- ShirtIcon
- ShoppingCenterIcon
- ShoppingServiceIcon
- SmartHomeIcon
- SmartTvIcon
- SmokeDetectorIcon
- SmokingAreaIcon
- SmsIcon
- SoapDispenserIcon
- SoccerFieldIcon
- SolarShowersIcon
- SortIcon
- SpaFrontIcon
- SpaServicesIcon
- SportFishingIcon
- SportsCenterIcon
- SportsComplexIcon
- StarIcon
- StatisticsIcon
- StoveIcon
- SynchronizeIcon
- TagIcon
- TagsIcon
- TerraceIcon
- ThemedRoomsIcon
- ThermalAquaParkIcon
- ThermalPoolsIcon
- ThermalSpaIcon
- TouristInfoIcon
- TouristPierIcon
- TouristRanchIcon
- TowelsIcon
- TraditionalBakeryIcon
- TraditionalGrillIcon
- TraditionalPubIcon
- TransferServiceIcon
- TvIcon
- UnavailableBookingIcon
- UnavailableIcon
- UnderfloorHeatingIcon
- UploadIcon
- UserIcon
- UsersIcon
- UsersManagementIcon
- UtensilsIcon
- VideoIcon
- ViewAllIcon
- WalkingTrailIcon
- WasherIcon
- WasteRecyclingIcon
- WaterDispenserIcon
- WebIcon
- WellnessCenterIcon
- WetlandsIcon
- WhatsappIcon
- WifiIcon
- WorkshopSpaceIcon
- YogaMeditationIcon
- ZoomInIcon
- ZoomOutIcon

---

**Need help finding an icon?** Check the [Usage Guide](../guides/usage-guide.md) for patterns and examples, or browse by category above.
