import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Colón destination
 */
export async function seedColonDestination() {
    logger.info('Starting to seed Colón destination', 'seedColonDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'colon-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info('Colón destination already exists, skipping', 'seedColonDestination');
            return;
        }

        const colonDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'colon',
            displayName: 'Colón',
            slug: 'colon-entre-rios',
            summary:
                'Ciudad turística con playas sobre el río Uruguay, termas y rica historia colonial.',
            description: `Colón es una encantadora ciudad ubicada en la costa del río Uruguay, en la provincia de Entre Ríos, Argentina. Conocida por sus hermosas playas de arena fina, sus aguas tranquilas y su clima templado, es un destino ideal para el turismo familiar y de descanso.

La ciudad ofrece un complejo termal de primer nivel, con aguas mineromedicinales que emergen a más de 36°C, perfecto para quienes buscan relajación y bienestar. Su casco histórico conserva edificaciones de la época colonial, como la Iglesia Inmaculada Concepción, construida en 1863.

Colón es también la puerta de entrada al Parque Nacional El Palmar, hogar de la mayor reserva de palmeras yatay del mundo. Los visitantes pueden disfrutar de diversas actividades al aire libre como paseos en lancha, pesca deportiva, senderismo, y ciclismo por sus pintorescas calles y costanera.

La gastronomía local destaca por sus pescados de río frescos, y durante todo el año la ciudad ofrece una variada agenda cultural con festivales, ferias artesanales y eventos deportivos. Su infraestructura turística incluye hoteles, cabañas, campings y una amplia oferta gastronómica para todos los gustos.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3280',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.2232',
                    long: '-58.1444'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg',
                    caption: 'Vista panorámica de Colón',
                    description: 'Hermosa vista de la costanera de Colón, Entre Ríos',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg',
                        caption: 'Playa de Colón',
                        description: 'Playa principal de Colón durante el verano',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg',
                        caption: 'Termas de Colón',
                        description: 'Complejo termal con aguas mineromedicinales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132180/pexels-photo-2132180.jpeg',
                        caption: 'Río Uruguay',
                        description: 'Vista del río Uruguay desde la costanera',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2559941/pexels-photo-2559941.jpeg',
                        caption: 'Parque Nacional El Palmar',
                        description: 'Reserva natural cercana a Colón',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg',
                        caption: 'Atardecer en Colón',
                        description: 'Hermoso atardecer sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2397414/pexels-photo-2397414.jpeg',
                        caption: 'Plaza San Martín',
                        description: 'Plaza principal de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg',
                        caption: 'Iglesia Inmaculada Concepción',
                        description: 'Iglesia histórica construida en 1863',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387871/pexels-photo-2387871.jpeg',
                        caption: 'Costanera de Colón',
                        description: 'Paseo costero junto al río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387872/pexels-photo-2387872.jpeg',
                        caption: 'Camping en Colón',
                        description: 'Área de camping con vista al río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387870/pexels-photo-2387870.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387869/pexels-photo-2387869.jpeg',
                        caption: 'Artesanías locales',
                        description: 'Feria de artesanos de Colón',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387868/pexels-photo-2387868.jpeg',
                        caption: 'Actividades acuáticas',
                        description: 'Deportes acuáticos en el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387867/pexels-photo-2387867.jpeg',
                        caption: 'Fauna local',
                        description: 'Aves y animales típicos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387866/pexels-photo-2387866.jpeg',
                        caption: 'Flora local',
                        description: 'Vegetación característica de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2387865/pexels-photo-2387865.jpeg',
                        caption: 'Puente internacional',
                        description: 'Puente que conecta Argentina con Uruguay',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Recorrido por Colón',
                        description:
                            'Video turístico mostrando los principales atractivos de Colón',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Colón, Entre Ríos - Playas, Termas y Naturaleza | Hosped.ar',
                seoDescription:
                    'Descubre Colón, Entre Ríos: playas de arena fina, termas relajantes y naturaleza exuberante. Planifica tu estadía ideal en la costa del río Uruguay.',
                seoKeywords: [
                    'Colón',
                    'Entre Ríos',
                    'playas',
                    'termas',
                    'río Uruguay',
                    'turismo',
                    'Parque El Palmar',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino principal de la costa del río Uruguay',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Colón destination created successfully', 'seedColonDestination');
        logger.query('insert', 'destinations', { name: 'colon' }, colonDestination);
    } catch (error) {
        logger.error('Failed to seed Colón destination', 'seedColonDestination', error);
        throw error;
    }
}
