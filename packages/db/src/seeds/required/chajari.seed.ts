import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Chajarí
 */
export async function seedRequiredDestinationChajari() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'chajari')
    });

    if (existing) {
        console.log('[seed] Destination "Chajarí" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Chajarí');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000011',
        name: 'Chajarí',
        longName: 'Chajarí',
        slug: 'chajari',
        summary:
            'Ciudad jardín del norte entrerriano, famosa por sus termas, entorno natural y productos cítricos.',
        description: `
Chajarí, conocida como la "ciudad de amigos", es un punto destacado del norte entrerriano. Atrae tanto a quienes buscan descanso como a los que disfrutan de actividades recreativas y naturaleza.

El complejo termal municipal es uno de los más grandes de Entre Ríos, con múltiples piscinas, sectores verdes y alojamientos dentro del predio. La ciudad está rodeada de zonas rurales productivas, especialmente de cítricos.

Con una población activa y hospitalaria, Chajarí combina urbanismo ordenado con ritmo tranquilo. En sus calles se respira armonía y calidez local.

Una ciudad ideal para relajarse, disfrutar en familia, y degustar jugos, dulces y gastronomía típica del litoral argentino.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/61135/pexels-photo-61135.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${61135 + i}/pexels-photo-${61135 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Federación',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-30.75',
                long: '-57.98'
            }
        },
        tags: ['termas', 'cítricos', 'norte entrerriano'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Chajarí - Termas, naturaleza y producción',
            seoDescription:
                'Viví el relax y la calidez de Chajarí. Termas, frutas, descanso y naturaleza en el norte entrerriano.',
            seoKeywords: [
                'Chajarí',
                'Entre Ríos',
                'termas',
                'norte entrerriano',
                'cítricos',
                'turismo de bienestar',
                'familias'
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
