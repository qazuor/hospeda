import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Gualeguaychú destination
 */
export async function seedGualeguaychuDestination() {
    logger.info('Starting to seed Gualeguaychú destination', 'seedGualeguaychuDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'gualeguaychu-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info(
                'Gualeguaychú destination already exists, skipping',
                'seedGualeguaychuDestination'
            );
            return;
        }

        const gualeguaychuDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'gualeguaychu',
            displayName: 'Gualeguaychú',
            slug: 'gualeguaychu-entre-rios',
            summary:
                'Ciudad del carnaval, con hermosas playas sobre el río Gualeguaychú y una vibrante vida cultural.',
            description: `Gualeguaychú es una ciudad ubicada en el sureste de la provincia de Entre Ríos, Argentina, a orillas del río homónimo. Es ampliamente conocida como la "Capital del Carnaval" de Argentina, celebrando uno de los carnavales más espectaculares de Sudamérica, que atrae a miles de turistas cada año con sus coloridos desfiles, comparsas y carrozas en el famoso Corsódromo.

Más allá de su carnaval, Gualeguaychú ofrece hermosas playas de arena fina a lo largo del río, como Playa Norte, Playa del Puente y Ñandubaysal, esta última considerada una de las mejores playas fluviales de Argentina. Sus aguas tranquilas son ideales para la natación, deportes acuáticos y pesca.

La ciudad cuenta con un rico patrimonio histórico y cultural, reflejado en edificios como el Teatro Gualeguaychú, el Palacio Municipal y la Catedral San José. El Parque Unzué, con sus extensos jardines, árboles centenarios y vistas al río, es un espacio verde emblemático para paseos y recreación.

La gastronomía local destaca por sus pescados de río frescos, asados tradicionales y repostería artesanal. La ciudad ofrece una variada oferta de alojamientos, desde hoteles boutique hasta cabañas y campings, especialmente en la zona de balnearios.

Durante todo el año, Gualeguaychú mantiene una activa agenda cultural con festivales, exposiciones y eventos deportivos. Su proximidad a Buenos Aires (230 km) la convierte en un destino accesible para escapadas de fin de semana, mientras que su ambiente relajado y sus atractivos naturales invitan a estadías más prolongadas.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '2820',
                country: 'Argentina',
                coordinates: {
                    lat: '-33.0094',
                    long: '-58.5172'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg',
                    caption: 'Vista panorámica de Gualeguaychú',
                    description: 'Hermosa vista del río Gualeguaychú y la ciudad',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg',
                        caption: 'Carnaval de Gualeguaychú',
                        description: 'Colorido desfile de comparsas en el Corsódromo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2559941/pexels-photo-2559941.jpeg',
                        caption: 'Playa Ñandubaysal',
                        description: 'Hermosa playa de arena fina sobre el río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Río Gualeguaychú',
                        description: 'Aguas tranquilas ideales para deportes acuáticos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Parque Unzué',
                        description: 'Extenso parque con árboles centenarios',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Catedral San José',
                        description: 'Imponente iglesia en el centro de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Teatro Gualeguaychú',
                        description: 'Histórico teatro con arquitectura clásica',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Costanera',
                        description: 'Paseo costero junto al río Gualeguaychú',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Corsódromo',
                        description: 'Escenario principal del carnaval',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1319829/pexels-photo-1319829.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos con pescados de río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Palacio Municipal',
                        description: 'Edificio histórico de la administración local',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Reserva Natural Las Piedras',
                        description: 'Área protegida con rica biodiversidad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca deportiva',
                        description: 'Actividad popular en el río Gualeguaychú',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Puente Méndez Casariego',
                        description: 'Histórico puente sobre el río Gualeguaychú',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Atardecer en Gualeguaychú',
                        description: 'Espectacular puesta de sol sobre el río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Vida nocturna',
                        description: 'Animada escena nocturna durante la temporada de carnaval',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Carnaval de Gualeguaychú',
                        description: 'Video mostrando los coloridos desfiles del famoso carnaval',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Gualeguaychú, Entre Ríos - Carnaval, Playas y Cultura | Hosped.ar',
                seoDescription:
                    'Descubre Gualeguaychú, la Capital del Carnaval argentino. Disfruta de sus playas, su vibrante cultura y su famoso carnaval en la costa del río.',
                seoKeywords: [
                    'Gualeguaychú',
                    'Entre Ríos',
                    'carnaval',
                    'playas',
                    'río Gualeguaychú',
                    'Ñandubaysal',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino destacado por su carnaval y playas',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Gualeguaychú destination created successfully', 'seedGualeguaychuDestination');
        logger.query('insert', 'destinations', { name: 'gualeguaychu' }, gualeguaychuDestination);
    } catch (error) {
        logger.error(
            'Failed to seed Gualeguaychú destination',
            'seedGualeguaychuDestination',
            error
        );
        throw error;
    }
}
