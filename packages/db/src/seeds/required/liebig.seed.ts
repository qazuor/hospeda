import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Pueblo Liebig
 */
export async function seedRequiredDestinationLiebig() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'liebig')
    });

    if (existing) {
        console.log('[seed] Destination "Pueblo Liebig" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Pueblo Liebig');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000013',
        name: 'Pueblo Liebig',
        longName: 'Pueblo Liebig',
        slug: 'liebig',
        summary:
            'Antiguo pueblo obrero con historia frigorífica, arquitectura británica y entorno ribereño encantador.',
        description: `
Pueblo Liebig es una joya histórica a orillas del río Uruguay, famosa por haber albergado uno de los primeros frigoríficos del país. El trazado urbano, la arquitectura de estilo inglés y el entorno natural la hacen única.

Sus calles aún conservan el aire de colonia obrera británica, con casas bajas, ladrillo visto y veredas prolijas. El ex Frigorífico Liebig, hoy símbolo patrimonial, fue centro de desarrollo económico de la región.

Es un lugar ideal para caminar, tomar mate bajo los árboles, visitar el puerto, pescar o descansar en cabañas frente al río. La gente del lugar mantiene viva la memoria colectiva y la hospitalidad rural.

Pueblo Liebig ofrece tranquilidad, belleza histórica y una experiencia distinta en la costa del Uruguay.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/2611024/pexels-photo-2611024.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${2611024 + i}/pexels-photo-${2611024 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Colón',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.2105',
                long: '-58.1859'
            }
        },
        tags: ['historia', 'frigorífico', 'patrimonio'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Pueblo Liebig - Historia y tranquilidad ribereña',
            seoDescription:
                'Explorá el legado británico, la calma del río y la historia del frigorífico en Pueblo Liebig.',
            seoKeywords: [
                'Pueblo Liebig',
                'frigorífico',
                'historia',
                'patrimonio',
                'río Uruguay',
                'arquitectura inglesa',
                'turismo rural'
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
