import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Puerto Yeruá destination
 */
export async function seedPuertoYeruaDestination() {
    dbLogger.info(
        { location: 'seedPuertoYeruaDestination' },
        'Starting to seed Puerto Yeruá destination'
    );

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'puerto-yerua-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedPuertoYeruaDestination' },
                'Puerto Yeruá destination already exists, skipping'
            );
            return;
        }

        const puertoYeruaDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'puerto-yerua',
            displayName: 'Puerto Yeruá',
            slug: 'puerto-yerua-entre-rios',
            summary:
                'Pequeña localidad con impresionantes barrancas sobre el río Uruguay y tranquilas playas de arena.',
            description: `Puerto Yeruá es una pintoresca localidad ubicada en el departamento Concordia, en la provincia de Entre Ríos, Argentina. Situada a orillas del río Uruguay, a unos 30 kilómetros al sur de la ciudad de Concordia, este pequeño pueblo de apenas 1.500 habitantes ofrece un encanto especial para los visitantes que buscan tranquilidad y contacto con la naturaleza.

El rasgo más distintivo de Puerto Yeruá son sus impresionantes barrancas rojizas que se elevan hasta 40 metros sobre el nivel del río Uruguay, formando un paisaje de singular belleza. Estas formaciones geológicas, compuestas principalmente de arenisca, datan de millones de años y contienen fósiles marinos que evidencian que la región estuvo sumergida bajo el mar en tiempos prehistóricos.

Las playas de Puerto Yeruá, con su arena fina y aguas tranquilas, son ideales para el descanso y la recreación durante los meses de verano. A diferencia de destinos más concurridos, aquí es posible disfrutar del río en un ambiente familiar y relajado, perfecto para quienes buscan escapar del turismo masivo.

La pesca es una de las actividades más populares, tanto para los habitantes locales como para los turistas. El río Uruguay ofrece una gran variedad de especies, como dorados, surubíes, bogas y patíes, atrayendo a pescadores deportivos durante todo el año.

El pueblo conserva un ambiente rural y tranquilo, con casas bajas, calles arboladas y un ritmo de vida pausado. La plaza principal, la iglesia y algunos almacenes históricos conforman el modesto centro urbano. La gastronomía local destaca por sus pescados de río frescos, preparados con recetas tradicionales.

La infraestructura turística es básica pero suficiente, con algunos campings, cabañas y servicios de comida. Su cercanía a Concordia permite a los visitantes acceder a más opciones de alojamiento y servicios si así lo desean.

Puerto Yeruá representa un destino ideal para quienes buscan desconectar, disfrutar de la naturaleza y experimentar la vida tranquila de un pueblo ribereño con un paisaje único en la región.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3201',
                country: 'Argentina',
                coordinates: {
                    lat: '-31.5289',
                    long: '-58.0139'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                    caption: 'Barrancas de Puerto Yeruá',
                    description: 'Impresionantes formaciones rojizas sobre el río Uruguay',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
                        caption: 'Barrancas rojizas',
                        description: 'Formaciones geológicas características de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
                        caption: 'Playa de Puerto Yeruá',
                        description: 'Tranquila playa de arena sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Río Uruguay',
                        description: 'Vista del río desde las barrancas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Pueblo de Puerto Yeruá',
                        description: 'Vista del pequeño centro urbano',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Pesca en el río',
                        description: 'Pescadores en la costa del río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Atardecer en las barrancas',
                        description: 'Puesta de sol sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1319829/pexels-photo-1319829.jpeg',
                        caption: 'Fósiles marinos',
                        description: 'Restos prehistóricos en las formaciones rocosas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Iglesia local',
                        description: 'Templo religioso del pueblo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Camping ribereño',
                        description: 'Área de camping junto al río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Fauna local',
                        description: 'Aves y animales típicos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Senderos naturales',
                        description: 'Caminos para recorrer las barrancas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Mirador natural',
                        description: 'Punto panorámico sobre las barrancas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos con pescados de río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
                        caption: 'Cabañas turísticas',
                        description: 'Alojamientos para visitantes',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1391487/pexels-photo-1391487.jpeg',
                        caption: 'Vida rural',
                        description: 'Actividades cotidianas de los habitantes',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Barrancas de Puerto Yeruá',
                        description: 'Recorrido por las impresionantes formaciones geológicas',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Puerto Yeruá, Entre Ríos - Barrancas y Playas Naturales | Hosped.ar',
                seoDescription:
                    'Visita Puerto Yeruá en Entre Ríos: descubre sus impresionantes barrancas rojizas, tranquilas playas sobre el río Uruguay y un ambiente rural auténtico.',
                seoKeywords: [
                    'Puerto Yeruá',
                    'Entre Ríos',
                    'barrancas',
                    'río Uruguay',
                    'playas',
                    'pesca',
                    'fósiles',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino tranquilo con atractivos naturales únicos',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedPuertoYeruaDestination' },
            'Puerto Yeruá destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'puerto-yerua' }, puertoYeruaDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Puerto Yeruá destination in seedPuertoYeruaDestination'
        );
        throw error;
    }
}
