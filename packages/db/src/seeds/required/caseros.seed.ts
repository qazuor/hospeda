import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Caseros
 */
export async function seedRequiredDestinationCaseros() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'caseros')
    });

    if (existing) {
        console.log('[seed] Destination "Caseros" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Caseros');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000008',
        name: 'Caseros',
        longName: 'Caseros',
        slug: 'caseros',
        summary:
            'Pequeña localidad del departamento Uruguay con historia ferroviaria y un entorno tranquilo ideal para descansar.',
        description: `
Caseros es una localidad ubicada a pocos kilómetros de Concepción del Uruguay, conocida por su tranquilidad y su pasado ferroviario. Su nombre remite al histórico combate y su estación de tren marcó una época de desarrollo regional.

Hoy es un pueblo de ritmo sereno, calles arboladas, costumbres rurales y contacto con la vida simple. Su cercanía con otras ciudades lo convierte en una excelente base para explorar la región sin el ajetreo urbano.

Caseros conserva un espíritu comunitario muy arraigado, con ferias locales, celebraciones tradicionales y espacios verdes bien cuidados.

Es una buena opción para quienes buscan un descanso profundo, o una experiencia auténtica en un pueblo de la Mesopotamia argentina.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/4202937/pexels-photo-4202937.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${4202937 + i}/pexels-photo-${4202937 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.4512',
                long: '-58.2721'
            }
        },
        tags: ['tranquilidad', 'rural', 'historia'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Caseros - Tranquilidad rural y tradición',
            seoDescription:
                'Descubrí Caseros, un pueblo entrerriano con historia ferroviaria y aire de campo.',
            seoKeywords: [
                'Caseros',
                'Entre Ríos',
                'pueblos tranquilos',
                'ferrocarril',
                'turismo rural'
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
