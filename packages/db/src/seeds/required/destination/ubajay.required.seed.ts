import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Ubajay destination
 */
export async function seedUbajayDestination() {
    dbLogger.info({ location: 'seedUbajayDestination' }, 'Starting to seed Ubajay destination');

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'ubajay-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedUbajayDestination' },
                'Ubajay destination already exists, skipping'
            );
            return;
        }

        const ubajayDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'ubajay',
            displayName: 'Ubajay',
            slug: 'ubajay-entre-rios',
            summary:
                'Puerta de entrada al Parque Nacional El Palmar, con su bosque de palmeras yatay y rica biodiversidad.',
            description: `Ubajay es una pequeña localidad ubicada en el departamento Colón, en la provincia de Entre Ríos, Argentina. Su nombre, de origen guaraní, significa "árbol del paraíso" o "árbol del cielo", lo que ya sugiere la riqueza natural que caracteriza a esta zona.

La principal relevancia de Ubajay radica en ser la puerta de entrada al Parque Nacional El Palmar, una de las áreas protegidas más importantes de Argentina. Este parque, creado en 1966 para preservar el ecosistema de palmeras yatay (Butia yatay), alberga el último gran palmeral de esta especie en el mundo, con ejemplares que pueden alcanzar los 400 años de edad.

El pueblo en sí es tranquilo y pequeño, con una población de aproximadamente 3.000 habitantes. Su economía se basa principalmente en la agricultura, la ganadería y, cada vez más, en el turismo vinculado al parque nacional. La localidad cuenta con servicios básicos para los visitantes, como estaciones de servicio, algunos restaurantes, almacenes y opciones de alojamiento modestas.

La vida en Ubajay transcurre a un ritmo pausado, típico de las pequeñas comunidades rurales. Su plaza central, la iglesia y algunos comercios conforman el núcleo urbano. Los habitantes son conocidos por su hospitalidad y su conocimiento sobre el entorno natural que los rodea.

Además del Parque Nacional El Palmar, los alrededores de Ubajay ofrecen otros atractivos naturales como arroyos, campos y bosques nativos que invitan a la exploración y el contacto con la naturaleza. La pesca en los cursos de agua cercanos es una actividad popular tanto para locales como para visitantes.

Para los turistas que visitan la región, Ubajay representa una base estratégica para explorar no solo El Palmar sino también otros destinos cercanos como Colón, Villa Elisa y sus termas, o las playas del río Uruguay. La localidad, aunque pequeña, juega un papel importante en el circuito turístico de la costa del río Uruguay en Entre Ríos.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3287',
                country: 'Argentina',
                coordinates: {
                    lat: '-31.7936',
                    long: '-58.3128'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/2132132/pexels-photo-2132132.jpeg',
                    caption: 'Palmeras yatay en El Palmar',
                    description: 'Característico paisaje del Parque Nacional El Palmar',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/2132132/pexels-photo-2132132.jpeg',
                        caption: 'Palmeras yatay',
                        description: 'Bosque de palmeras autóctonas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132133/pexels-photo-2132133.jpeg',
                        caption: 'Parque Nacional El Palmar',
                        description: 'Entrada al área protegida',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132134/pexels-photo-2132134.jpeg',
                        caption: 'Fauna del parque',
                        description: 'Animales autóctonos en su hábitat natural',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132135/pexels-photo-2132135.jpeg',
                        caption: 'Arroyo Los Loros',
                        description: 'Curso de agua que atraviesa el parque',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132136/pexels-photo-2132136.jpeg',
                        caption: 'Senderos interpretativos',
                        description: 'Caminos para recorrer el parque',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132137/pexels-photo-2132137.jpeg',
                        caption: 'Flora autóctona',
                        description: 'Vegetación característica de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132138/pexels-photo-2132138.jpeg',
                        caption: 'Pueblo de Ubajay',
                        description: 'Vista del centro de la localidad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132139/pexels-photo-2132139.jpeg',
                        caption: 'Iglesia local',
                        description: 'Templo religioso del pueblo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132140/pexels-photo-2132140.jpeg',
                        caption: 'Atardecer en El Palmar',
                        description: 'Puesta de sol entre las palmeras',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Camping en El Palmar',
                        description: 'Área de acampe dentro del parque nacional',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca en arroyos',
                        description: 'Actividad recreativa en los cursos de agua',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Mirador del parque',
                        description: 'Punto panorámico para observar el palmeral',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Aves del parque',
                        description: 'Rica avifauna que habita en el área protegida',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
                        caption: 'Alojamientos turísticos',
                        description: 'Opciones de hospedaje para visitantes',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Parque Nacional El Palmar',
                        description: 'Recorrido por el área protegida y sus palmeras yatay',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Ubajay, Entre Ríos - Puerta al Parque Nacional El Palmar | Hosped.ar',
                seoDescription:
                    'Visita Ubajay, entrada al Parque Nacional El Palmar. Descubre el mayor palmeral de yatay del mundo, su biodiversidad y la tranquilidad de este pueblo entrerriano.',
                seoKeywords: [
                    'Ubajay',
                    'Entre Ríos',
                    'El Palmar',
                    'palmeras yatay',
                    'parque nacional',
                    'naturaleza',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino estratégico para acceder al Parque Nacional El Palmar',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedUbajayDestination' },
            'Ubajay destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'ubajay' }, ubajayDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Ubajay destination in seedUbajayDestination'
        );
        throw error;
    }
}
