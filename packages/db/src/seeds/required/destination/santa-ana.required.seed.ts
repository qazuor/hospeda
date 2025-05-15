import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Santa Ana destination
 */
export async function seedSantaAnaDestination() {
    logger.info('Starting to seed Santa Ana destination', 'seedSantaAnaDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'santa-ana-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info(
                'Santa Ana destination already exists, skipping',
                'seedSantaAnaDestination'
            );
            return;
        }

        const santaAnaDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'santa-ana',
            displayName: 'Santa Ana',
            slug: 'santa-ana-entre-rios',
            summary:
                'Histórica colonia agrícola con castillo medieval, rodeada de naturaleza y tradición rural.',
            description: `Santa Ana es una pequeña localidad ubicada en el departamento Federación, en la provincia de Entre Ríos, Argentina. Este pintoresco pueblo, fundado como colonia agrícola en 1900, conserva el encanto de las comunidades rurales entrerrianas y ofrece a los visitantes una experiencia auténtica lejos del turismo masivo.

El atractivo más destacado y sorprendente de Santa Ana es el Castillo de Santa Ana, una impresionante construcción de estilo medieval edificada entre 1947 y 1960 por el inmigrante italiano Domingo Bergoglio. Esta peculiar edificación, con sus torres, almenas y un foso, parece sacada de un cuento europeo y contrasta notablemente con el paisaje rural entrerriano. Actualmente funciona como hotel y restaurante, permitiendo a los visitantes hospedarse en un entorno verdaderamente único.

El entorno natural de Santa Ana es otro de sus grandes atractivos. La localidad está rodeada de suaves colinas, arroyos y una vegetación exuberante que invita a paseos y actividades al aire libre. El Arroyo Grande, que fluye cerca del pueblo, ofrece posibilidades para la pesca y el baño en sus aguas cristalinas durante el verano.

La vida en Santa Ana transcurre a un ritmo pausado, típico de las comunidades rurales. Sus habitantes, en su mayoría dedicados a la agricultura y la ganadería, mantienen vivas las tradiciones criollas y la hospitalidad característica de la región. Las fiestas populares, como la celebración patronal de Santa Ana el 26 de julio, son momentos donde la comunidad se reúne y comparte su cultura con los visitantes.

La gastronomía local refleja la herencia criolla y europea, con platos como el asado, los guisos, las empanadas y los dulces caseros. Los productos frescos de las chacras cercanas son la base de una cocina sencilla pero sabrosa.

Aunque la infraestructura turística es limitada, además del castillo-hotel, existen algunas opciones de alojamiento rural y servicios básicos para los visitantes. Su proximidad a Federación (aproximadamente 30 km) permite complementar la visita con las termas y otros atractivos de esa ciudad.

Santa Ana representa un destino ideal para quienes buscan descubrir la autenticidad de la vida rural entrerriana, disfrutar de la naturaleza y sorprenderse con la inesperada presencia de un castillo medieval en medio del campo argentino.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3212',
                country: 'Argentina',
                coordinates: {
                    lat: '-30.9003',
                    long: '-58.3333'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                    caption: 'Castillo de Santa Ana',
                    description:
                        'Impresionante construcción de estilo medieval en medio del campo entrerriano',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Castillo medieval',
                        description: 'Edificación única construida por Domingo Bergoglio',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132132/pexels-photo-2132132.jpeg',
                        caption: 'Paisaje rural',
                        description: 'Entorno natural que rodea la localidad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132133/pexels-photo-2132133.jpeg',
                        caption: 'Arroyo Grande',
                        description: 'Curso de agua que atraviesa la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132134/pexels-photo-2132134.jpeg',
                        caption: 'Plaza del pueblo',
                        description: 'Espacio central de la localidad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132135/pexels-photo-2132135.jpeg',
                        caption: 'Iglesia de Santa Ana',
                        description: 'Templo religioso del pueblo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132136/pexels-photo-2132136.jpeg',
                        caption: 'Caminos rurales',
                        description: 'Rutas pintorescas entre campos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132137/pexels-photo-2132137.jpeg',
                        caption: 'Producción agrícola',
                        description: 'Cultivos tradicionales de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132138/pexels-photo-2132138.jpeg',
                        caption: 'Alojamiento rural',
                        description: 'Opciones de hospedaje en el campo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132139/pexels-photo-2132139.jpeg',
                        caption: 'Fiesta patronal',
                        description: 'Celebración en honor a Santa Ana',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132140/pexels-photo-2132140.jpeg',
                        caption: 'Atardecer en Santa Ana',
                        description: 'Puesta de sol sobre los campos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Fauna local',
                        description: 'Animales autóctonos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca en el arroyo',
                        description: 'Actividad recreativa popular',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Interior del castillo',
                        description: 'Salones y habitaciones de estilo medieval',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Gastronomía criolla',
                        description: 'Platos tradicionales de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Vida rural',
                        description: 'Actividades cotidianas de los habitantes',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Castillo de Santa Ana',
                        description: 'Recorrido por esta sorprendente construcción medieval',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Santa Ana, Entre Ríos - Castillo Medieval y Tradición Rural | Hosped.ar',
                seoDescription:
                    'Descubre Santa Ana en Entre Ríos, hogar de un sorprendente castillo medieval. Disfruta de la tranquilidad rural, naturaleza y tradiciones auténticas.',
                seoKeywords: [
                    'Santa Ana',
                    'Entre Ríos',
                    'castillo medieval',
                    'turismo rural',
                    'Arroyo Grande',
                    'tradiciones',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino rural con atractivo arquitectónico único',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Santa Ana destination created successfully', 'seedSantaAnaDestination');
        logger.query('insert', 'destinations', { name: 'santa-ana' }, santaAnaDestination);
    } catch (error) {
        logger.error('Failed to seed Santa Ana destination', 'seedSantaAnaDestination', error);
        throw error;
    }
}
