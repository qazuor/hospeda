import { logger } from '@repo/logger';
import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../client';
import { destinations } from '../../../schema';

/**
 * Seeds the Chajarí destination
 */
export async function seedChajariDestination() {
    logger.info('Starting to seed Chajarí destination', 'seedChajariDestination');

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'chajari-entre-rios'));

        if (existingDestination.length > 0) {
            logger.info('Chajarí destination already exists, skipping', 'seedChajariDestination');
            return;
        }

        const chajariDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'chajari',
            displayName: 'Chajarí',
            slug: 'chajari-entre-rios',
            summary:
                'Ciudad citrícola con termas, rica historia de inmigración y entorno natural privilegiado.',
            description: `Chajarí es una próspera ciudad ubicada en el noreste de la provincia de Entre Ríos, Argentina, en el departamento Federación. Conocida como la "Capital Nacional de la Citricultura", es el centro de una de las regiones productoras de cítricos más importantes del país, con extensos cultivos de naranjas, mandarinas y limones que caracterizan su paisaje y economía.

Fundada en 1873 como Colonia Villa Libertad, la ciudad tiene una rica historia de inmigración, principalmente italiana, que ha dejado su huella en la arquitectura, gastronomía y tradiciones locales. El Museo Regional Camila Quiroga preserva este patrimonio histórico y cultural a través de su colección de objetos, documentos y fotografías.

El principal atractivo turístico de Chajarí es su complejo termal, inaugurado en 2001, que ofrece aguas mineromedicinales que emergen a 41°C desde más de 800 metros de profundidad. El parque cuenta con múltiples piscinas de diferentes temperaturas, áreas recreativas y servicios de spa, atrayendo a visitantes en busca de relax y bienestar.

La ciudad está rodeada de un entorno natural privilegiado, con el río Uruguay a pocos kilómetros, arroyos, reservas naturales y estancias rurales que permiten el contacto con la naturaleza. El Parque Nacional El Palmar, con su característica flora de palmeras yatay, se encuentra a una hora de distancia.

Entre los eventos más destacados se encuentra la Fiesta Nacional del Citrus, celebrada anualmente, donde se realizan exposiciones, concursos, espectáculos y la elección de la reina nacional. La gastronomía local destaca por sus platos a base de pescado de río y los productos derivados de los cítricos, desde dulces hasta licores artesanales.

Chajarí ofrece una infraestructura turística completa, con hoteles, apart-hoteles, cabañas y campings, así como restaurantes y servicios. Su ubicación estratégica en la Ruta Nacional 14 la convierte en una parada conveniente para quienes recorren el corredor turístico del río Uruguay.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3228',
                country: 'Argentina',
                coordinates: {
                    lat: '-30.7503',
                    long: '-58.0251'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1268076/pexels-photo-1268076.jpeg',
                    caption: 'Plantaciones de cítricos en Chajarí',
                    description: 'Extensos cultivos de naranjas característicos de la región',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1268076/pexels-photo-1268076.jpeg',
                        caption: 'Cultivos cítricos',
                        description: 'Plantaciones de naranjas y mandarinas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
                        caption: 'Termas de Chajarí',
                        description: 'Complejo termal con múltiples piscinas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132126/pexels-photo-2132126.jpeg',
                        caption: 'Plaza principal',
                        description: 'Plaza central de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132127/pexels-photo-2132127.jpeg',
                        caption: 'Museo Regional',
                        description: 'Museo Camila Quiroga con exhibiciones históricas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132128/pexels-photo-2132128.jpeg',
                        caption: 'Arquitectura italiana',
                        description: 'Edificios con influencia de los inmigrantes fundadores',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132129/pexels-photo-2132129.jpeg',
                        caption: 'Fiesta Nacional del Citrus',
                        description: 'Celebración anual de la producción citrícola',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132130/pexels-photo-2132130.jpeg',
                        caption: 'Danzas tradicionales',
                        description: 'Grupos folclóricos en festividades locales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132131/pexels-photo-2132131.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos con influencia italiana',
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
                        caption: 'Productos cítricos',
                        description: 'Naranjas, mandarinas y productos derivados',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132134/pexels-photo-2132134.jpeg',
                        caption: 'Monumento al citrus',
                        description: 'Homenaje a la principal actividad económica',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132135/pexels-photo-2132135.jpeg',
                        caption: 'Arroyo Chajarí',
                        description: 'Curso de agua que atraviesa la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132136/pexels-photo-2132136.jpeg',
                        caption: 'Caminos rurales',
                        description: 'Rutas pintorescas entre plantaciones',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132137/pexels-photo-2132137.jpeg',
                        caption: 'Cosecha de cítricos',
                        description: 'Trabajadores en la recolección de naranjas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132138/pexels-photo-2132138.jpeg',
                        caption: 'Alojamientos turísticos',
                        description: 'Cabañas y hoteles para los visitantes',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Chajarí, capital del citrus',
                        description: 'Recorrido por la ciudad y sus plantaciones cítricas',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Chajarí, Entre Ríos - Capital Nacional del Citrus | Hosped.ar',
                seoDescription:
                    'Visita Chajarí, la Capital Nacional de la Citricultura. Disfruta de sus termas, descubre sus plantaciones de cítricos y su rica herencia de inmigración italiana.',
                seoKeywords: [
                    'Chajarí',
                    'Entre Ríos',
                    'citrus',
                    'naranjas',
                    'termas',
                    'inmigración italiana',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino destacado por su producción citrícola y termas',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info('Chajarí destination created successfully', 'seedChajariDestination');
        logger.query('insert', 'destinations', { name: 'chajari' }, chajariDestination);
    } catch (error) {
        logger.error('Failed to seed Chajarí destination', 'seedChajariDestination', error);
        throw error;
    }
}
