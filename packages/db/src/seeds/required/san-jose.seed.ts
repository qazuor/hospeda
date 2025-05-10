import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: San José
 */
export async function seedRequiredDestinationSanJose() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'san-jose')
    });

    if (existing) {
        console.log('[seed] Destination "San José" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: San José');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000010',
        name: 'San José',
        longName: 'San José',
        slug: 'san-jose',
        summary:
            'Destino termal y cultural del litoral, ideal para quienes buscan tranquilidad, historia y naturaleza.',
        description: `
San José es una pintoresca ciudad ubicada entre Colón y Concepción del Uruguay, que combina atractivos termales, cultura regional y una calidez humana destacable.

El complejo termal de San José se encuentra rodeado de naturaleza y cuenta con piscinas termales, juegos acuáticos y espacios de relax. La ciudad también es reconocida por su tradición inmigrante, visible en sus museos, arquitectura y fiestas populares.

Cercana al Parque Nacional El Palmar y al río Uruguay, San José invita a realizar paseos naturales, deportes al aire libre, y degustar productos típicos de la zona como fiambres, dulces y vinos.

Es un destino ideal para familias, adultos mayores y viajeros que buscan equilibrio entre descanso, cultura y contacto con la tierra.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/2034017/pexels-photo-2034017.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${2034017 + i}/pexels-photo-${2034017 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Colón',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.2171',
                long: '-58.2076'
            }
        },
        tags: ['termas', 'cultura', 'familia'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'San José - Termas, Naturaleza y Cultura',
            seoDescription:
                'Disfrutá de las termas, el río y la tradición en San José. Un destino para el descanso y el encuentro.',
            seoKeywords: [
                'San José',
                'Entre Ríos',
                'termas',
                'cultura',
                'naturaleza',
                'fiestas populares',
                'turismo familiar'
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
