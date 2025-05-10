import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Villa Elisa
 */
export async function seedRequiredDestinationVillaElisa() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'villa-elisa')
    });

    if (existing) {
        console.log('[seed] Destination "Villa Elisa" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Villa Elisa');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000021',
        name: 'Villa Elisa',
        longName: 'Villa Elisa',
        slug: 'villa-elisa',
        summary:
            'Ciudad turística reconocida por sus termas, jardines, historia de inmigración y excelente infraestructura.',
        description: `
Villa Elisa, conocida como “La ciudad jardín”, es un destacado destino turístico del centro-este de Entre Ríos. Se encuentra a pocos kilómetros de Colón y Concepción del Uruguay, con un entorno natural cuidado y una comunidad activa y hospitalaria.

Su complejo termal, con aguas cálidas, áreas recreativas, alojamiento y spa, la convierte en una opción preferida para el relax. También cuenta con un museo histórico que preserva la memoria de las colonias suizo-alemanas que la fundaron.

La ciudad ofrece gastronomía local, ferias, eventos y paseos por jardines y bulevares floridos. Su infraestructura moderna convive con el ritmo sereno del interior.

Villa Elisa es un lugar perfecto para desconectar, disfrutar en familia o en pareja, y descubrir el equilibrio entre naturaleza, historia y bienestar.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/132037/pexels-photo-132037.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${132037 + i}/pexels-photo-${132037 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Colón',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.1753',
                long: '-58.4048'
            }
        },
        tags: ['termas', 'jardines', 'historia', 'relax'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Villa Elisa - Termas, historia y jardines',
            seoDescription:
                'Descansá en Villa Elisa, la ciudad jardín de Entre Ríos con termas, cultura e infraestructura moderna.',
            seoKeywords: [
                'Villa Elisa',
                'termas',
                'turismo de bienestar',
                'colonias suizas',
                'ciudad jardín',
                'Entre Ríos'
            ]
        },
        adminInfo: {
            notes: '',
            favorite: true,
            tags: ['semilla']
        },
        state: 'ACTIVE',
        createdAt: now,
        updatedAt: now
    });
}
