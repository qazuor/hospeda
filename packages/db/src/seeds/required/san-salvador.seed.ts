import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: San Salvador
 */
export async function seedRequiredDestinationSanSalvador() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'san-salvador')
    });

    if (existing) {
        console.log('[seed] Destination "San Salvador" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: San Salvador');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000017',
        name: 'San Salvador',
        longName: 'San Salvador',
        slug: 'san-salvador',
        summary:
            'Capital nacional del arroz, ciudad tranquila y productiva en el corazón de Entre Ríos con fuerte identidad agrícola.',
        description: `
San Salvador es una ciudad del centro este entrerriano reconocida por su actividad agroindustrial y especialmente por su producción de arroz, motivo por el cual se la conoce como la Capital Nacional del Arroz.

Con un entorno ordenado, plazas verdes y un perfil productivo marcado, la ciudad ofrece tranquilidad, buenos servicios y un ambiente comunitario fuerte. El Museo del Arroz es un espacio emblemático que muestra su historia y evolución.

En San Salvador se combinan tradiciones rurales con avances tecnológicos, vida social con entorno natural, y cultura local con eventos deportivos y culturales.

Una ciudad prolija, en crecimiento, ideal para visitar y conocer el corazón productivo del interior entrerriano.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/1430675/pexels-photo-1430675.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${1430675 + i}/pexels-photo-${1430675 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'San Salvador',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-31.6249',
                long: '-58.5058'
            }
        },
        tags: ['arroz', 'productiva', 'museo', 'agro'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'San Salvador - Capital del arroz y ciudad tranquila',
            seoDescription:
                'Conocé San Salvador, ciudad agrícola, cultural y tranquila del corazón entrerriano.',
            seoKeywords: [
                'San Salvador',
                'arroz',
                'museo del arroz',
                'turismo rural',
                'ciudad agrícola',
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
