import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Ibicuy
 */
export async function seedRequiredDestinationIbicuy() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'ibicuy')
    });

    if (existing) {
        console.log('[seed] Destination "Ibicuy" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Ibicuy');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000007',
        name: 'Ibicuy',
        longName: 'Ibicuy',
        slug: 'ibicuy',
        summary:
            'Pueblo isleño del sur entrerriano, rodeado de ríos y naturaleza, ideal para desconectar y disfrutar del silencio.',
        description: `
Ibicuy es un rincón natural al sur de Entre Ríos, con acceso al delta y rodeado de cursos de agua. Su paisaje está compuesto por islas, esteros y vegetación ribereña, lo que la convierte en una opción ideal para el ecoturismo.

Es un destino poco masificado, perfecto para quienes buscan descansar, pescar, remar o simplemente contemplar la naturaleza en estado puro. Su gente mantiene un estilo de vida sereno y ligado al entorno fluvial.

Los visitantes pueden hospedarse en cabañas, recorrer los arroyos, degustar comida típica y disfrutar del aire libre. También es un lugar elegido por fotógrafos de fauna y paisajes.

Ibicuy es un refugio ideal para escapar del ruido urbano y reconectar con lo esencial.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/3586966/pexels-photo-3586966.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${3586966 + i}/pexels-photo-${3586966 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Islas del Ibicuy',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-33.7337',
                long: '-59.2002'
            }
        },
        tags: ['isla', 'pesca', 'naturaleza'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Ibicuy - Naturaleza y silencio en el delta',
            seoDescription:
                'Escapá a Ibicuy: un rincón natural, isleño y apacible en el sur de Entre Ríos.',
            seoKeywords: [
                'Ibicuy',
                'delta',
                'turismo naturaleza',
                'pesca',
                'cabañas',
                'río',
                'Entre Ríos'
            ]
        },
        adminInfo: {
            notes: '',
            favorite: false,
            tags: ['semilla']
        },
        state: 'ACTIVE',
        createdAt: now,
        updatedAt: now
    });
}
