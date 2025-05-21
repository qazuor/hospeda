import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the San José destination
 */
export async function seedSanJoseDestination() {
    dbLogger.info({ location: 'seedSanJoseDestination' }, 'Starting to seed San José destination');

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'san-jose-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedSanJoseDestination' },
                'San José destination already exists, skipping'
            );
            return;
        }

        const sanJoseDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'san-jose',
            displayName: 'San José',
            slug: 'san-jose-entre-rios',
            summary:
                'Histórica colonia de inmigrantes suizos con rica tradición cultural y hermosos paisajes rurales.',
            description: `San José es una pintoresca localidad ubicada en el departamento Colón, en la provincia de Entre Ríos, Argentina. Fundada en 1857 por inmigrantes suizos, es considerada la primera colonia agrícola organizada de Entre Ríos y una de las más antiguas del país, lo que le confiere un rico patrimonio histórico y cultural.

La ciudad conserva un encanto especial gracias a su arquitectura de influencia europea, con casas de estilo suizo y alemán que reflejan las raíces de sus fundadores. El Museo Histórico Regional "Camila Braun de Llano" exhibe objetos, documentos y fotografías que narran la historia de la colonización y el desarrollo de la región.

Uno de los eventos más destacados es la Fiesta Nacional de la Colonización, celebrada anualmente, donde se rinde homenaje a los inmigrantes pioneros con desfiles, música, danzas tradicionales y gastronomía típica. Los platos de influencia centroeuropea, como el chucrut, los strudels y las salchichas artesanales, son parte fundamental de su identidad culinaria.

San José está rodeada de un entorno natural privilegiado, con suaves colinas, arroyos y campos cultivados que invitan a paseos rurales y actividades al aire libre. Su proximidad al río Uruguay y a la ciudad de Colón (apenas 5 km) complementa su oferta turística con acceso a playas y más servicios.

La localidad mantiene vivas las tradiciones de sus ancestros a través de sus fiestas, su música, sus danzas y su artesanía. Los visitantes pueden disfrutar de un turismo cultural y rural auténtico, conociendo las costumbres y el modo de vida de esta comunidad que ha sabido preservar su identidad a lo largo de más de 160 años.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3283',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.1969',
                    long: '-58.1375'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/2132126/pexels-photo-2132126.jpeg',
                    caption: 'Plaza principal de San José',
                    description: 'Plaza central con su tradicional iglesia de estilo europeo',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/2132126/pexels-photo-2132126.jpeg',
                        caption: 'Iglesia de San José',
                        description: 'Templo histórico de la colonia suiza',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132127/pexels-photo-2132127.jpeg',
                        caption: 'Museo Histórico Regional',
                        description: 'Exhibición de la historia de la colonización',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132128/pexels-photo-2132128.jpeg',
                        caption: 'Arquitectura suiza',
                        description: 'Casas tradicionales de estilo europeo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132129/pexels-photo-2132129.jpeg',
                        caption: 'Fiesta de la Colonización',
                        description: 'Celebración anual con desfiles tradicionales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132130/pexels-photo-2132130.jpeg',
                        caption: 'Danzas tradicionales',
                        description: 'Grupos folclóricos preservando las tradiciones suizas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132131/pexels-photo-2132131.jpeg',
                        caption: 'Gastronomía típica',
                        description: 'Platos de influencia centroeuropea',
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
                        caption: 'Artesanías locales',
                        description:
                            'Productos artesanales elaborados por descendientes de colonos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132134/pexels-photo-2132134.jpeg',
                        caption: 'Monumento a los inmigrantes',
                        description: 'Homenaje a los fundadores de la colonia',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132135/pexels-photo-2132135.jpeg',
                        caption: 'Arroyo Perucho Verna',
                        description: 'Curso de agua que atraviesa la localidad',
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
                        caption: 'Casona histórica',
                        description: 'Antigua residencia de colonos suizos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132139/pexels-photo-2132139.jpeg',
                        caption: 'Plaza Urquiza',
                        description: 'Espacio verde con monumentos históricos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/2132140/pexels-photo-2132140.jpeg',
                        caption: 'Atardecer en San José',
                        description: 'Puesta de sol sobre los campos entrerrianos',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Historia de San José',
                        description: 'Documental sobre la colonización suiza en Entre Ríos',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'San José, Entre Ríos - Colonia Suiza Histórica | Hosped.ar',
                seoDescription:
                    'Visita San José, primera colonia agrícola de Entre Ríos. Descubre su rica historia de inmigración suiza, arquitectura europea y tradiciones centenarias.',
                seoKeywords: [
                    'San José',
                    'Entre Ríos',
                    'colonia suiza',
                    'inmigración',
                    'historia',
                    'tradiciones',
                    'turismo rural',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino histórico con fuerte herencia europea',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedSanJoseDestination' },
            'San José destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'san-jose' }, sanJoseDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed San José destination in seedSanJoseDestination'
        );
        throw error;
    }
}
