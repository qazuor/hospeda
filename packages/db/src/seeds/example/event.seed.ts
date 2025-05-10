import { db } from '../../client';
import { events } from '../../schema/events';

const now = new Date().toISOString();

/**
 * Seeds example public events in various destinations.
 */
export async function seedExampleEvents() {
    await db.delete(events);

    await db.insert(events).values([
        {
            id: '50000000-0000-0000-0000-000000000001',
            slug: 'festival-rio-colon',
            title: 'Festival del Río',
            description: 'Celebración anual con música, feria de comidas y actividades náuticas.',
            summary: 'Música en vivo, food trucks y entretenimiento familiar.',
            category: 'FESTIVAL',
            tags: ['festival', 'verano'],
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg',
                    state: 'ACTIVE'
                }
            },
            location: {
                street: 'Costanera',
                city: 'Colón',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.2167',
                    long: '-58.1444'
                }
            },
            date: {
                start: now,
                end: now,
                isAllDay: true
            },
            pricing: {
                isFree: false,
                currency: 'ARS',
                priceFrom: 2000,
                priceTo: 5000
            },
            organizer: {
                name: 'Turismo Colón',
                email: 'eventos@colon.tur.ar',
                phone: '+543442000000',
                website: 'https://colon.tur.ar'
            },
            contact: {
                personalEmail: 'info@festivaldelrio.com',
                mobilePhone: '+543442555999',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            authorId: '10000000-0000-0000-0000-000000000001', // admin1
            visibility: 'PUBLIC',
            isFeatured: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: '50000000-0000-0000-0000-000000000002',
            slug: 'noche-joven-gchu',
            title: 'Noche Joven Gualeguaychú',
            description: 'Fiesta electrónica y bandas en vivo en el corsódromo.',
            summary: 'Diversión hasta el amanecer.',
            category: 'MUSIC',
            tags: ['música', 'nocturno'],
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg',
                    state: 'ACTIVE'
                }
            },
            location: {
                street: 'Corsódromo',
                city: 'Gualeguaychú',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: {
                    lat: '-33.0067',
                    long: '-58.5172'
                }
            },
            date: {
                start: now,
                end: now
            },
            pricing: {
                isFree: true
            },
            authorId: '10000000-0000-0000-0000-000000000002', // editor1
            visibility: 'PUBLIC',
            isFeatured: false,
            createdAt: now,
            updatedAt: now
        },
        {
            id: '50000000-0000-0000-0000-000000000003',
            slug: 'sabores-santa-ana',
            title: 'Sabores de Santa Ana',
            description: 'Una feria gastronómica con platos típicos, shows y feria artesanal.',
            summary: '',
            category: 'GASTRONOMY',
            tags: ['comida', 'feria'],
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/236781/pexels-photo-236781.jpeg',
                    state: 'ACTIVE'
                }
            },
            location: {
                street: 'Plaza principal',
                city: 'Santa Ana',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: {
                    lat: '-30.9500',
                    long: '-57.9000'
                }
            },
            date: {
                start: now,
                end: now,
                isAllDay: true
            },
            pricing: {
                isFree: false,
                currency: 'ARS',
                priceFrom: 1000,
                priceTo: 3000
            },
            organizer: {
                name: 'Municipalidad de Santa Ana'
            },
            authorId: '10000000-0000-0000-0000-000000000001', // admin1
            visibility: 'PUBLIC',
            isFeatured: false,
            createdAt: now,
            updatedAt: now
        }
    ]);
}
