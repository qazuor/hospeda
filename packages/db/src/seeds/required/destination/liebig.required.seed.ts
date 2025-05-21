import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Liebig destination
 */
export async function seedLiebigDestination() {
    dbLogger.info({ location: 'seedLiebigDestination' }, 'Starting to seed Liebig destination');

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'liebig-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedLiebigDestination' },
                'Liebig destination already exists, skipping'
            );
            return;
        }

        const liebigDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'liebig',
            displayName: 'Pueblo Liebig',
            slug: 'liebig-entre-rios',
            summary:
                'Histórico pueblo industrial con arquitectura inglesa, a orillas del río Uruguay.',
            description: `Pueblo Liebig es una pequeña localidad ubicada en el departamento Colón, en la provincia de Entre Ríos, Argentina. Este pintoresco pueblo, situado a orillas del río Uruguay, posee una historia fascinante y un patrimonio arquitectónico único que lo distingue de otras localidades de la región.

Fundado a principios del siglo XX como un pueblo industrial, Liebig debe su nombre a la compañía británica Liebig's Extract of Meat Company, que estableció allí un frigorífico para la producción de extracto y conservas de carne. Este emprendimiento industrial transformó completamente la zona, atrayendo trabajadores y generando un asentamiento con características muy particulares.

Lo más destacado de Pueblo Liebig es su arquitectura de estilo inglés, que se conserva notablemente bien hasta la actualidad. Las casas de los obreros, construidas en madera y chapa, contrastan con las residencias más amplias de los gerentes y directivos, creando un conjunto urbano de gran valor histórico y cultural. En 2019, este patrimonio fue reconocido cuando Pueblo Liebig fue declarado Patrimonio Cultural de la Humanidad por la UNESCO.

El antiguo frigorífico, aunque ya no está en funcionamiento, permanece como testigo silencioso de la época de esplendor industrial. Sus imponentes estructuras de ladrillo rojo y hierro son un atractivo para los amantes de la arqueología industrial y la fotografía.

El entorno natural de Liebig es otro de sus grandes atractivos. Ubicado a orillas del río Uruguay, ofrece hermosas vistas, posibilidades de pesca y contacto con la naturaleza. Los bosques circundantes, con su flora y fauna autóctonas, invitan a paseos y actividades al aire libre.

Actualmente, Pueblo Liebig está experimentando un renacimiento como destino turístico, con iniciativas para preservar su patrimonio y desarrollar servicios para los visitantes. Pequeños emprendimientos gastronómicos ofrecen platos caseros y productos regionales, mientras que algunas de las antiguas casas se han convertido en alojamientos con encanto.

La tranquilidad del lugar, combinada con su rica historia y su entorno natural privilegiado, hacen de Pueblo Liebig un destino ideal para quienes buscan una experiencia auténtica, lejos del turismo masivo, donde el tiempo parece haberse detenido en una época de pioneros industriales y trabajadores inmigrantes.`,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3281',
                country: 'Argentina',
                coordinates: {
                    lat: '-32.1553',
                    long: '-58.1753'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                    caption: 'Arquitectura inglesa en Pueblo Liebig',
                    description: 'Casas de estilo británico características del pueblo industrial',
                    state: StateEnum.ACTIVE
                },
                gallery: [
                    {
                        url: 'https://images.pexels.com/photos/1308624/pexels-photo-1308624.jpeg',
                        caption: 'Casas de estilo inglés',
                        description: 'Arquitectura típica de las viviendas obreras',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg',
                        caption: 'Antiguo frigorífico',
                        description: 'Instalaciones industriales históricas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1310788/pexels-photo-1310788.jpeg',
                        caption: 'Río Uruguay',
                        description: 'Vista del río desde el pueblo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1319829/pexels-photo-1319829.jpeg',
                        caption: 'Calle principal',
                        description: 'Avenida central del pueblo con casas históricas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1320684/pexels-photo-1320684.jpeg',
                        caption: 'Casa gerencial',
                        description: 'Residencia de los directivos de la compañía',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
                        caption: 'Bosque nativo',
                        description: 'Entorno natural que rodea el pueblo',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
                        caption: 'Pesca en el río',
                        description: 'Actividad popular entre locales y turistas',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1368382/pexels-photo-1368382.jpeg',
                        caption: 'Muelle histórico',
                        description: 'Antiguo embarcadero del frigorífico',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374294/pexels-photo-1374294.jpeg',
                        caption: 'Atardecer en Liebig',
                        description: 'Puesta de sol sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1374318/pexels-photo-1374318.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos con productos regionales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
                        caption: 'Museo local',
                        description: 'Exhibición sobre la historia del frigorífico',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1391487/pexels-photo-1391487.jpeg',
                        caption: 'Artesanías',
                        description: 'Productos artesanales elaborados por locales',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1393437/pexels-photo-1393437.jpeg',
                        caption: 'Fauna local',
                        description: 'Aves y animales típicos de la región',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1393438/pexels-photo-1393438.jpeg',
                        caption: 'Flora autóctona',
                        description: 'Vegetación característica de la zona',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/1393439/pexels-photo-1393439.jpeg',
                        caption: 'Alojamiento turístico',
                        description: 'Antiguas casas reconvertidas en hospedajes',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Historia de Pueblo Liebig',
                        description: 'Documental sobre el pasado industrial de la localidad',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                seoTitle: 'Pueblo Liebig, Entre Ríos - Patrimonio Industrial Inglés | Hosped.ar',
                seoDescription:
                    'Descubre Pueblo Liebig, joya arquitectónica de Entre Ríos con su patrimonio industrial inglés. Explora su historia, arquitectura única y hermoso entorno natural.',
                seoKeywords: [
                    'Pueblo Liebig',
                    'Entre Ríos',
                    'patrimonio UNESCO',
                    'arquitectura inglesa',
                    'frigorífico',
                    'río Uruguay',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino con valor patrimonial reconocido por UNESCO',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedLiebigDestination' },
            'Liebig destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'liebig' }, liebigDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Liebig destination in seedLiebigDestination'
        );
        throw error;
    }
}
