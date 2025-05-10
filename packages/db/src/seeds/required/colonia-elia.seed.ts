import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Colonia Elía
 */
export async function seedRequiredDestinationColoniaElia() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'colonia-elia')
    });

    if (existing) {
        console.log('[seed] Destination "Colonia Elía" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Colonia Elía');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000022',
        name: 'Colonia Elía',
        longName: 'Colonia Elía',
        slug: 'colonia-elia',
        summary:
            'Pueblo rural entre Concepción del Uruguay y Gualeguaychú, rodeado de campo, historia y tranquilidad.',
        description: `
Colonia Elía es una pequeña localidad rural ubicada en el departamento Uruguay, a pocos kilómetros de Concepción del Uruguay. Fundada por inmigrantes europeos, mantiene un estilo de vida simple, comunitario y agrícola.

Sus caminos rurales, casonas bajas y espacios verdes son parte del paisaje sereno de esta colonia, ideal para desconectar del ritmo urbano. En los últimos años ha crecido el turismo rural, con propuestas de alojamiento en estancias y experiencias de campo.

El entorno es perfecto para el avistaje de aves, caminatas tranquilas, gastronomía casera y la contemplación de atardeceres abiertos.

Colonia Elía es uno de esos destinos que conservan la esencia del interior entrerriano: calidez, silencio y naturaleza.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${269077 + i}/pexels-photo-${269077 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.4712',
                long: '-58.2785'
            }
        },
        tags: ['colonia', 'rural', 'naturaleza', 'tranquilidad'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Colonia Elía - Campo, historia y naturaleza',
            seoDescription:
                'Viví el ritmo rural y la tranquilidad en Colonia Elía, un rincón auténtico de Entre Ríos.',
            seoKeywords: [
                'Colonia Elía',
                'turismo rural',
                'campo',
                'pueblos entrerrianos',
                'tranquilidad',
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
