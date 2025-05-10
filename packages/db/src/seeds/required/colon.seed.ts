import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Colón
 */
export async function seedRequiredDestinationColon() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'colon')
    });

    if (existing) {
        console.log('[seed] Destination "Colón" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Colón');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000002',
        name: 'Colón',
        longName: 'Colón',
        slug: 'colon',
        summary:
            'Destino turístico con playas sobre el río Uruguay, termas y actividades al aire libre para toda la familia.',
        description: `
Colón, ubicada a orillas del majestuoso río Uruguay, es uno de los destinos turísticos más destacados del litoral argentino. Con playas extensas y arenas doradas, invita al descanso, al disfrute del sol y de deportes acuáticos.

La ciudad cuenta con un complejo termal moderno que combina aguas termales y servicios de spa, convirtiéndola en un lugar ideal para el relax. Además, ofrece propuestas culturales, ferias artesanales y festivales durante todo el año.

Los amantes de la naturaleza pueden disfrutar de caminatas por la costanera, excursiones fluviales y visitas al Parque Nacional El Palmar, situado a pocos kilómetros. Su oferta gastronómica basada en productos locales completa una experiencia auténtica y sabrosa.

Colón es una ciudad cálida y vibrante, perfecta para quienes buscan tranquilidad, naturaleza, bienestar y cultura en un solo lugar.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/4101555/pexels-photo-4101555.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${4101555 + i}/pexels-photo-${4101555 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Colón',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.2254',
                long: '-58.1447'
            }
        },
        tags: ['playas', 'termas', 'familia'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Colón - Playas y Termas en Entre Ríos',
            seoDescription:
                'Relajate en las playas y termas de Colón. Turismo natural, familiar y cultural en Entre Ríos.',
            seoKeywords: [
                'Colón',
                'Entre Ríos',
                'termas',
                'río Uruguay',
                'playas',
                'El Palmar',
                'turismo familiar',
                'descanso en la naturaleza'
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
