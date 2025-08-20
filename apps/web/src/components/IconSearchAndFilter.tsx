import type { IconProps } from '@repo/icons';
import * as Icons from '@repo/icons';
import { SearchIcon } from '@repo/icons';
import React, { useMemo, useState } from 'react';

// Mapa de traducción inglés → español para búsqueda
const iconTranslations: Record<string, string[]> = {
    // Entidades
    AccommodationIcon: ['alojamiento', 'hospedaje', 'hotel', 'cabaña', 'hostel'],
    ContentIcon: ['contenido'],
    DestinationIcon: ['destino', 'lugar'],
    EventIcon: ['evento', 'actividad'],
    EventLocationIcon: ['ubicación evento', 'lugar evento'],
    EventOrganizerIcon: ['organizador evento'],
    PermissionIcon: ['permiso', 'autorización'],
    PostIcon: ['publicación', 'artículo', 'blog'],
    PostSponsorIcon: ['patrocinador publicación'],
    PostSponsorshipIcon: ['patrocinio publicación'],

    // Administración
    AnalyticsIcon: ['análisis', 'estadísticas', 'métricas'],
    DashboardIcon: ['panel', 'tablero', 'dashboard'],
    ListIcon: ['lista', 'listado'],
    SectionIcon: ['sección'],
    TagIcon: ['etiqueta', 'tag'],
    TagsIcon: ['etiquetas', 'tags'],
    ViewAllIcon: ['ver todo', 'mostrar todo'],

    // Comodidades
    AirConditioningIcon: ['aire acondicionado', 'climatización'],
    BalconyIcon: ['balcón', 'terraza'],
    BbqGrillIcon: ['parrilla', 'asado', 'barbacoa'],
    BedLinensIcon: ['ropa de cama', 'sábanas'],
    BicyclesIcon: ['bicicletas', 'bicis'],
    BlackoutCurtainsIcon: ['cortinas blackout', 'cortinas opacas'],
    BreakfastIcon: ['desayuno'],
    CoffeeMakerIcon: ['cafetera', 'café'],
    ElectricBlanketIcon: ['manta eléctrica', 'frazada eléctrica'],
    ElectricFireplaceIcon: ['chimenea eléctrica'],
    ElevatorIcon: ['ascensor', 'elevador'],
    FanIcon: ['ventilador'],
    FireplaceIcon: ['chimenea', 'hogar'],
    GymIcon: ['gimnasio', 'gym'],
    HairDryerIcon: ['secador de pelo', 'secador'],
    HeatingIcon: ['calefacción', 'calentador'],
    InternationalAdaptersIcon: ['adaptadores internacionales', 'enchufes'],
    JacuzziIcon: ['jacuzzi', 'hidromasaje'],
    KettleIcon: ['pava eléctrica', 'hervidor'],
    KitchenIcon: ['cocina'],
    MicrowaveIcon: ['microondas'],
    MiniBarIcon: ['minibar', 'frigobar'],
    ParkingIcon: ['estacionamiento', 'parking', 'garaje'],
    PlaygroundIcon: ['parque infantil', 'juegos'],
    PoolIcon: ['piscina', 'pileta'],
    RefrigeratorIcon: ['refrigerador', 'heladera', 'nevera'],
    RoomTvIcon: ['tv por habitación', 'televisión habitación'],
    SafeIcon: ['caja fuerte', 'seguridad'],
    SharedKitchenIcon: ['cocina compartida'],
    SmartTvIcon: ['smart tv', 'tv inteligente'],
    SoapDispenserIcon: ['dispensador jabón', 'jabón'],
    StoveIcon: ['cocina', 'estufa', 'hornalla'],
    TerraceIcon: ['terraza'],
    TowelsIcon: ['toallas'],
    TvIcon: ['televisión', 'tv'],
    UnderfloorHeatingIcon: ['calefacción suelo radiante', 'piso radiante'],
    UtensilsIcon: ['utensilios cocina', 'cubiertos'],
    WasherIcon: ['lavarropas', 'lavadora'],
    WaterDispenserIcon: ['dispensador agua'],
    WifiIcon: ['wifi', 'internet', 'conexión'],

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

    // Características
    CentralAreaIcon: ['área central', 'zona céntrica'],
    EcologicalIcon: ['ecológico', 'sustentable'],
    FamilySuitableIcon: ['familiar', 'apto familias'],
    ModernStyleIcon: ['estilo moderno', 'contemporáneo'],
    NaturalEnvironmentIcon: ['entorno natural', 'naturaleza'],
    PanoramicViewIcon: ['vista panorámica', 'vista'],
    PavedAccessIcon: ['acceso pavimentado'],
    PetFriendlyIcon: ['pet friendly', 'mascotas', 'animales'],
    RenewableEnergyIcon: ['energía renovable', 'sustentable'],
    RiverFrontIcon: ['frente al río', 'ribereño'],
    RuralAreaIcon: ['área rural', 'campo'],
    RusticStyleIcon: ['estilo rústico'],
    SmartHomeIcon: ['casa inteligente', 'domótica'],
    SpaFrontIcon: ['frente al spa', 'spa'],

    // Atracciones
    AgriculturalCenterIcon: ['centro agrícola', 'granja'],
    AmphitheaterIcon: ['anfiteatro'],
    AviariumIcon: ['aviario', 'aves'],
    BeachIcon: ['playa'],
    CasinoIcon: ['casino'],
    CathedralIcon: ['catedral', 'iglesia'],
    CulturalCenterIcon: ['centro cultural'],
    EducationalFarmIcon: ['granja educativa'],
    MuseumIcon: ['museo'],
    NatureReserveIcon: ['reserva natural'],
    ParkIcon: ['parque'],
    RestaurantIcon: ['restaurante', 'comida'],
    ShoppingCenterIcon: ['centro comercial', 'shopping'],
    SportsComplexIcon: ['complejo deportivo', 'deportes'],
    ThermalSpaIcon: ['spa termal', 'termas'],
    WetlandsIcon: ['humedales'],

    // Comunicación
    ChatIcon: ['chat', 'conversación', 'mensaje'],
    ContactoIcon: ['contacto'],
    LanguageIcon: ['idioma', 'lenguaje'],
    PhoneIcon: ['teléfono', 'llamada'],

    // Redes Sociales
    FacebookIcon: ['facebook'],
    InstagramIcon: ['instagram'],
    WebIcon: ['web', 'sitio web', 'página'],
    WhatsappIcon: ['whatsapp'],

    // Acciones
    AskToAiIcon: ['preguntar ia', 'inteligencia artificial'],
    CopyIcon: ['copiar'],
    FaqsIcon: ['preguntas frecuentes', 'faq'],

    // Reservas
    AvailableIcon: ['disponible'],
    CancelledIcon: ['cancelado'],
    CheckInIcon: ['check in', 'entrada', 'llegada'],
    CheckOutIcon: ['check out', 'salida'],
    ConfirmedIcon: ['confirmado'],
    GuestsIcon: ['huéspedes', 'invitados'],
    PendingIcon: ['pendiente', 'en espera'],
    ReserveIcon: ['reservar', 'reserva'],
    RoomsIcon: ['habitaciones', 'cuartos'],
    UnavailableIcon: ['no disponible', 'ocupado'],

    // Sistema
    AddIcon: ['agregar', 'añadir', 'crear'],
    AddressIcon: ['dirección', 'ubicación'],
    AdminIcon: ['administrador', 'admin'],
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
    LogoutIcon: ['salir', 'cerrar sesión'],
    MapIcon: ['mapa', 'ubicación'],
    MenuIcon: ['menú'],
    NotificationIcon: ['notificación', 'alerta'],
    SearchIcon: ['buscar', 'búsqueda'],
    SettingsIcon: ['configuración', 'ajustes'],
    StarIcon: ['estrella', 'calificación'],
    UserIcon: ['usuario', 'perfil'],
    UsersIcon: ['usuarios', 'personas']
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
