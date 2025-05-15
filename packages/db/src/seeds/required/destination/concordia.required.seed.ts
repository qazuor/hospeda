import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Concordia destination
 */
export async function seedConcordiaDestination() {
    logger.info('Starting to seed Concordia destination', 'seedConcordiaDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'concordia-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info(
                'Concordia destination already exists, skipping',
                'seedConcordiaDestination'
            );
            return;
        }

        const concordiaDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'concordia',
            displayName: 'Concordia',
            slug: 'concordia-entre-rios',
            summary:
                'Ciudad termal con rica producción citrícola, ubicada a orillas del río Uruguay y el embalse Salto Grande.',
            description: `Concordia es la segunda ciudad más grande de la provincia de Entre Ríos, Argentina, ubicada estratégicamente en la costa del río Uruguay, frente a la ciudad uruguaya de Salto. Conocida como la "Capital Nacional de la Citricultura", es famosa por sus extensas plantaciones de naranjas, mandarinas y limones que tiñen de verde y naranja el paisaje circundante.

El principal atractivo turístico de Concordia son sus complejos termales, considerados entre los mejores de Argentina. Las aguas termales, que emergen a temperaturas entre 36°C y 47°C, son ricas en minerales con propiedades terapéuticas que atraen a miles de visitantes en busca de relajación y bienestar.

La ciudad está marcada por la imponente presencia de la represa hidroeléctrica de Salto Grande, una obra binacional que forma un extenso lago artificial ideal para la práctica de deportes acuáticos. Su costanera renovada ofrece espacios verdes, ciclovías y miradores con vistas espectaculares al río Uruguay.

El patrimonio histórico de Concordia incluye edificios de estilo neoclásico y art déco, como el Palacio San Carlos y la Catedral San Antonio de Padua. La ciudad mantiene un ambiente tranquilo pero vibrante, con una activa vida cultural que se manifiesta en festivales, como la Fiesta Nacional de la Citricultura.

Los amantes de la naturaleza pueden disfrutar de las playas sobre el río Uruguay, como Playa Los Sauces y Playa La Tortuga Alegre, o explorar las islas cercanas. La gastronomía local destaca por sus pescados de río frescos y los productos derivados de los cítricos, desde dulces hasta licores artesanales.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3200',
                country: 'Argentina',
                coordinates: {
                    lat: '-31.3896',
                    long: '-58.0209'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg',
                    caption: 'Vista panorámica de Concordia',
                    description: 'Hermosa vista de la ciudad de Concordia y el río Uruguay',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg',
                        caption: 'Termas de Concordia',
                        description: 'Complejo termal con aguas mineromedicinales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg',
                        caption: 'Represa Salto Grande',
                        description: 'Impresionante obra de ingeniería binacional',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1268076/pexels-photo-1268076.jpeg',
                        caption: 'Plantaciones de cítricos',
                        description: 'Extensos cultivos de naranjas y mandarinas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Costanera de Concordia',
                        description: 'Paseo costero junto al río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Playa Los Sauces',
                        description: 'Popular playa sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Catedral San Antonio de Padua',
                        description: 'Imponente iglesia en el centro de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Palacio San Carlos',
                        description: 'Edificio histórico de estilo neoclásico',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Lago de Salto Grande',
                        description: 'Extenso lago artificial ideal para deportes acuáticos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Parque San Carlos',
                        description: 'Extenso parque con vegetación autóctona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1319829/pexels-photo-1319829.jpeg',
                        caption: 'Productos cítricos',
                        description: 'Variedad de frutas cítricas de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Castillo San Carlos',
                        description: 'Histórica construcción con vista al río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Isla Cambacuá',
                        description: 'Isla en el río Uruguay con playas vírgenes',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca en el río Uruguay',
                        description: 'Actividad popular entre locales y turistas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Puente Internacional',
                        description: 'Puente que conecta Argentina con Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Atardecer en Concordia',
                        description: 'Espectacular puesta de sol sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Recorrido por Concordia',
                        description:
                            'Video turístico mostrando los principales atractivos de Concordia',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Concordia, Entre Ríos - Termas, Cítricos y Naturaleza | Hosped.ar',
                seoDescription:
                    'Visita Concordia, Entre Ríos: disfruta de sus termas curativas, plantaciones de cítricos y hermosas playas sobre el río Uruguay. Tu destino ideal.',
                seoKeywords: [
                    'Concordia',
                    'Entre Ríos',
                    'termas',
                    'cítricos',
                    'Salto Grande',
                    'río Uruguay',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Segundo destino más importante de la costa del río Uruguay',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Concordia destination created successfully', 'seedConcordiaDestination');
        logger.query('insert', 'destinations', { name: 'concordia' }, concordiaDestination);
    } catch (error) {
        logger.error('Failed to seed Concordia destination', 'seedConcordiaDestination', error);
        throw error;
    }
}
