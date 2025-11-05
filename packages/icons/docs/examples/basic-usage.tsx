/**
 * Example: Basic Icon Usage
 *
 * Demonstrates fundamental icon usage patterns including:
 * - Importing and rendering icons
 * - Icons in different UI contexts
 * - Common UI patterns with icons
 * - Real Hospeda business components
 *
 * @module examples/basic-usage
 * @example
 * ```tsx
 * import { App } from './basic-usage';
 *
 * // Render the complete example
 * <App />
 * ```
 */

import React from 'react';
import {
  HomeIcon,
  SearchIcon,
  UserIcon,
  BedIcon,
  WifiIcon,
  ParkingIcon,
  AirConditioningIcon,
  KitchenIcon,
  SwimmingPoolIcon,
  PetFriendlyIcon,
  AccessibleIcon,
  GymIcon,
  SpaIcon,
  RestaurantIcon,
  BarIcon,
  ConferenceRoomIcon,
  LaundryIcon,
  ElevatorIcon,
  BalconyIcon,
  GardenIcon,
  StarIcon,
  HeartIcon,
  ShareIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  EmailIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
  MinusIcon,
  EditIcon,
  DeleteIcon,
  DownloadIcon,
  UploadIcon,
  FilterIcon,
  SortIcon,
  GridIcon,
  ListIcon,
  ImageIcon,
} from '@repo/icons';

/**
 * Icon showcase grid properties
 */
interface IconShowcaseProps {
  title: string;
  description?: string;
  icons: Array<{
    component: React.ComponentType<{ size?: number; className?: string }>;
    name: string;
    label: string;
  }>;
}

/**
 * IconShowcase Component
 *
 * Displays a grid of icons with labels
 *
 * @param props - Component properties
 * @returns Rendered icon showcase
 */
