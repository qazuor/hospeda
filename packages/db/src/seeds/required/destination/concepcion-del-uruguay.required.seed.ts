import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Concepción del Uruguay destination
 */
export async function seedConcepcionDelUruguayDestination() {
    dbLogger.info(
        { location: 'seedConcepcionDelUruguayDestination' },
        'Starting to seed Concepción del Uruguay destination'
    );

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'concepcion-del-uruguay-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedConcepcionDelUruguayDestination' },
                'Concepción del Uruguay destination already exists, skipping'
            );
            return;
        }

        const concepcionDelUruguayDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'concepcion-del-uruguay',
            displayName: 'Concepción del Uruguay',
            slug: 'concepcion-del-uruguay-entre-rios',
            summary:
                'Ciudad histórica con rica tradición universitaria, playas sobre el río Uruguay y patrimonio arquitectónico.',
            description: `Concepción del Uruguay, conocida como "La Histórica", es una ciudad de gran relevancia en la provincia de Entre Ríos, Argentina. Fundada en 1783 por Tomás de Rocamora, ha sido escenario de importantes acontecimientos que marcaron la historia nacional, como la declaración de la independencia de Entre Ríos y la firma del Tratado del Cuadrilátero.

La ciudad se distingue por su rico patrimonio arquitectónico e histórico. La Basílica Inmaculada Concepción, con su imponente estilo neogótico, domina el paisaje urbano. El Palacio San José, ubicado a pocos kilómetros, fue la residencia del General Justo José de Urquiza, primer presidente constitucional de Argentina, y hoy funciona como museo nacional.

Concepción del Uruguay es también conocida como "La Ciudad de los Colegios" debido a su larga tradición educativa. El Colegio Nacional, fundado por Urquiza en 1849, fue uno de los primeros del país y contribuyó a la formación de importantes figuras de la política y la cultura argentina.

Las playas sobre el río Uruguay, como Banco Pelay y La Tortuga Alegre, son los principales atractivos durante el verano, ofreciendo aguas tranquilas, arena fina y servicios para los visitantes. El puerto, uno de los más importantes de la provincia, mantiene viva la conexión de la ciudad con el río.

La gastronomía local destaca por sus pescados de río frescos, asados tradicionales y la influencia de la cocina europea traída por los inmigrantes. La ciudad cuenta con una variada oferta de alojamientos, desde hoteles urbanos hasta cabañas y campings en las zonas de playa.

A lo largo del año, Concepción del Uruguay mantiene una activa agenda cultural con festivales, exposiciones y eventos deportivos. Su ubicación estratégica y su rica historia la convierten en un destino que combina patrimonio cultural, naturaleza y recreación.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3260',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.4845',
                    long: '-58.2307'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/2559941/pexels-photo-2559941.jpeg',
                    caption: 'Basílica Inmaculada Concepción',
                    description: 'Imponente iglesia neogótica en el centro de la ciudad',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/2559941/pexels-photo-2559941.jpeg',
                        caption: 'Basílica Inmaculada Concepción',
                        description: 'Imponente iglesia neogótica en el centro de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg',
                        caption: 'Playa Banco Pelay',
                        description: 'Popular playa sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Río Uruguay',
                        description: 'Vista del río desde la costanera',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Colegio Nacional',
                        description: 'Histórica institución educativa fundada por Urquiza',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Puerto de Concepción',
                        description: 'Importante puerto fluvial de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Plaza Ramírez',
                        description: 'Plaza principal de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Costanera',
                        description: 'Paseo costero junto al río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Monumento a Urquiza',
                        description: 'Homenaje al prócer entrerriano',
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
                        description: 'Sede del gobierno local',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Parque de la Ciudad',
                        description: 'Extenso espacio verde para recreación',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca deportiva',
                        description: 'Actividad popular en el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Puente Internacional',
                        description: 'Conexión con la República Oriental del Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Atardecer en el río',
                        description: 'Espectacular puesta de sol sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Vida universitaria',
                        description: 'Estudiantes en el campus de la Universidad',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Concepción del Uruguay, La Histórica',
                        description:
                            'Recorrido por los sitios históricos y atractivos de la ciudad',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Concepción del Uruguay, Entre Ríos - La Histórica | Hosped.ar',
                seoDescription:
                    'Visita Concepción del Uruguay, ciudad histórica de Entre Ríos. Disfruta de sus playas, su rico patrimonio arquitectónico y su tradición universitaria.',
                seoKeywords: [
                    'Concepción del Uruguay',
                    'Entre Ríos',
                    'La Histórica',
                    'playas',
                    'río Uruguay',
                    'Urquiza',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Ciudad histórica con importante patrimonio cultural',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedConcepcionDelUruguayDestination' },
            'Concepción del Uruguay destination created successfully'
        );
        dbLogger.query(
            'insert',
            'destinations',
            { name: 'concepcion-del-uruguay' },
            concepcionDelUruguayDestination
        );
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Concepción del Uruguay destination in seedConcepcionDelUruguayDestination'
        );
        throw error;
    }
}
