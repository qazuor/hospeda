/**
 * @file homepage-events.ts
 * @description Mock event card data for the homepage events section.
 *
 * Contains 6 representative regional events for the Entre Rios / Litoral area,
 * covering different categories: cultural, gastronomy, festival, artisan, music,
 * and sports.
 *
 * All dates are set in 2026. Images reference files in `public/assets/images/tours/`.
 */

import type { EventCardData } from './types';

/**
 * Array of 6 featured event cards for the homepage.
 *
 * Events represent the main cultural and recreational calendar of the region:
 * Regata Internacional, Feria Gastronómica Entrerriana, Carnaval de Gualeguaychú,
 * Encuentro de Artesanos, Festival de Música del Río, and Fiesta de la Citricultura.
 *
 * @example
 * ```ts
 * import { homepageEvents } from '@/data/homepage-events';
 * const festivals = homepageEvents.filter(e => e.category === 'festival');
 * ```
 */
export const homepageEvents: readonly EventCardData[] = [
    {
        slug: 'regata-internacional-uruguay-2026',
        name: 'Regata Internacional del Uruguay',
        summary:
            'La competencia náutica más importante del litoral argentino convoca a regatistas de toda Sudamérica en las aguas del río Uruguay.',
        featuredImage: '/assets/images/tours/tours-3-1.jpg',
        category: 'sports',
        date: {
            start: '2026-04-05T09:00:00-03:00',
            end: '2026-04-08T18:00:00-03:00'
        },
        isFeatured: true,
        location: {
            name: 'Puerto de la ciudad',
            city: 'Concepción del Uruguay'
        }
    },
    {
        slug: 'feria-gastronomica-entrerriana-2026',
        name: 'Feria Gastronómica Entrerriana',
        summary:
            'Sabores del litoral en un gran encuentro de productores locales, chefs reconocidos y vinos entrerrianos. Degustaciones, shows en vivo y mercado artesanal.',
        featuredImage: '/assets/images/tours/tours-3-2.jpg',
        category: 'gastronomy',
        date: {
            start: '2026-05-15T19:30:00-03:00',
            end: '2026-05-17T23:00:00-03:00'
        },
        isFeatured: true,
        location: {
            name: 'Parque Urquiza',
            city: 'Paraná'
        }
    },
    {
        slug: 'carnaval-gualeguaychu-2026',
        name: 'Carnaval de Gualeguaychú',
        summary:
            'El carnaval más largo del mundo vuelve al corsódromo de Gualeguaychú con comparsas, plumas y ritmo guaraní durante 10 fines de semana.',
        featuredImage: '/assets/images/tours/tours-3-3.jpg',
        category: 'festival',
        date: {
            start: '2026-07-15T21:00:00-03:00',
            end: '2026-07-19T02:00:00-03:00'
        },
        isFeatured: true,
        location: {
            name: 'Corsódromo Pueblo Ñandú',
            city: 'Gualeguaychú'
        }
    },
    {
        slug: 'encuentro-artesanos-litoral-2026',
        name: 'Encuentro de Artesanos del Litoral',
        summary:
            'Tres días de feria artesanal con más de 200 expositores de toda la región. Cerámica, tejido, cuero, madera y joyería en un espacio a cielo abierto.',
        featuredImage: '/assets/images/tours/tours-1-1.jpg',
        category: 'cultural',
        date: {
            start: '2026-08-22T10:00:00-03:00',
            end: '2026-08-24T20:00:00-03:00'
        },
        isFeatured: false,
        location: {
            name: 'Costanera Municipal',
            city: 'Concepción del Uruguay'
        }
    },
    {
        slug: 'festival-musica-rio-2026',
        name: 'Festival de Música del Río',
        summary:
            'Cuatro noches de música al aire libre con artistas nacionales e internacionales. Folclore, jazz, cumbia y rock en el anfiteatro natural del río Uruguay.',
        featuredImage: '/assets/images/tours/tours-3-2.jpg',
        category: 'music',
        date: {
            start: '2026-09-18T20:00:00-03:00',
            end: '2026-09-21T23:59:00-03:00'
        },
        isFeatured: true,
        location: {
            name: 'Anfiteatro del Lago',
            city: 'Federación'
        }
    },
    {
        slug: 'fiesta-citricultura-2026',
        name: 'Fiesta de la Citricultura',
        summary:
            'Celebración anual de la citricultura entrerriana con exposición de productores, concursos, gastronomía regional y espectáculos folclóricos para toda la familia.',
        featuredImage: '/assets/images/tours/tours-1-1.jpg',
        category: 'cultural',
        date: {
            start: '2026-10-10T14:30:00-03:00',
            end: '2026-10-12T22:00:00-03:00'
        },
        isFeatured: false,
        location: {
            name: 'Predio Municipal',
            city: 'Chajarí'
        }
    }
] as const;
