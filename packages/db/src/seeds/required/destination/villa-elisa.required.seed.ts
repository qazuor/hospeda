import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Villa Elisa destination
 */
export async function seedVillaElisaDestination() {
    dbLogger.info(
        { location: 'seedVillaElisaDestination' },
        'Starting to seed Villa Elisa destination'
    );

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'villa-elisa-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedVillaElisaDestination' },
                'Villa Elisa destination already exists, skipping'
            );
            return;
        }

        const villaElisaDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'villa-elisa',
            displayName: 'Villa Elisa',
            slug: 'villa-elisa-entre-rios',
            summary:
                'Ciudad termal con herencia de inmigrantes europeos, rodeada de naturaleza y tradición agrícola.',
            description: `Villa Elisa es una encantadora ciudad ubicada en el departamento Colón, en la provincia de Entre Ríos, Argentina. Fundada en 1890 por inmigrantes piamonteses, suizos y saboyanos, conserva un rico legado cultural europeo que se refleja en su arquitectura, gastronomía y tradiciones.

La principal atracción turística de Villa Elisa es su complejo termal "Termas Villa Elisa", uno de los más modernos y completos de la región. Sus aguas termales, que emergen a 41°C desde más de 1.000 metros de profundidad, son ricas en minerales con propiedades terapéuticas. El complejo cuenta con múltiples piscinas cubiertas y al aire libre, spa, áreas recreativas y servicios de salud.

El Palacio San José, ubicado a pocos kilómetros de la ciudad, es un importante sitio histórico nacional. Esta mansión neorrenacentista fue la residencia del General Justo José de Urquiza, primer presidente constitucional de Argentina, y hoy funciona como museo histórico nacional.

La ciudad está rodeada de un paisaje rural de suaves colinas, campos cultivados y arroyos, ideal para el turismo de naturaleza y actividades al aire libre. El Parque Nacional El Palmar, con su reserva de palmeras yatay, se encuentra a corta distancia.

Villa Elisa mantiene viva su herencia europea a través de festivales como la Fiesta Provincial del Inmigrante y la Fiesta de las Colectividades, donde se celebran las tradiciones de los pueblos fundadores con música, danzas y gastronomía típica. Los productos regionales, como quesos, embutidos, miel y vinos artesanales, son parte importante de su identidad cultural y atractivo turístico.

La infraestructura de la ciudad incluye hoteles, apart-hoteles, cabañas y campings, así como restaurantes que ofrecen tanto cocina internacional como platos regionales. Su ubicación estratégica, a 30 km de Colón y cerca de otras localidades turísticas de la costa del río Uruguay, la convierte en una excelente base para explorar la región.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3265',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.1631',
                    long: '-58.4008'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
                    caption: 'Termas de Villa Elisa',
                    description: 'Moderno complejo termal con múltiples piscinas',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
                        caption: 'Piscinas termales',
                        description: 'Variedad de piscinas con diferentes temperaturas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132126/pexels-photo-2132126.jpeg',
                        caption: 'Plaza principal',
                        description: 'Plaza central de Villa Elisa',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132127/pexels-photo-2132127.jpeg',
                        caption: 'Palacio San José',
                        description: 'Histórica residencia del General Urquiza',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132128/pexels-photo-2132128.jpeg',
                        caption: 'Arquitectura europea',
                        description: 'Edificios con influencia de los inmigrantes fundadores',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132129/pexels-photo-2132129.jpeg',
                        caption: 'Fiesta del Inmigrante',
                        description: 'Celebración anual de las tradiciones europeas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132130/pexels-photo-2132130.jpeg',
                        caption: 'Danzas tradicionales',
                        description: 'Grupos folclóricos preservando las tradiciones europeas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132131/pexels-photo-2132131.jpeg',
                        caption: 'Gastronomía típica',
                        description: 'Platos de influencia italiana y suiza',
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
                        caption: 'Productos regionales',
                        description: 'Quesos, embutidos y otros productos artesanales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132134/pexels-photo-2132134.jpeg',
                        caption: 'Monumento al inmigrante',
                        description: 'Homenaje a los fundadores de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132135/pexels-photo-2132135.jpeg',
                        caption: 'Arroyo Perucho Verna',
                        description: 'Curso de agua que atraviesa la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132136/pexels-photo-2132136.jpeg',
                        caption: 'Caminos rurales',
                        description: 'Rutas pintorescas entre campos cultivados',
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
                        caption: 'Alojamientos turísticos',
                        description: 'Cabañas y hoteles para los visitantes',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132139/pexels-photo-2132139.jpeg',
                        caption: 'Iglesia local',
                        description: 'Templo religioso de la ciudad',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Termas de Villa Elisa',
                        description: 'Recorrido por el complejo termal y sus instalaciones',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Villa Elisa, Entre Ríos - Termas y Tradición Europea | Hosped.ar',
                seoDescription:
                    'Visita Villa Elisa en Entre Ríos: disfruta de sus modernas termas, descubre su herencia europea y explora el histórico Palacio San José.',
                seoKeywords: [
                    'Villa Elisa',
                    'Entre Ríos',
                    'termas',
                    'inmigrantes',
                    'Palacio San José',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino termal con fuerte herencia europea',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedVillaElisaDestination' },
            'Villa Elisa destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'villa-elisa' }, villaElisaDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Villa Elisa destination in seedVillaElisaDestination'
        );
        throw error;
    }
}
