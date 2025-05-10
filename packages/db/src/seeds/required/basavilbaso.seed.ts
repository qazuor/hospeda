import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Basavilbaso
 */
export async function seedRequiredDestinationBasavilbaso() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'basavilbaso')
    });

    if (existing) {
        console.log('[seed] Destination "Basavilbaso" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Basavilbaso');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000012',
        name: 'Basavilbaso',
        longName: 'Basavilbaso',
        slug: 'basavilbaso',
        summary:
            'Ciudad con fuerte identidad ferroviaria, cultura de inmigrantes y ambiente apacible en el centro de Entre Ríos.',
        description: `
Basavilbaso es una ciudad entrerriana con profundo legado ferroviario. Fue una de las primeras en contar con colonias agrícolas impulsadas por inmigrantes judíos y europeos, que marcaron su identidad.

El antiguo ferrocarril es hoy centro de actividades culturales y de memoria colectiva. Su museo ferroviario y las fiestas populares muestran la historia viva de sus habitantes.

Basavilbaso conserva un entorno ordenado y tranquilo, con plazas arboladas, instituciones educativas y un fuerte sentido comunitario.

Ideal para visitantes curiosos por la historia, la cultura rural y la vida serena del interior entrerriano.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/2449451/pexels-photo-2449451.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${2449451 + i}/pexels-photo-${2449451 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.3849',
                long: '-58.8737'
            }
        },
        tags: ['ferrocarril', 'historia', 'colonias'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Basavilbaso - Identidad ferroviaria y cultural',
            seoDescription:
                'Descubrí la historia viva del ferrocarril y la inmigración en Basavilbaso, corazón de Entre Ríos.',
            seoKeywords: [
                'Basavilbaso',
                'ferrocarril',
                'inmigrantes',
                'colonias agrícolas',
                'historia entrerriana',
                'museo ferroviario'
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
