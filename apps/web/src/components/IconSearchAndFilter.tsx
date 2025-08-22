import type { IconProps } from '@repo/icons';
import * as Icons from '@repo/icons';
import { SearchIcon } from '@repo/icons';
import React, { useMemo, useState } from 'react';

// Mapa de traducción inglés → español para búsqueda
const iconTranslations: Record<string, string[]> = {
    // Entidades
    AccommodationIcon: ['alojamiento', 'hospedaje', 'hotel', 'cabaña', 'hostel'],
    ContentIcon: ['contenido'],
    CouponsIcon: ['cupones', 'descuentos', 'vales'],
    DestinationIcon: ['destino', 'lugar'],
    EventIcon: ['evento', 'actividad'],
    EventLocationIcon: ['ubicación evento', 'lugar evento'],
    EventOrganizerIcon: ['organizador evento'],
    OffersIcon: ['ofertas', 'promociones'],
    PermissionIcon: ['permiso', 'autorización'],
    PostIcon: ['publicación', 'artículo', 'blog'],
    PostSponsorIcon: ['patrocinador publicación'],
    PostSponsorshipIcon: ['patrocinio publicación'],
    PromotionsIcon: ['promociones', 'ofertas', 'descuentos'],

    // Administración
    AnalyticsIcon: ['análisis', 'estadísticas', 'métricas'],
    BackupIcon: ['respaldo', 'copia seguridad', 'backup'],
    DashboardIcon: ['panel', 'tablero', 'dashboard'],
    ListIcon: ['lista', 'listado'],
    LogsIcon: ['registros', 'logs', 'historial'],
    MetricsIcon: ['métricas', 'mediciones', 'indicadores'],
    MonitoringIcon: ['monitoreo', 'supervisión', 'vigilancia'],
    PermissionsIcon: ['permisos', 'autorizaciones'],
    ReportsIcon: ['reportes', 'informes'],
    RolesIcon: ['roles', 'funciones', 'perfiles'],
    SectionIcon: ['sección'],
    StatisticsIcon: ['estadísticas', 'gráficos', 'datos'],
    TagIcon: ['etiqueta', 'tag'],
    TagsIcon: ['etiquetas', 'tags'],
    UsersManagementIcon: ['gestión usuarios', 'administrar usuarios'],
    ViewAllIcon: ['ver todo', 'mostrar todo'],

    // Comodidades
    AirConditioningIcon: ['aire acondicionado', 'climatización'],
    BabyMonitorIcon: ['monitor bebé', 'comunicación', 'sonido', 'radio'],
    BalconyIcon: ['balcón', 'terraza'],
    BarServiceIcon: ['bar', 'servicio bar', 'bebidas', 'vino', 'copa'],
    BbqGrillIcon: ['parrilla', 'asado', 'barbacoa'],
    BeachEquipmentIcon: ['equipo playa', 'sombrilla', 'playa', 'paraguas'],
    BedLinensIcon: ['ropa de cama', 'sábanas'],
    BicyclesIcon: ['bicicletas', 'bicis'],
    BlackoutCurtainsIcon: ['cortinas blackout', 'cortinas opacas'],
    BoardGamesIcon: ['juegos mesa', 'entretenimiento', 'juegos', 'dado'],
    BooksAndMagazinesIcon: ['libros', 'revistas', 'lectura', 'entretenimiento'],
    BreakfastIcon: ['desayuno'],
    BroomIcon: ['escoba', 'limpieza', 'aseo'],
    ClockIcon: ['reloj', 'tiempo', 'horario'],
    CoffeeMakerIcon: ['cafetera', 'café'],
    CoveredGrillAreaIcon: ['área parrilla cubierta', 'parrilla techada', 'asador cubierto'],
    CoworkingSpaceIcon: ['coworking', 'espacio trabajo', 'oficina', 'laptop'],
    CoveredParkingIcon: ['estacionamiento cubierto', 'garaje', 'parking techado'],
    DailyCleaningIcon: ['limpieza diaria', 'aseo', 'limpieza', 'escoba'],
    DockAccessIcon: ['acceso muelle', 'puerto', 'embarcadero', 'ancla'],
    DoubleGlazingIcon: ['doble vidrio', 'ventanas', 'aislamiento', 'cuadrado'],
    ElectricBlanketIcon: ['manta eléctrica', 'frazada eléctrica'],
    ElectricFireplaceIcon: ['chimenea eléctrica'],
    ElevatorIcon: ['ascensor', 'elevador'],
    FanIcon: ['ventilador'],
    FireExtinguisherIcon: ['extintor', 'seguridad', 'incendios', 'emergencia'],
    FireplaceIcon: ['chimenea', 'hogar'],
    FirstAidKitIcon: ['botiquín', 'primeros auxilios', 'salud', 'médico', 'cruz'],
    FishingEquipmentIcon: ['equipo pesca', 'pesca', 'pescar', 'pez'],
    FullBoardIcon: ['pensión completa', 'comida completa', 'chef', 'gorro chef'],
    GymIcon: ['gimnasio', 'gym'],
    HairDryerIcon: ['secador de pelo', 'secador'],
    HeatingIcon: ['calefacción', 'calentador'],
    HighChairIcon: ['silla alta', 'asiento', 'silla'],
    InternationalAdaptersIcon: ['adaptadores internacionales', 'enchufes'],
    JacuzziIcon: ['jacuzzi', 'hidromasaje'],
    KayakRentalIcon: ['kayak', 'alquiler kayak', 'embarcación', 'navegación', 'bote'],
    KettleIcon: ['pava eléctrica', 'hervidor'],
    KidsGamesIcon: ['juegos niños', 'infantil', 'bebé', 'niños'],
    KitchenIcon: ['cocina'],
    LaundryServiceIcon: ['servicio lavandería', 'lavandería', 'ropa', 'camisa'],
    LuggageStorageIcon: ['guardaequipajes', 'equipaje', 'maleta', 'valija'],
    MicrowaveIcon: ['microondas'],
    MiniBarIcon: ['minibar', 'frigobar'],
    MotorhomeParkingIcon: [
        'estacionamiento motorhomes',
        'motorhome',
        'camión',
        'vehículos grandes'
    ],
    OutdoorLightingIcon: ['iluminación exterior', 'luz exterior', 'bombilla', 'iluminación'],
    ParkingIcon: ['estacionamiento', 'parking', 'garaje'],
    PetAllowedIcon: ['mascotas permitidas', 'pet allowed', 'animales', 'perro'],
    PlaygroundIcon: ['parque infantil', 'juegos'],
    PoolIcon: ['piscina', 'pileta'],
    PrivateViewpointIcon: ['mirador privado', 'vista privada', 'observatorio'],
    Reception24hIcon: ['recepción 24h', '24 horas', 'horario', 'reloj'],
    RefrigeratorIcon: ['refrigerador', 'heladera', 'nevera'],
    RelaxationAreaIcon: ['área relajación', 'descanso', 'relax', 'sillón'],
    RoomServiceIcon: ['servicio habitación', 'room service', 'llamada', 'campana'],
    RoomTvIcon: ['tv por habitación', 'televisión habitación'],
    SafeIcon: ['caja fuerte', 'seguridad'],
    SecureParkingIcon: ['estacionamiento seguro', 'parking seguro', 'protección', 'escudo'],
    SharedKitchenIcon: ['cocina compartida'],
    ShoppingServiceIcon: ['servicio compras', 'compras', 'shopping', 'carrito compras'],
    SmartTvIcon: ['smart tv', 'tv inteligente'],
    SmokeDetectorIcon: ['detector humo', 'seguridad', 'incendio', 'humo'],
    SoapDispenserIcon: ['dispensador jabón', 'jabón'],
    SolarShowersIcon: ['duchas solares', 'ducha solar', 'baño solar'],
    SpaServicesIcon: ['servicios spa', 'spa', 'brillos', 'relajación'],
    StoveIcon: ['cocina', 'estufa', 'hornalla'],
    TerraceIcon: ['terraza'],
    TowelsIcon: ['toallas'],
    TransferServiceIcon: ['servicio traslado', 'transfer', 'transporte'],
    TvIcon: ['televisión', 'tv'],
    UnderfloorHeatingIcon: ['calefacción suelo radiante', 'piso radiante'],
    UtensilsIcon: ['utensilios cocina', 'cubiertos', 'restaurante', 'media pensión'],
    WalkingTrailIcon: ['circuito caminata', 'sendero', 'trail', 'huellas'],
    WasherIcon: ['lavarropas', 'lavadora'],
    WaterDispenserIcon: ['dispensador agua'],
    WifiIcon: ['wifi', 'internet', 'conexión'],
    WorkshopSpaceIcon: ['espacio talleres', 'capacitación', 'aula', 'educación'],
    YogaMeditationIcon: ['yoga meditación', 'yoga', 'meditación', 'relajación'],

    // Outdoor amenities
    BeachUmbrellaIcon: ['sombrilla playa', 'sillas playa', 'parasol'],
    HeatedPoolIcon: ['piscina climatizada', 'piscina caliente', 'pileta climatizada'],
    OrganicGardenIcon: ['jardín orgánico', 'huerta orgánica', 'jardín ecológico'],
    OutdoorFurnitureIcon: ['muebles exterior', 'mobiliario exterior', 'sillas exterior'],
    OutdoorKitchenIcon: ['cocina exterior', 'parrilla exterior', 'cocina al aire libre'],
    PrivateGardenIcon: ['jardín privado', 'jardín exclusivo'],
    RiverViewIcon: ['vista al río', 'vista río', 'frente río'],
    SaunaIcon: ['sauna'],
    SharedPatioIcon: ['patio compartido', 'patio común', 'terraza compartida'],
    ShirtIcon: ['camisa', 'ropa', 'vestimenta'],

    // Características
    AccessibilityFriendlyIcon: ['accesible', 'discapacitados', 'accesibilidad', 'inclusivo'],
    AdultsOnlyIcon: ['solo adultos', 'adultos únicamente', 'sin niños'],
    AnimalActivitiesIcon: ['actividades animales', 'actividades granja', 'vaca'],
    AnimalPenIcon: ['corral animales', 'cerca animales', 'vallado'],
    BilingualServiceIcon: ['servicios bilingües', 'idiomas', 'multiidioma'],
    CampingAreaIcon: ['área camping', 'zona camping', 'acampar', 'carpa'],
    CampingSectorIcon: ['sector camping', 'zona acampar', 'carpa'],
    CentralAreaIcon: ['área central', 'zona céntrica'],
    CouplesFriendlyIcon: ['ideal parejas', 'romántico', 'pareja', 'corazón'],
    CoveredGalleryIcon: ['galería cubierta', 'galería techada', 'corredor'],
    DairyProductionIcon: ['producción láctea', 'lácteos', 'leche'],
    DigitalDetoxIcon: ['detox digital', 'sin tecnología', 'desconexión'],
    EcologicalIcon: ['ecológico', 'sustentable'],
    EcoConstructionIcon: ['construcción ecológica', 'eco construcción', 'verde', 'sustentable'],
    EntirePropertyIcon: ['propiedad completa', 'alquiler completo', 'casa entera'],
    FamilySuitableIcon: ['familiar', 'apto familias'],
    FirePitAreaIcon: ['área fogata', 'fogón', 'hoguera', 'fuego'],
    GravelAccessIcon: ['acceso ripio', 'camino ripio', 'acceso tierra'],
    GroupFriendlyIcon: ['ideal grupos', 'grupos grandes', 'amigos'],
    InternalParkingIcon: ['estacionamiento interno', 'parking interno', 'garaje interno'],
    IsolatedLocationIcon: ['ubicación aislada', 'sin vecinos', 'privado', 'aislado'],
    LGBTQFriendlyIcon: ['LGBTQ friendly', 'diversidad', 'inclusivo', 'arcoíris'],
    LocalCraftsIcon: ['artesanías locales', 'decoración artesanal', 'arte local'],
    MinimalistStyleIcon: ['estilo minimalista', 'minimalista', 'simple'],
    MinimumStayIcon: ['estadía mínima', 'mínimo noches', 'estancia mínima'],
    ModernStyleIcon: ['estilo moderno', 'contemporáneo'],
    NaturalEnvironmentIcon: ['entorno natural', 'naturaleza'],
    NoCellSignalIcon: ['sin señal celular', 'sin cobertura', 'desconectado'],
    OrganizedActivitiesIcon: ['actividades organizadas', 'eventos', 'actividades'],
    OwnProductionIcon: ['producción propia', 'cultivos propios', 'cosecha'],
    PanoramicViewIcon: ['vista panorámica', 'vista'],
    PavedAccessIcon: ['acceso pavimentado'],
    PerimeterFenceIcon: ['cerca perimetral', 'cerco', 'vallado'],
    PerimeterLightingIcon: ['iluminación perimetral', 'luces perimetrales'],
    PetAreaIcon: ['área mascotas', 'zona pet', 'espacio animales'],
    PetFriendlyIcon: ['pet friendly', 'mascotas', 'animales'],
    PlasticFreeIcon: ['libre plásticos', 'sin plásticos', 'ecológico'],
    PrivateGrillIcon: ['parrilla privada', 'asador privado', 'barbacoa privada'],
    ProfessionalStaffIcon: ['personal profesional', 'staff permanente', 'empleados'],
    QuietEnvironmentIcon: ['ambiente silencioso', 'tranquilo', 'silencioso'],
    QuietZoneIcon: ['zona silenciosa', 'área tranquila', 'sin ruido'],
    RainwaterHarvestingIcon: ['cosecha agua lluvia', 'recolección agua', 'sustentable'],
    RenewableEnergyIcon: ['energía renovable', 'sustentable'],
    ResidentialAreaIcon: ['área residencial', 'zona residencial', 'barrio'],
    RiverFrontIcon: ['frente al río', 'ribereño'],
    RoomRentalIcon: ['alquiler habitaciones', 'por habitación', 'habitaciones separadas'],
    RuralActivitiesIcon: ['actividades rurales', 'campo', 'agricultura'],
    RuralAreaIcon: ['área rural', 'campo'],
    RusticStyleIcon: ['estilo rústico'],
    Security24hIcon: ['seguridad 24h', 'vigilancia', 'seguridad'],
    SelfCheckInIcon: ['check-in autónomo', 'auto check-in', 'entrada independiente'],
    SeniorFriendlyIcon: ['ideal seniors', 'tercera edad', 'adultos mayores'],
    SharedSpaceIcon: ['espacio compartido', 'áreas comunes', 'espacios comunes'],
    SmartHomeIcon: ['casa inteligente', 'domótica'],
    SmokingAreaIcon: ['área fumadores', 'zona fumadores', 'permitido fumar'],
    SpaFrontIcon: ['frente al spa', 'spa'],
    ThemedRoomsIcon: ['habitaciones temáticas', 'cuartos temáticos', 'decoración temática'],
    TouristInfoIcon: ['información turística', 'info turística', 'guías turísticas'],
    WasteRecyclingIcon: ['reciclaje residuos', 'reciclaje', 'sustentable'],

    // Atracciones
    AgriculturalCenterIcon: ['centro agrícola', 'granja'],
    AmphitheaterIcon: ['anfiteatro'],
    ArchaeologicalSiteIcon: ['sitio arqueológico', 'arqueología', 'excavación'],
    ArtisanalCheeseIcon: ['quesería artesanal', 'quesos', 'lácteos artesanales'],
    AthleticsTrackIcon: ['pista atletismo', 'atletismo', 'pista deportiva'],
    AviariumIcon: ['aviario', 'aves'],
    BallroomIcon: ['salón baile', 'salón de fiestas', 'eventos'],
    BeachIcon: ['playa'],
    BirdWatchingIcon: ['observación aves', 'avistamiento aves', 'birdwatching'],
    CarnavalHeadquartersIcon: ['sede carnaval', 'centro carnaval', 'organización carnaval'],
    CarnavalMuseumIcon: ['museo carnaval', 'museo del carnaval', 'máscara'],
    CarnavalVenueIcon: ['corsódromo', 'carnaval', 'música', 'fiesta'],
    CarnavalWorkshopIcon: ['taller carnaval', 'taller máscaras', 'artesanía carnaval'],
    CasinoIcon: ['casino'],
    CathedralIcon: ['catedral', 'iglesia'],
    ChildrensPlaygroundIcon: ['parque infantil', 'juegos niños', 'playground'],
    CitrusPlantationIcon: ['plantación cítricos', 'naranjal', 'citrus'],
    CitrusTourIcon: ['tour citrícola', 'recorrido cítricos', 'turismo agrícola'],
    ColonialChurchIcon: ['iglesia colonial', 'iglesia histórica', 'templo'],
    CommercialZoneIcon: ['zona comercial', 'área comercial', 'shopping'],
    CraftsFairIcon: ['feria artesanal', 'artesanías', 'mercado artesanal'],
    CreoleInnIcon: ['bodegón criollo', 'restaurante criollo', 'comida típica'],
    CulturalCenterIcon: ['centro cultural'],
    DeltaExplorerIcon: ['delta explorer', 'exploración', 'aventura', 'brújula'],
    EducationalFarmIcon: ['granja educativa'],
    EventCenterIcon: ['centro eventos', 'salón eventos', 'convenciones'],
    FamilyThermalIcon: ['termas familiares', 'termas familia', 'spa familiar'],
    FestivalPlazaIcon: ['plaza festivales', 'plaza eventos', 'espacio festivales'],
    FishingPierIcon: ['muelle pesquero', 'puerto pesquero', 'pesca'],
    GamingPlazaIcon: ['plaza juegos', 'área gaming', 'entretenimiento'],
    GastronomicMarketIcon: ['mercado gastronómico', 'mercado comida', 'food court'],
    GovernmentBuildingIcon: ['edificio gubernamental', 'municipalidad', 'gobierno'],
    HistoricHouseIcon: ['casa histórica', 'casa colonial', 'patrimonio'],
    HistoricMonumentIcon: ['monumento histórico', 'monumento', 'patrimonio'],
    HistoricMuseumIcon: ['museo histórico', 'historia', 'patrimonio'],
    HistoricPalaceIcon: ['palacio histórico', 'palacio', 'residencia histórica'],
    InterpretationCenterIcon: ['centro interpretación', 'información', 'educativo'],
    LocalDiscoIcon: ['disco local', 'discoteca', 'vida nocturna', 'música'],
    MainSquareIcon: ['plaza principal', 'plaza central', 'centro urbano'],
    MultisportComplexIcon: ['polideportivo', 'complejo multideporte', 'deportes múltiples'],
    MunicipalBeachIcon: ['balneario municipal', 'playa municipal', 'sombrilla'],
    MunicipalCinemaIcon: ['cine municipal', 'cinema', 'películas'],
    MunicipalGymIcon: ['gimnasio municipal', 'gym público', 'ejercicio'],
    MunicipalParkIcon: ['parque municipal', 'parque público', 'área verde'],
    MunicipalStadiumIcon: ['estadio municipal', 'estadio', 'deportes'],
    MuseumIcon: ['museo'],
    NaturalReserveIcon: ['reserva natural', 'área protegida', 'conservación natural'],
    NaturalSpaIcon: ['spa natural', 'termas naturales', 'aguas termales'],
    NavigableChannelIcon: ['canal navegable', 'canal', 'navegación'],
    NatureReserveIcon: ['reserva natural'],
    ParkIcon: ['parque'],
    PedestrianWalkwayIcon: ['paseo peatonal', 'sendero peatonal', 'caminata'],
    ProtectedAreaIcon: ['área protegida', 'reserva', 'conservación'],
    RecreationalBoatingIcon: ['navegación recreativa', 'paseos en bote', 'turismo náutico'],
    RegionalMuseumIcon: ['museo regional', 'museo local', 'cultura regional'],
    RestaurantIcon: ['restaurante', 'comida'],
    RiverBeachIcon: ['playa fluvial', 'playa río', 'balneario río'],
    RiverKayakIcon: ['kayak río', 'canotaje', 'deportes acuáticos'],
    ShoppingCenterIcon: ['centro comercial', 'shopping'],
    SoccerFieldIcon: ['cancha fútbol', 'campo fútbol', 'deportes'],
    SportFishingIcon: ['pesca deportiva', 'pesca recreativa', 'fishing'],
    SportsComplexIcon: ['complejo deportivo', 'deportes'],
    SportsCenterIcon: ['centro deportivo', 'polideportivo', 'gimnasio'],
    ThermalAquaParkIcon: ['aqua parque termal', 'parque acuático', 'termas'],
    ThermalPoolsIcon: ['piscinas termales', 'piletas termales', 'aguas termales'],
    ThermalSpaIcon: ['spa termal', 'termas'],
    TouristPierIcon: ['embarcadero turístico', 'muelle turístico', 'puerto'],
    TouristRanchIcon: ['estancia turística', 'rancho', 'turismo rural'],
    TraditionalBakeryIcon: ['panadería tradicional', 'panadería artesanal', 'pan casero'],
    TraditionalGrillIcon: ['parrilla tradicional', 'asado tradicional', 'parrilla criolla'],
    TraditionalPubIcon: ['pub tradicional', 'bar tradicional', 'cervecería'],
    WellnessCenterIcon: ['centro wellness', 'bienestar', 'spa', 'relajación'],
    WetlandsIcon: ['humedales'],

    // Redes Sociales
    FacebookIcon: ['facebook'],
    InstagramIcon: ['instagram'],
    WebIcon: ['web', 'sitio web', 'página'],
    WhatsappIcon: ['whatsapp'],

    // Acciones
    AskToAiIcon: ['preguntar ia', 'inteligencia artificial'],
    CancelIcon: ['cancelar', 'cerrar', 'anular'],
    ConfirmIcon: ['confirmar', 'aceptar', 'validar', 'check'],
    CopyIcon: ['copiar'],
    DeleteIcon: ['eliminar', 'borrar', 'quitar', 'basura'],
    DownloadIcon: ['descargar', 'bajar archivo', 'download'],
    EditIcon: ['editar', 'modificar', 'cambiar'],
    ExportIcon: ['exportar', 'descargar datos'],
    FaqsIcon: ['preguntas frecuentes', 'faq'],
    ImportIcon: ['importar', 'subir datos'],
    PrintIcon: ['imprimir', 'impresora'],
    SaveIcon: ['guardar', 'salvar', 'grabar'],
    ShareIcon: ['compartir', 'enviar'],
    SynchronizeIcon: ['sincronizar', 'actualizar', 'sync'],
    UploadIcon: ['subir archivo', 'cargar', 'upload'],

    // Reservas
    AvailableBookingIcon: ['disponible reserva', 'libre booking'],
    AvailableIcon: ['disponible'],
    CancelledBookingIcon: ['cancelado reserva', 'anulado booking'],
    CancelledIcon: ['cancelado'],
    CheckInBookingIcon: ['entrada reserva', 'check in booking'],
    CheckInIcon: ['check in', 'entrada', 'llegada'],
    CheckOutBookingIcon: ['salida reserva', 'check out booking'],
    CheckOutIcon: ['check out', 'salida'],
    ConfirmedBookingIcon: ['confirmado reserva', 'validado booking'],
    ConfirmedIcon: ['confirmado'],
    GuestsBookingIcon: ['huéspedes reserva', 'invitados booking'],
    GuestsIcon: ['huéspedes', 'invitados'],
    PendingBookingIcon: ['pendiente reserva', 'espera booking'],
    PendingIcon: ['pendiente', 'en espera'],
    ReserveBookingIcon: ['reservar booking', 'nueva reserva'],
    ReserveIcon: ['reservar', 'reserva'],
    RoomsBookingIcon: ['habitaciones reserva', 'cuartos booking'],
    RoomsIcon: ['habitaciones', 'cuartos'],
    UnavailableBookingIcon: ['no disponible reserva', 'ocupado booking'],
    UnavailableIcon: ['no disponible', 'ocupado'],

    // Comunicación
    ChatIcon: ['chat', 'conversación', 'mensaje'],
    ContactoIcon: ['contacto', 'comunicación'],
    EmailIcon: ['email', 'correo', 'mail'],
    LanguageIcon: ['idioma', 'lenguaje'],
    NewsletterIcon: ['boletín', 'newsletter', 'noticias'],
    PhoneIcon: ['teléfono', 'llamada'],
    SmsIcon: ['sms', 'mensaje texto'],

    // Sistema
    AddIcon: ['agregar', 'añadir', 'crear'],
    AddressIcon: ['dirección', 'ubicación'],
    AdminIcon: ['administrador', 'admin'],
    AlertsIcon: ['alertas', 'notificaciones', 'avisos'],
    AlertTriangleIcon: ['alerta', 'advertencia', 'aviso', 'vacío'],
    BreadcrumbsIcon: ['migas de pan', 'navegación'],
    CloseIcon: ['cerrar', 'x'],
    CreateIcon: ['crear', 'nuevo'],
    DarkThemeIcon: ['tema oscuro', 'modo oscuro'],
    DebugIcon: ['debug', 'depurar'],
    DropdownIcon: ['desplegable', 'menú'],
    FavoriteIcon: ['favorito', 'me gusta', 'corazón'],
    HamburgerIcon: ['menú hamburguesa', 'menú'],
    HomeIcon: ['inicio', 'casa', 'home'],
    HuespedIcon: ['huésped'],
    HuespedesIcon: ['huéspedes'],
    LightThemeIcon: ['tema claro', 'modo claro'],
    LoaderIcon: ['cargando', 'loading', 'spinner', 'carga', 'espera'],
    LogoutIcon: ['salir', 'cerrar sesión'],
    MapIcon: ['mapa', 'ubicación'],
    MenuIcon: ['menú'],
    NotificationIcon: ['notificación', 'alerta'],
    SearchIcon: ['buscar', 'búsqueda'],
    SettingsIcon: ['configuración', 'ajustes'],
    StarIcon: ['estrella', 'calificación'],
    UserIcon: ['usuario', 'perfil'],
    UsersIcon: ['usuarios', 'personas'],

    // Utilidades
    AudioIcon: ['audio', 'sonido', 'volumen'],
    CalendarIcon: ['calendario', 'fecha'],
    ColumnIcon: ['columna', 'tabla'],
    ConfigurationIcon: ['configuración', 'ajustes', 'settings'],
    DateIcon: ['fecha', 'día', 'calendario'],
    DocumentIcon: ['documento', 'archivo', 'texto'],
    ExcelIcon: ['excel', 'hoja cálculo', 'spreadsheet'],
    FilterIcon: ['filtro', 'filtrar'],
    FirstPageIcon: ['primera página', 'inicio'],
    FullscreenIcon: ['pantalla completa', 'maximizar'],
    GalleryIcon: ['galería', 'imágenes', 'fotos'],
    LastPageIcon: ['última página', 'final'],
    LoadMoreIcon: ['cargar más', 'mostrar más'],
    LocationIcon: ['ubicación', 'lugar', 'mapa'],
    MinimizeIcon: ['minimizar', 'reducir'],
    NextIcon: ['siguiente', 'adelante'],
    PdfIcon: ['pdf', 'documento'],
    PreviousIcon: ['anterior', 'atrás'],
    PriceIcon: ['precio', 'costo', 'dinero'],
    RefreshIcon: ['actualizar', 'refrescar', 'recargar'],
    SortIcon: ['ordenar', 'clasificar'],
    VideoIcon: ['video', 'película'],
    ZoomInIcon: ['acercar', 'zoom in', 'ampliar'],
    ZoomOutIcon: ['alejar', 'zoom out', 'reducir']
};

