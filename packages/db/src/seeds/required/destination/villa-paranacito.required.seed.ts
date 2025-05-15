import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Villa Paranacito destination
 */
export async function seedVillaParanacitoDestination() {
    logger.info('Starting to seed Villa Paranacito destination', 'seedVillaParanacitoDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'villa-paranacito-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info(
                'Villa Paranacito destination already exists, skipping',
                'seedVillaParanacitoDestination'
            );
            return;
        }

        const villaParanacitoDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'villa-paranacito',
            displayName: 'Villa Paranacito',
            slug: 'villa-paranacito-entre-rios',
            summary:
                'Pintoresca localidad isleña rodeada de ríos y arroyos, ideal para el ecoturismo y la pesca.',
            description: `Villa Paranacito es una encantadora localidad ubicada en el departamento Islas del Ibicuy, en el extremo sur de la provincia de Entre Ríos, Argentina. Su característica más distintiva es su condición de pueblo isleño, rodeado por los ríos Paraná y Uruguay, lo que le confiere un paisaje único de islas, arroyos y humedales.

Esta pequeña localidad de aproximadamente 4.000 habitantes ofrece una experiencia turística auténtica y tranquila, lejos del bullicio de las grandes ciudades. Su entorno natural privilegiado la convierte en un destino ideal para los amantes del ecoturismo, la pesca deportiva y las actividades náuticas.

El Delta entrerriano que rodea Villa Paranacito constituye un ecosistema de gran biodiversidad, hogar de numerosas especies de aves, peces y flora autóctona. Los paseos en lancha por los arroyos y canales permiten descubrir este paraíso natural, con sus juncos, ceibos en flor y la vida silvestre en su hábitat natural.

La Fiesta Nacional del Isleño, celebrada anualmente, es uno de los eventos culturales más importantes, donde se exhiben las tradiciones, gastronomía y artesanías locales. Los platos típicos incluyen pescados de río como el dorado, el surubí y el pacú, preparados con recetas tradicionales.

La infraestructura turística incluye cabañas, bungalows y campings, muchos de ellos ubicados a orillas de los arroyos, ofreciendo una experiencia de alojamiento en pleno contacto con la naturaleza. Las actividades más populares incluyen la pesca, paseos en kayak, avistamiento de aves y simplemente disfrutar del ritmo pausado y la hospitalidad de sus habitantes.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '2823',
                country: 'Argentina',
                coordinates: {
                    lat: '-33.7303',
                    long: '-58.6619'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1287075/pexels-photo-1287075.jpeg',
                    caption: 'Delta de Villa Paranacito',
                    description: 'Hermoso paisaje de islas y arroyos del delta entrerriano',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1287075/pexels-photo-1287075.jpeg',
                        caption: 'Arroyos del Delta',
                        description: 'Red de arroyos que rodean Villa Paranacito',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg',
                        caption: 'Paseos en lancha',
                        description: 'Excursiones para recorrer los canales del delta',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1268076/pexels-photo-1268076.jpeg',
                        caption: 'Flora isleña',
                        description: 'Vegetación típica de los humedales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Pesca deportiva',
                        description: 'Actividad popular entre turistas y locales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Cabañas isleñas',
                        description: 'Alojamientos típicos a orillas de los arroyos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Aves del delta',
                        description: 'Rica avifauna que habita en los humedales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Atardecer en el delta',
                        description: 'Espectacular puesta de sol sobre los arroyos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Kayak en Villa Paranacito',
                        description: 'Recorridos en kayak por los canales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Fiesta Nacional del Isleño',
                        description: 'Celebración tradicional de la cultura local',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1319829/pexels-photo-1319829.jpeg',
                        caption: 'Gastronomía isleña',
                        description: 'Platos típicos con pescados de río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Artesanías locales',
                        description: 'Productos artesanales elaborados por isleños',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Camping en las islas',
                        description: 'Áreas de camping en entorno natural',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Fauna del delta',
                        description: 'Animales autóctonos en su hábitat natural',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Puentes isleños',
                        description: 'Conexiones entre las diferentes islas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Vida isleña',
                        description: 'Cotidianidad de los habitantes locales',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Delta de Villa Paranacito',
                        description: 'Recorrido por los arroyos y canales del delta entrerriano',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Villa Paranacito, Entre Ríos - Paraíso del Delta | Hosped.ar',
                seoDescription:
                    'Descubre Villa Paranacito, un tesoro escondido en el delta entrerriano. Disfruta de la naturaleza, pesca y navegación en un entorno de islas y arroyos.',
                seoKeywords: [
                    'Villa Paranacito',
                    'Entre Ríos',
                    'delta',
                    'islas',
                    'pesca',
                    'ecoturismo',
                    'arroyos',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino ideal para ecoturismo y pesca',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info(
            'Villa Paranacito destination created successfully',
            'seedVillaParanacitoDestination'
        );
        logger.query(
            'insert',
            'destinations',
            { name: 'villa-paranacito' },
            villaParanacitoDestination
        );
    } catch (error) {
        logger.error(
            'Failed to seed Villa Paranacito destination',
            'seedVillaParanacitoDestination',
            error
        );
        throw error;
    }
}
