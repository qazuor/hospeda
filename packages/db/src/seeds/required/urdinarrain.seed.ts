import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Urdinarrain
 */
export async function seedRequiredDestinationUrdinarrain() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'urdinarrain')
    });

    if (existing) {
        console.log('[seed] Destination "Urdinarrain" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Urdinarrain');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000020',
        name: 'Urdinarrain',
        longName: 'Urdinarrain',
        slug: 'urdinarrain',
        summary:
            'Ciudad tranquila del sur entrerriano con vida cultural, tradiciones rurales y excelente calidad de vida.',
        description: `
Urdinarrain es una ciudad del departamento Gualeguaychú que combina historia, tradiciones rurales y una activa vida comunitaria. Fundada en torno al ferrocarril, conserva su trazado ordenado y sus plazas arboladas.

La ciudad ofrece calidad de vida, buena infraestructura, instituciones educativas y centros culturales. Eventos como la Fiesta Provincial del Caballo y ferias regionales reflejan la identidad gaucha y productiva de la zona.

Es un lugar ideal para quienes buscan vivir o visitar un entorno organizado, familiar y seguro, con propuestas culturales durante todo el año.

Urdinarrain también es punto de paso para quienes recorren el sur entrerriano, y un espacio cálido para el turismo rural y la vida simple.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/2341830/pexels-photo-2341830.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${2341830 + i}/pexels-photo-${2341830 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Gualeguaychú',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.6866',
                long: '-58.9002'
            }
        },
        tags: ['caballos', 'ferias', 'rural', 'vida tranquila'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Urdinarrain - Cultura, tradición y vida rural',
            seoDescription:
                'Visitá Urdinarrain, ciudad del sur entrerriano con fiestas gauchas, cultura y comunidad.',
            seoKeywords: [
                'Urdinarrain',
                'fiesta del caballo',
                'turismo rural',
                'gaucho',
                'vida tranquila',
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
