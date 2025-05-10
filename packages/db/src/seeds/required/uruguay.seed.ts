import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Concepción del Uruguay
 */
export async function seedRequiredDestinationUruguay() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'concepcion-del-uruguay')
    });

    if (existing) {
        console.log('[seed] Destination "Concepción del Uruguay" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Concepción del Uruguay');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000001',
        name: 'Concepción del Uruguay',
        longName: 'Concepción del Uruguay',
        slug: 'concepcion-del-uruguay',
        summary:
            'Ciudad histórica y cultural, conocida como "La Histórica", con playas, termas y arquitectura colonial.',
        description: `
Concepción del Uruguay, ubicada a orillas del río Uruguay, es una de las ciudades más antiguas de Entre Ríos. Fundada en 1783, se destaca por su rica historia y su arquitectura colonial.

La ciudad ofrece playas sobre el río, como la Isla del Puerto, ideales para disfrutar del sol y el agua. Además, cuenta con termas que brindan relax y bienestar a sus visitantes.

En el centro histórico, se pueden apreciar edificios emblemáticos como el Colegio del Uruguay y la Basílica Inmaculada Concepción.

Concepción del Uruguay es un destino que combina historia, naturaleza y cultura, atrayendo a turistas durante todo el año.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${208701 + i}/pexels-photo-${208701 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.4845349',
                long: '-58.2321416'
            }
        },
        tags: ['historia', 'termal', 'playas'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Concepción del Uruguay - Turismo y Cultura',
            seoDescription:
                'Descubrí la historia, playas y termas de Concepción del Uruguay en Entre Ríos.',
            seoKeywords: [
                'Concepción del Uruguay',
                'Entre Ríos',
                'turismo histórico',
                'termal',
                'playas',
                'la histórica',
                'balnearios',
                'colegio del uruguay'
            ]
        },
        adminInfo: {
            notes: '',
            favorite: true,
            tags: ['semilla', 'base']
        },
        state: 'ACTIVE',
        createdAt: now,
        updatedAt: now
    });
}
