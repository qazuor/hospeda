/**
 * @file homepage-accommodations.ts
 * @description Mock accommodation card data for the homepage featured section.
 *
 * Contains 10 varied accommodation entries covering different types from the
 * Litoral / Entre Rios region. Prices are expressed in centavos (integer):
 * divide by 100 to get the ARS display value.
 *
 * Images reference files that exist in `public/assets/images/tours/`.
 */

import type { AccommodationCardData } from './types';

/**
 * Array of 10 featured accommodation cards for the homepage.
 *
 * Covers the full range of accommodation types available in the platform:
 * hotel, cabin, camping, apartment, country_house, hostel, resort, house,
 * motel, and room. Locations span the main Litoral destinations.
 *
 * @example
 * ```ts
 * import { homepageAccommodations } from '@/data/homepage-accommodations';
 * const featured = homepageAccommodations.filter(a => a.isFeatured);
 * ```
 */
export const homepageAccommodations: readonly AccommodationCardData[] = [
    {
        id: 'acc-001',
        slug: 'hotel-plaza-concepcion',
        name: 'Hotel Plaza Concepción',
        summary:
            'Hotel céntrico a pasos de la Plaza Ramírez, con vistas al casco histórico y desayuno incluido.',
        type: 'hotel',
        featuredImage: '/assets/images/tours/tours-1-1.jpg',
        location: { city: 'Concepción del Uruguay', state: 'Entre Ríos' },
        price: { amount: 1250000, currency: 'ARS', period: 'noche' },
        averageRating: 4.6,
        reviewsCount: 87,
        isFeatured: true,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            { key: 'breakfast', label: 'Desayuno', icon: 'Coffee', displayWeight: 20 },
            { key: 'parking', label: 'Estacionamiento', icon: 'Car', displayWeight: 30 }
        ]
    },
    {
        id: 'acc-002',
        slug: 'cabanas-rio-verde',
        name: 'Cabañas Río Verde',
        summary:
            'Cabañas de madera con fogón privado a orillas del arroyo Yuquerí, ideal para desconectarse.',
        type: 'cabin',
        featuredImage: '/assets/images/tours/tours-1-2.jpg',
        location: { city: 'Concepción del Uruguay', state: 'Entre Ríos' },
        price: { amount: 980000, currency: 'ARS', period: 'noche' },
        averageRating: 4.9,
        reviewsCount: 143,
        isFeatured: true,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            { key: 'pool', label: 'Pileta', icon: 'Waves', displayWeight: 15 },
            { key: 'bbq', label: 'Parrilla', icon: 'FireSimple', displayWeight: 20 }
        ],
        features: [
            { key: 'pet-friendly', label: 'Acepta mascotas', icon: 'PawPrint', displayWeight: 10 }
        ]
    },
    {
        id: 'acc-003',
        slug: 'camping-playa-norte-gualeguaychu',
        name: 'Camping Playa Norte',
        summary:
            'Camping familiar sobre la costa del Gualeguaychú, con acceso directo a la playa y servicios completos.',
        type: 'camping',
        featuredImage: '/assets/images/tours/tours-1-3.jpg',
        location: { city: 'Gualeguaychú', state: 'Entre Ríos' },
        price: { amount: 350000, currency: 'ARS', period: 'noche' },
        averageRating: 4.2,
        reviewsCount: 56,
        isFeatured: false,
        amenities: [
            { key: 'beach-access', label: 'Acceso a playa', icon: 'Waves', displayWeight: 10 },
            { key: 'bathrooms', label: 'Baños y duchas', icon: 'Shower', displayWeight: 20 },
            { key: 'electricity', label: 'Electricidad', icon: 'Lightning', displayWeight: 30 }
        ],
        features: [
            { key: 'pet-friendly', label: 'Acepta mascotas', icon: 'PawPrint', displayWeight: 10 }
        ]
    },
    {
        id: 'acc-004',
        slug: 'apartamentos-colon-centro',
        name: 'Apartamentos Colón Centro',
        summary:
            'Departamentos modernos equipados a metros del río Uruguay y el Parque Nacional El Palmar.',
        type: 'apartment',
        featuredImage: '/assets/images/tours/tours-1-4.jpg',
        location: { city: 'Colón', state: 'Entre Ríos' },
        price: { amount: 850000, currency: 'ARS', period: 'noche' },
        averageRating: 4.4,
        reviewsCount: 62,
        isFeatured: true,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            { key: 'kitchen', label: 'Cocina equipada', icon: 'CookingPot', displayWeight: 20 },
            { key: 'ac', label: 'Aire acondicionado', icon: 'Snowflake', displayWeight: 30 }
        ]
    },
    {
        id: 'acc-005',
        slug: 'estancia-la-querencia-federacion',
        name: 'Estancia La Querencia',
        summary:
            'Campo gaucho con actividades rurales, cabalgatas y asados tradicionales a 15 km de Federación.',
        type: 'country_house',
        featuredImage: '/assets/images/tours/tours-1-5.jpg',
        location: { city: 'Federación', state: 'Entre Ríos' },
        price: { amount: 1650000, currency: 'ARS', period: 'noche' },
        averageRating: 4.8,
        reviewsCount: 39,
        isFeatured: true,
        amenities: [
            { key: 'pool', label: 'Pileta', icon: 'Waves', displayWeight: 10 },
            { key: 'breakfast', label: 'Desayuno regional', icon: 'Coffee', displayWeight: 20 },
            { key: 'parking', label: 'Estacionamiento', icon: 'Car', displayWeight: 30 }
        ],
        features: [
            { key: 'horse-riding', label: 'Cabalgatas', icon: 'Horse', displayWeight: 10 },
            { key: 'eco', label: 'Eco-certificado', icon: 'Leaf', displayWeight: 20 }
        ]
    },
    {
        id: 'acc-006',
        slug: 'hostel-litoral-gualeguaychu',
        name: 'Hostel Litoral',
        summary:
            'Albergue juvenil con ambiente social, dormis y habitaciones privadas en pleno centro de Gualeguaychú.',
        type: 'hostel',
        featuredImage: '/assets/images/tours/tours-1-6.jpg',
        location: { city: 'Gualeguaychú', state: 'Entre Ríos' },
        price: { amount: 420000, currency: 'ARS', period: 'noche' },
        averageRating: 3.9,
        reviewsCount: 114,
        isFeatured: false,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            {
                key: 'shared-kitchen',
                label: 'Cocina compartida',
                icon: 'CookingPot',
                displayWeight: 20
            },
            { key: 'locker', label: 'Casilleros', icon: 'Lock', displayWeight: 30 }
        ]
    },
    {
        id: 'acc-007',
        slug: 'resort-termas-federacion',
        name: 'Resort Termas del Litoral',
        summary:
            'Resort termal con acceso a cinco piscinas de agua termal, spa y restaurante gourmet en Federación.',
        type: 'resort',
        featuredImage: '/assets/images/tours/tours-1-7.jpg',
        location: { city: 'Federación', state: 'Entre Ríos' },
        price: { amount: 2800000, currency: 'ARS', period: 'noche' },
        averageRating: 4.7,
        reviewsCount: 201,
        isFeatured: true,
        amenities: [
            { key: 'thermal-pool', label: 'Piscinas termales', icon: 'Waves', displayWeight: 10 },
            { key: 'spa', label: 'Spa', icon: 'Sparkle', displayWeight: 20 },
            { key: 'restaurant', label: 'Restaurante', icon: 'ForkKnife', displayWeight: 30 },
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 40 }
        ]
    },
    {
        id: 'acc-008',
        slug: 'casa-quincho-colon',
        name: 'Casa Quincho El Naranjal',
        summary:
            'Casa familiar con quincho, jardín y piscina a dos cuadras del acceso a las playas de Colón.',
        type: 'house',
        featuredImage: '/assets/images/tours/tours-1-8.jpg',
        location: { city: 'Colón', state: 'Entre Ríos' },
        price: { amount: 1100000, currency: 'ARS', period: 'noche' },
        averageRating: 4.5,
        reviewsCount: 77,
        isFeatured: false,
        amenities: [
            { key: 'pool', label: 'Pileta privada', icon: 'Waves', displayWeight: 10 },
            { key: 'bbq', label: 'Quincho y parrilla', icon: 'FireSimple', displayWeight: 20 },
            { key: 'parking', label: 'Garage', icon: 'Car', displayWeight: 30 }
        ],
        features: [
            { key: 'pet-friendly', label: 'Acepta mascotas', icon: 'PawPrint', displayWeight: 10 }
        ]
    },
    {
        id: 'acc-009',
        slug: 'motel-ruta-14-colon',
        name: 'Motel Ruta del Litoral',
        summary:
            'Motel cómodo sobre Ruta 14, con estacionamiento privado por habitación y acceso rápido a Colón.',
        type: 'motel',
        featuredImage: '/assets/images/tours/tours-1-9.jpg',
        location: { city: 'Colón', state: 'Entre Ríos' },
        price: { amount: 650000, currency: 'ARS', period: 'noche' },
        averageRating: 3.7,
        reviewsCount: 45,
        isFeatured: false,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            { key: 'parking', label: 'Estacionamiento privado', icon: 'Car', displayWeight: 20 },
            { key: 'ac', label: 'Aire acondicionado', icon: 'Snowflake', displayWeight: 30 }
        ]
    },
    {
        id: 'acc-010',
        slug: 'habitacion-familiar-concepcion',
        name: 'Habitación con Desayuno Don Segundo',
        summary:
            'Habitación en casa de familia con desayuno casero, patio arbolado y trato personalizado.',
        type: 'room',
        featuredImage: '/assets/images/tours/tours-2-1.jpg',
        location: { city: 'Concepción del Uruguay', state: 'Entre Ríos' },
        price: { amount: 520000, currency: 'ARS', period: 'noche' },
        averageRating: 4.3,
        reviewsCount: 28,
        isFeatured: false,
        amenities: [
            { key: 'wifi', label: 'WiFi gratuito', icon: 'WifiHigh', displayWeight: 10 },
            { key: 'breakfast', label: 'Desayuno incluido', icon: 'Coffee', displayWeight: 20 }
        ]
    }
] as const;