interface IconData {
    name: string;
}

interface IconCategory {
    title: string;
    description: string;
    icons: IconData[];
}

interface IconSearchAndFilterProps {
    iconCategories: IconCategory[];
}

/**
 * Component for searching and filtering icons
 */
export const IconSearchAndFilter = ({ iconCategories }: IconSearchAndFilterProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Early return if no categories
    if (!iconCategories || iconCategories.length === 0) {
        return (
            <div className="rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                <p className="text-gray-600 dark:text-gray-400">
                    No hay categorías de iconos disponibles.
                </p>
            </div>
        );
    }

    // Get all unique categories for the filter
    const categories = useMemo(() => {
        return [
            { value: 'all', label: 'Todas las categorías' },
            ...iconCategories.map((category) => ({
                value: category.title.toLowerCase(),
                label: category.title
            }))
        ];
    }, [iconCategories]);

    // Filter icons based on search term and selected category
    const filteredCategories = useMemo(() => {
        return iconCategories
            .map((category) => {
                // Filter by category first
                if (
                    selectedCategory !== 'all' &&
                    category.title.toLowerCase() !== selectedCategory
                ) {
                    return null;
                }

                // Then filter by search term (both English name and Spanish translations)
                const filteredIcons = category.icons.filter((icon) => {
                    const lowerSearchTerm = searchTerm.toLowerCase();

                    // Search in English name
                    if (icon.name.toLowerCase().includes(lowerSearchTerm)) {
                        return true;
                    }

                    // Search in Spanish translations
                    const translations = iconTranslations[icon.name] || [];
                    return translations.some((translation) =>
                        translation.toLowerCase().includes(lowerSearchTerm)
                    );
                });

                if (filteredIcons.length === 0) {
                    return null;
                }

                return {
                    ...category,
                    icons: filteredIcons
                };
            })
            .filter(Boolean) as IconCategory[];
    }, [iconCategories, searchTerm, selectedCategory]);

    // Calculate total filtered icons
    const totalFilteredIcons = useMemo(() => {
        return filteredCategories.reduce((total, category) => total + category.icons.length, 0);
    }, [filteredCategories]);

    return (
        <div
            className="space-y-8"
            data-testid="icon-search-filter"
        >
            {/* Search and Filter Controls */}
            <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Search Input */}
                    <div className="relative">
                        <label
                            htmlFor="icon-search"
                            className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                        >
                            Buscar iconos
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <SearchIcon
                                    size="sm"
                                    className="text-gray-400"
                                />
                            </div>
                            <input
                                id="icon-search"
                                type="text"
                                placeholder="Buscar en inglés o español (ej: wifi, piscina, usuario...)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 leading-5 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label
                            htmlFor="category-filter"
                            className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                        >
                            Filtrar por categoría
                        </label>
                        <select
                            id="category-filter"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                            {categories.map((category) => (
                                <option
                                    key={category.value}
                                    value={category.value}
                                >
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Results Summary */}
                <div className="mt-4 flex items-center justify-between text-gray-600 text-sm dark:text-gray-400">
                    <div>
                        Mostrando{' '}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {totalFilteredIcons}
                        </span>{' '}
                        iconos
                        {searchTerm && (
                            <span>
                                {' '}
                                que contienen "<span className="font-medium">{searchTerm}</span>"
                            </span>
                        )}
                        {selectedCategory !== 'all' && (
                            <span>
                                {' '}
                                en la categoría "
                                <span className="font-medium">
                                    {categories.find((c) => c.value === selectedCategory)?.label}
                                </span>
                                "
                            </span>
                        )}
                    </div>
                    {(searchTerm || selectedCategory !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('all');
                            }}
                            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Filtered Results */}
            {filteredCategories.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                    <div className="mb-4 text-gray-400">
                        <SearchIcon
                            size="xl"
                            className="mx-auto"
                        />
                    </div>
                    <h3 className="mb-2 font-medium text-gray-900 text-lg dark:text-white">
                        No se encontraron iconos
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Intenta con otros términos de búsqueda o selecciona una categoría diferente.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {filteredCategories.map((category) => (
                        <div
                            key={category.title}
                            className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
                        >
                            <div className="mb-6">
                                <h2 className="mb-2 font-bold text-2xl text-gray-900 dark:text-white">
                                    {category.title}
                                </h2>
                                <p className="mb-1 text-gray-600 dark:text-gray-400">
                                    {category.description}
                                </p>
                                <span className="font-medium text-blue-600 text-sm dark:text-blue-400">
                                    {category.icons.length} iconos
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                                {category.icons.map((icon) => {
                                    // Get the icon component dynamically from the Icons namespace
                                    const IconComponent = (
                                        Icons as unknown as Record<string, React.FC<IconProps>>
                                    )[icon.name];

                                    // Safety check for component
                                    if (!IconComponent) {
                                        console.warn(`Icon component not found for: ${icon.name}`);
                                        return (
                                            <div
                                                key={icon.name}
                                                className="group flex flex-col items-center rounded-lg bg-gray-50 p-4 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                                            >
                                                <div className="mb-3 rounded-lg bg-white p-2 shadow-sm transition-shadow duration-200 group-hover:shadow-md dark:bg-gray-800">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-red-200 text-xs">
                                                        ?
                                                    </div>
                                                </div>
                                                <span className="text-center font-mono text-gray-600 text-xs leading-tight dark:text-gray-400">
                                                    {icon.name} (Missing)
                                                </span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={icon.name}
                                            className="group flex flex-col items-center rounded-lg bg-gray-50 p-4 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                                        >
                                            <div className="mb-3 rounded-lg bg-white p-2 shadow-sm transition-shadow duration-200 group-hover:shadow-md dark:bg-gray-800">
                                                {React.createElement(IconComponent, {
                                                    size: 'lg',
                                                    className:
                                                        'text-gray-700 transition-colors duration-200 group-hover:text-blue-600 dark:text-gray-300 dark:group-hover:text-blue-400'
                                                })}
                                            </div>
                                            <span className="text-center font-mono text-gray-600 text-xs leading-tight dark:text-gray-400">
                                                {icon.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
