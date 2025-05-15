import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Ibicuy destination
 */
export async function seedIbicuyDestination() {
    logger.info('Starting to seed Ibicuy destination', 'seedIbicuyDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'ibicuy-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info('Ibicuy destination already exists, skipping', 'seedIbicuyDestination');
            return;
        }

        const ibicuyDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'ibicuy',
            displayName: 'Ibicuy',
            slug: 'ibicuy-entre-rios',
            summary:
                'Localidad isleña con rica biodiversidad, ideal para ecoturismo, pesca y contacto con la naturaleza del delta.',
            description: `Ibicuy es una pintoresca localidad ubicada en el extremo sur de la provincia de Entre Ríos, Argentina, en el departamento Islas del Ibicuy. Su nombre, de origen guaraní, significa "tierra de arena" o "arena fina", haciendo referencia a las características del suelo de la región.

Lo que hace especial a Ibicuy es su ubicación geográfica privilegiada en pleno Delta del Paraná, rodeada de ríos, arroyos e islas que conforman un ecosistema único. Esta condición isleña determina no solo el paisaje, sino también el estilo de vida de sus aproximadamente 4.000 habitantes, quienes mantienen una estrecha relación con el agua y los recursos naturales que los rodean.

La principal actividad económica tradicional ha sido la forestación, principalmente de sauces y álamos, aunque también son importantes la pesca, la apicultura, la ganadería en islas y, cada vez más, el turismo. El puerto de Ibicuy, que en su momento fue uno de los más profundos de la región, es testigo de la historia comercial y del transporte fluvial de la zona.

Para los visitantes, Ibicuy ofrece una experiencia auténtica de contacto con la naturaleza del delta. Los paseos en lancha por los arroyos permiten descubrir la rica biodiversidad local, con su variedad de aves, peces y vegetación típica de humedales. La pesca deportiva es una actividad muy popular, con especies codiciadas como el dorado, el surubí y el pacú.

Las playas de arena fina a orillas del río Ibicuy son ideales para el descanso durante los meses de verano, ofreciendo un ambiente tranquilo y familiar. Los campings y cabañas en las islas brindan la oportunidad de pernoctar en pleno contacto con la naturaleza, desconectándose del ritmo acelerado de las ciudades.

La gastronomía local destaca por sus pescados de río frescos, preparados según recetas tradicionales, y los productos derivados de la apicultura, como la miel y propóleos de alta calidad. La cultura isleña se manifiesta también en artesanías elaboradas con materiales de la zona, como juncos y maderas.

Aunque la infraestructura turística es básica, esto forma parte del encanto de Ibicuy como destino para quienes buscan autenticidad y un turismo más cercano a la naturaleza y a las formas de vida tradicionales del delta entrerriano.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '2846',
                country: 'Argentina',
                coordinates: {
                    lat: '-33.7389',
                    long: '-59.1714'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1287075/pexels-photo-1287075.jpeg',
                    caption: 'Delta en Ibicuy',
                    description: 'Paisaje de islas y arroyos característico de la región',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1287075/pexels-photo-1287075.jpeg',
                        caption: 'Delta del Paraná',
                        description: 'Sistema de islas y arroyos en Ibicuy',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Río Ibicuy',
                        description: 'Principal curso de agua de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Playa de arena',
                        description: 'Característica playa de arena fina',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Puerto de Ibicuy',
                        description: 'Histórico puerto fluvial',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Pueblo de Ibicuy',
                        description: 'Vista del centro urbano',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Paseos en lancha',
                        description: 'Excursiones por los arroyos del delta',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Pesca deportiva',
                        description: 'Actividad popular en los ríos de la zona',
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
                        caption: 'Estación de tren',
                        description: 'Histórica estación ferroviaria',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Camping isleño',
                        description: 'Área de acampe en entorno natural',
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
                        caption: 'Flora isleña',
                        description: 'Vegetación típica de los humedales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Atardecer en el delta',
                        description: 'Puesta de sol sobre los arroyos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Artesanías locales',
                        description: 'Productos elaborados con materiales de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
                        caption: 'Producción de miel',
                        description: 'Apicultura, actividad económica importante',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Delta de Ibicuy',
                        description: 'Recorrido por los arroyos y la vida isleña',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Ibicuy, Entre Ríos - Paraíso Natural del Delta | Hosped.ar',
                seoDescription:
                    'Descubre Ibicuy en el Delta del Paraná: disfruta de sus playas de arena fina, pesca deportiva y la auténtica vida isleña en un entorno natural único.',
                seoKeywords: [
                    'Ibicuy',
                    'Entre Ríos',
                    'delta',
                    'islas',
                    'pesca',
                    'playas',
                    'ecoturismo',
                    'río Paraná',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino ideal para ecoturismo y pesca en el delta',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Ibicuy destination created successfully', 'seedIbicuyDestination');
        logger.query('insert', 'destinations', { name: 'ibicuy' }, ibicuyDestination);
    } catch (error) {
        logger.error('Failed to seed Ibicuy destination', 'seedIbicuyDestination', error);
        throw error;
    }
}