export function IconShowcase(props: IconShowcaseProps): JSX.Element {
  const { title, description, icons } = props;

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-4">{description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {icons.map((icon) => {
          const IconComponent = icon.component;
          return (
            <div
              key={icon.name}
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <IconComponent size={32} className="text-gray-700 mb-2" />
              <span className="text-xs text-center text-gray-600">
                {icon.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Button with icon properties
 */
interface ButtonWithIconProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

/**
 * ButtonWithIcon Component
 *
 * Button with icon and text
 *
 * @param props - Component properties
 * @returns Rendered button
 */
export function ButtonWithIcon(props: ButtonWithIconProps): JSX.Element {
  const { icon: IconComponent, label, onClick, variant = 'primary' } = props;

  const baseClasses =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      <IconComponent size={20} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Icon-only button properties
 */
interface IconButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

/**
 * IconButton Component
 *
 * Icon-only button with accessible label
 *
 * @param props - Component properties
 * @returns Rendered icon button
 */
export function IconButton(props: IconButtonProps): JSX.Element {
  const { icon: IconComponent, label, onClick, variant = 'ghost' } = props;

  const baseClasses = 'p-2 rounded-lg transition-colors';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      <IconComponent size={20} />
    </button>
  );
}

/**
 * Navigation item properties
 */
interface NavigationItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  href: string;
  isActive?: boolean;
}

/**
 * NavigationItem Component
 *
 * Navigation menu item with icon
 *
 * @param props - Component properties
 * @returns Rendered navigation item
 */
export function NavigationItem(props: NavigationItemProps): JSX.Element {
  const { icon: IconComponent, label, href, isActive = false } = props;

  const activeClasses = isActive
    ? 'bg-blue-50 text-blue-600'
    : 'text-gray-700 hover:bg-gray-50';

  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeClasses}`}
    >
      <IconComponent size={20} />
      <span className="font-medium">{label}</span>
    </a>
  );
}

/**
 * Navigation bar component
 */
export function NavigationBar(): JSX.Element {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <HomeIcon size={24} className="text-blue-600" />
              <span className="text-xl font-bold">Hospeda</span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <NavigationItem
                icon={HomeIcon}
                label="Inicio"
                href="/"
                isActive={true}
              />
              <NavigationItem icon={SearchIcon} label="Buscar" href="/search" />
              <NavigationItem
                icon={CalendarIcon}
                label="Reservas"
                href="/bookings"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton icon={HeartIcon} label="Favoritos" />
            <IconButton icon={UserIcon} label="Mi cuenta" />
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Amenity item properties
 */
interface AmenityItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  available?: boolean;
}

/**
 * AmenityItem Component
 *
 * Displays an amenity with icon and availability status
 *
 * @param props - Component properties
 * @returns Rendered amenity item
 */
export function AmenityItem(props: AmenityItemProps): JSX.Element {
  const { icon: IconComponent, label, available = true } = props;

  return (
    <div
      className={`flex items-center gap-2 ${
        available ? 'text-gray-700' : 'text-gray-400 line-through'
      }`}
    >
      <IconComponent size={18} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * Accommodation card properties
 */
interface AccommodationCardProps {
  title: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  amenities: string[];
}

/**
 * AccommodationCard Component
 *
 * Real Hospeda accommodation card with amenity icons
 *
 * @param props - Component properties
 * @returns Rendered accommodation card
 */
export function AccommodationCard(
  props: AccommodationCardProps
): JSX.Element {
  const { title, location, price, rating, image, amenities } = props;

  const amenityIcons: Record<
    string,
    React.ComponentType<{ size?: number; className?: string }>
  > = {
    wifi: WifiIcon,
    parking: ParkingIcon,
    'air-conditioning': AirConditioningIcon,
    kitchen: KitchenIcon,
    pool: SwimmingPoolIcon,
    'pet-friendly': PetFriendlyIcon,
    accessible: AccessibleIcon,
    gym: GymIcon,
  };

  return (
    <article className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <img
          src={image}
          alt={title}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        <button
          type="button"
          aria-label="Guardar en favoritos"
          className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
        >
          <HeartIcon size={20} className="text-gray-700" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-1">
            <StarIcon size={16} className="text-yellow-500" />
            <span className="text-sm font-medium">{rating.toFixed(1)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-gray-600 mb-3">
          <MapPinIcon size={16} />
          <span className="text-sm">{location}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {amenities.slice(0, 4).map((amenity) => {
            const IconComponent = amenityIcons[amenity];
            return IconComponent ? (
              <AmenityItem
                key={amenity}
                icon={IconComponent}
                label={amenity.replace('-', ' ')}
              />
            ) : null;
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <span className="text-2xl font-bold text-gray-900">
              ${price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-600"> / noche</span>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ver detalles
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Feature list item properties
 */
interface FeatureItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

/**
 * FeatureItem Component
 *
 * Feature list item with icon, title, and description
 *
 * @param props - Component properties
 * @returns Rendered feature item
 */
export function FeatureItem(props: FeatureItemProps): JSX.Element {
  const { icon: IconComponent, title, description } = props;

  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <IconComponent size={24} className="text-blue-600" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}

/**
 * Form input with icon properties
 */
interface InputWithIconProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  placeholder: string;
  type?: string;
}

/**
 * InputWithIcon Component
 *
 * Form input field with leading icon
 *
 * @param props - Component properties
 * @returns Rendered input field
 */
export function InputWithIcon(props: InputWithIconProps): JSX.Element {
  const { icon: IconComponent, label, placeholder, type = 'text' } = props;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <IconComponent size={20} />
        </div>
        <input
          type={type}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}

/**
 * Action card properties
 */
interface ActionCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
}

/**
 * ActionCard Component
 *
 * Card with icon, content, and call-to-action
 *
 * @param props - Component properties
 * @returns Rendered action card
 */
export function ActionCard(props: ActionCardProps): JSX.Element {
  const { icon: IconComponent, title, description, actionLabel, onClick } =
    props;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
        <IconComponent size={32} className="text-white" />
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>

      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors"
      >
        <span>{actionLabel}</span>
        <span className="text-xl">→</span>
      </button>
    </div>
  );
}

/**
 * Main App Component
 *
 * Demonstrates all basic icon usage patterns
 *
 * @returns Rendered application
 */
export function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation with icons */}
      <NavigationBar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Basic Icon Usage Examples
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive examples of icon usage in Hospeda components
          </p>
        </header>

        {/* Icon Showcases */}
        <IconShowcase
          title="Navigation Icons"
          description="Common icons used in navigation and UI controls"
          icons={[
            { component: HomeIcon, name: 'home', label: 'Home' },
            { component: SearchIcon, name: 'search', label: 'Search' },
            { component: UserIcon, name: 'user', label: 'User' },
            { component: CalendarIcon, name: 'calendar', label: 'Calendar' },
            { component: MapPinIcon, name: 'map-pin', label: 'Location' },
            { component: HeartIcon, name: 'heart', label: 'Favorites' },
          ]}
        />

        <IconShowcase
          title="Amenity Icons"
          description="Icons representing accommodation amenities and features"
          icons={[
            { component: WifiIcon, name: 'wifi', label: 'WiFi' },
            { component: ParkingIcon, name: 'parking', label: 'Parking' },
            {
              component: AirConditioningIcon,
              name: 'air-conditioning',
              label: 'A/C',
            },
            { component: KitchenIcon, name: 'kitchen', label: 'Kitchen' },
            { component: SwimmingPoolIcon, name: 'pool', label: 'Pool' },
            {
              component: PetFriendlyIcon,
              name: 'pet-friendly',
              label: 'Pets OK',
            },
            { component: AccessibleIcon, name: 'accessible', label: 'Access' },
            { component: GymIcon, name: 'gym', label: 'Gym' },
            { component: SpaIcon, name: 'spa', label: 'Spa' },
            { component: RestaurantIcon, name: 'restaurant', label: 'Food' },
            { component: BarIcon, name: 'bar', label: 'Bar' },
            { component: LaundryIcon, name: 'laundry', label: 'Laundry' },
          ]}
        />

        <IconShowcase
          title="Action Icons"
          description="Icons for user actions and interactions"
          icons={[
            { component: EditIcon, name: 'edit', label: 'Edit' },
            { component: DeleteIcon, name: 'delete', label: 'Delete' },
            { component: ShareIcon, name: 'share', label: 'Share' },
            { component: DownloadIcon, name: 'download', label: 'Download' },
            { component: UploadIcon, name: 'upload', label: 'Upload' },
            { component: PlusIcon, name: 'plus', label: 'Add' },
            { component: MinusIcon, name: 'minus', label: 'Remove' },
            { component: CheckIcon, name: 'check', label: 'Confirm' },
            { component: XIcon, name: 'x', label: 'Close' },
            { component: FilterIcon, name: 'filter', label: 'Filter' },
            { component: SortIcon, name: 'sort', label: 'Sort' },
            { component: GridIcon, name: 'grid', label: 'Grid' },
          ]}
        />

        {/* Button Examples */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Buttons with Icons</h2>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="font-semibold mb-4">Text + Icon Buttons</h3>
            <div className="flex flex-wrap gap-3 mb-6">
              <ButtonWithIcon
                icon={SearchIcon}
                label="Buscar alojamiento"
                variant="primary"
              />
              <ButtonWithIcon
                icon={PlusIcon}
                label="Crear reserva"
                variant="secondary"
              />
              <ButtonWithIcon
                icon={FilterIcon}
                label="Filtrar resultados"
                variant="outline"
              />
              <ButtonWithIcon
                icon={DownloadIcon}
                label="Descargar PDF"
                variant="ghost"
              />
            </div>

            <h3 className="font-semibold mb-4">Icon-Only Buttons</h3>
            <div className="flex flex-wrap gap-3">
              <IconButton icon={HeartIcon} label="Guardar favorito" />
              <IconButton icon={ShareIcon} label="Compartir" />
              <IconButton icon={EditIcon} label="Editar" />
              <IconButton icon={DeleteIcon} label="Eliminar" />
              <IconButton icon={DownloadIcon} label="Descargar" />
            </div>
          </div>
        </section>

        {/* Accommodation Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Accommodation Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AccommodationCard
              title="Casa del Río"
              location="Concepción del Uruguay"
              price={8500}
              rating={4.8}
              image="https://via.placeholder.com/400x300"
              amenities={['wifi', 'parking', 'air-conditioning', 'kitchen']}
            />
            <AccommodationCard
              title="Villa Paraíso"
              location="Colón"
              price={12000}
              rating={4.9}
              image="https://via.placeholder.com/400x300"
              amenities={['pool', 'wifi', 'parking', 'gym']}
            />
            <AccommodationCard
              title="Departamento Centro"
              location="Concepción del Uruguay"
              price={6500}
              rating={4.6}
              image="https://via.placeholder.com/400x300"
              amenities={['wifi', 'air-conditioning', 'pet-friendly', 'accessible']}
            />
          </div>
        </section>

        {/* Feature List */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Feature Lists</h2>
          <div className="bg-white p-8 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FeatureItem
                icon={SearchIcon}
                title="Búsqueda Avanzada"
                description="Encuentra el alojamiento perfecto con filtros inteligentes"
              />
              <FeatureItem
                icon={CalendarIcon}
                title="Reserva Instantánea"
                description="Confirma tu estadía en segundos con disponibilidad en tiempo real"
              />
              <FeatureItem
                icon={StarIcon}
                title="Calificaciones Verificadas"
                description="Lee opiniones reales de huéspedes anteriores"
              />
              <FeatureItem
                icon={PhoneIcon}
                title="Soporte 24/7"
                description="Asistencia inmediata cuando la necesites"
              />
            </div>
          </div>
        </section>

        {/* Form Inputs */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Form Inputs with Icons</h2>
          <div className="bg-white p-8 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputWithIcon
                icon={SearchIcon}
                label="Destino"
                placeholder="¿A dónde quieres ir?"
              />
              <InputWithIcon
                icon={CalendarIcon}
                label="Fecha"
                placeholder="Selecciona fechas"
                type="date"
              />
              <InputWithIcon
                icon={EmailIcon}
                label="Email"
                placeholder="tu@email.com"
                type="email"
              />
              <InputWithIcon
                icon={PhoneIcon}
                label="Teléfono"
                placeholder="+54 9 11 1234-5678"
                type="tel"
              />
            </div>
          </div>
        </section>

        {/* Action Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Action Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ActionCard
              icon={HomeIcon}
              title="Publicar Alojamiento"
              description="Comparte tu propiedad con viajeros de todo el mundo"
              actionLabel="Comenzar"
            />
            <ActionCard
              icon={CalendarIcon}
              title="Ver Reservas"
              description="Administra todas tus reservas en un solo lugar"
              actionLabel="Ir a reservas"
            />
            <ActionCard
              icon={UserIcon}
              title="Completar Perfil"
              description="Agrega información para mejorar tu experiencia"
              actionLabel="Completar"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
