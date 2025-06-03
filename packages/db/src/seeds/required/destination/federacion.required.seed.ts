import { StateEnum, VisibilityEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../client';
import { destinations } from '../../../schema';
import { dbLogger } from '../../../utils/logger';

/**
 * Seeds the Federación destination
 */
export async function seedFederacionDestination() {
    dbLogger.info(
        { location: 'seedFederacionDestination' },
        'Starting to seed Federación destination'
    );

    const db = getDb();

    try {
        // Check if destination already exists
        const existingDestination = await db
            .select()
            .from(destinations)
            .where(eq(destinations.slug, 'federacion-entre-rios'));

        if (existingDestination.length > 0) {
            dbLogger.info(
                { location: 'seedFederacionDestination' },
                'Federación destination already exists, skipping'
            );
            return;
        }

        const federacionDestination = await db.insert(destinations).values({
            id: crypto.randomUUID(),
            name: 'federacion',
            displayName: 'Federación',
            slug: 'federacion-entre-rios',
            summary:
                'Ciudad termal por excelencia, con modernas instalaciones y un lago artificial ideal para actividades acuáticas.',
            description: `Federación es una ciudad única en Argentina, conocida como la "Ciudad Termal" por excelencia. Ubicada en el noreste de la provincia de Entre Ríos, a orillas del Lago de Salto Grande sobre el río Uruguay, esta localidad tiene una historia fascinante de renacimiento y transformación.

La ciudad actual es el resultado de una reubicación completa en la década de 1970, cuando la antigua Federación quedó sumergida bajo las aguas del embalse creado por la represa de Salto Grande. Este origen singular le ha dado a Federación un diseño urbano moderno, planificado y ordenado, con amplias avenidas, espacios verdes y una arquitectura contemporánea.

El principal atractivo turístico son sus complejos termales, considerados entre los mejores de Argentina. Sus aguas, que emergen a 42°C desde más de 1.200 metros de profundidad, son ricas en minerales con propiedades terapéuticas para diversas afecciones. El Parque Termal Municipal, con sus múltiples piscinas de diferentes temperaturas, hidromasajes, juegos acuáticos y áreas de descanso, recibe miles de visitantes durante todo el año.

Además de sus termas, Federación ofrece hermosas playas sobre el lago artificial de Salto Grande, ideales para la natación, deportes acuáticos y pesca. El Museo de los Orígenes exhibe la historia de la antigua ciudad y su traslado, mientras que el mirador de la costanera brinda vistas panorámicas del lago y la represa.

La infraestructura turística de Federación es moderna y completa, con hoteles, apart-hoteles, cabañas y campings para todos los presupuestos. Su gastronomía destaca por los pescados de río frescos y los productos regionales. La ciudad mantiene un ambiente tranquilo y familiar, perfecto para quienes buscan un destino de relax y bienestar en contacto con la naturaleza.`,
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC,
            state: StateEnum.ACTIVE,
            location: {
                state: 'Entre Ríos',
                zipCode: '3206',
                country: 'Argentina',
                coordinates: {
                    lat: '-30.9782',
                    long: '-57.9285'
                }
            },
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
                    caption: 'Parque Termal de Federación',
                    description: 'Vista aérea del complejo termal principal de la ciudad',
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
                        url: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg',
                        caption: 'Lago de Salto Grande',
                        description: 'Extenso lago artificial formado por la represa',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225519/pexels-photo-3225519.jpeg',
                        caption: 'Playa de Federación',
                        description: 'Hermosa playa de arena sobre el lago',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225521/pexels-photo-3225521.jpeg',
                        caption: 'Represa de Salto Grande',
                        description: 'Impresionante obra de ingeniería binacional',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225523/pexels-photo-3225523.jpeg',
                        caption: 'Museo de los Orígenes',
                        description: 'Exhibición sobre la historia de la antigua ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225525/pexels-photo-3225525.jpeg',
                        caption: 'Costanera de Federación',
                        description: 'Paseo costero con vista al lago',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225527/pexels-photo-3225527.jpeg',
                        caption: 'Plaza principal',
                        description: 'Espacio verde en el centro de la ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225529/pexels-photo-3225529.jpeg',
                        caption: 'Arquitectura moderna',
                        description: 'Edificios contemporáneos característicos de la nueva ciudad',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225533/pexels-photo-3225533.jpeg',
                        caption: 'Parque acuático',
                        description: 'Área recreativa con juegos acuáticos',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225535/pexels-photo-3225535.jpeg',
                        caption: 'Deportes acuáticos',
                        description: 'Actividades náuticas en el lago',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225537/pexels-photo-3225537.jpeg',
                        caption: 'Pesca deportiva',
                        description: 'Actividad popular en el lago de Salto Grande',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225539/pexels-photo-3225539.jpeg',
                        caption: 'Atardecer en Federación',
                        description: 'Espectacular puesta de sol sobre el lago',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225541/pexels-photo-3225541.jpeg',
                        caption: 'Gastronomía local',
                        description: 'Platos típicos con pescados de río',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225543/pexels-photo-3225543.jpeg',
                        caption: 'Alojamientos turísticos',
                        description: 'Hoteles y cabañas con vista al lago',
                        state: StateEnum.ACTIVE
                    },
                    {
                        url: 'https://images.pexels.com/photos/3225545/pexels-photo-3225545.jpeg',
                        caption: 'Vida nocturna',
                        description: 'Actividades y entretenimiento nocturno',
                        state: StateEnum.ACTIVE
                    }
                ],
                videos: [
                    {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        caption: 'Termas de Federación',
                        description: 'Recorrido por el complejo termal y sus instalaciones',
                        state: StateEnum.ACTIVE
                    }
                ]
            },
            seo: {
                title: 'Federación, Entre Ríos - Ciudad Termal por Excelencia | Hosped.ar',
                description:
                    'Visita Federación, la Ciudad Termal de Entre Ríos. Disfruta de sus aguas termales curativas, playas sobre el lago y moderna infraestructura turística.',
                keywords: [
                    'Federación',
                    'Entre Ríos',
                    'termas',
                    'aguas termales',
                    'Salto Grande',
                    'lago',
                    'turismo',
                    'alojamiento'
                ]
            },
            adminInfo: {
                notes: 'Destino termal principal de la provincia',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info(
            { location: 'seedFederacionDestination' },
            'Federación destination created successfully'
        );
        dbLogger.query('insert', 'destinations', { name: 'federacion' }, federacionDestination);
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed Federación destination in seedFederacionDestination'
        );
        throw error;
    }
}
