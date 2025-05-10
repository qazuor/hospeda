import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Gualeguaychú
 */
export async function seedRequiredDestinationGchu() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'gualeguaychu')
    });

    if (existing) {
        console.log('[seed] Destination "Gualeguaychú" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Gualeguaychú');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000003',
        name: 'Gualeguaychú',
        longName: 'Gualeguaychú',
        slug: 'gualeguaychu',
        summary:
            'Ciudad conocida por su carnaval, playas sobre el río y una vibrante vida cultural y nocturna en Entre Ríos.',
        description: `
Gualeguaychú, ubicada en el sur de Entre Ríos, es una ciudad que combina historia, fiesta y naturaleza. Su fama internacional proviene del Carnaval del País, uno de los eventos más coloridos y convocantes de Argentina.

Durante el verano, las playas sobre el río Gualeguaychú se llenan de visitantes que buscan disfrutar del sol, el agua y actividades recreativas. La costanera y el paseo del puerto ofrecen una experiencia ideal para caminar, comer y compartir en familia o con amigos.

La ciudad también destaca por su variada oferta cultural: museos, teatros, ferias artesanales y propuestas gastronómicas con productos regionales. Por la noche, bares y espacios al aire libre dan vida a la vibrante escena local.

Gualeguaychú es sinónimo de alegría, tradición y hospitalidad. Es un destino que encanta tanto a quienes buscan diversión como a los que quieren descansar y conectar con la naturaleza.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/1152359/pexels-photo-1152359.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${1152359 + i}/pexels-photo-${1152359 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Gualeguaychú',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-33.0077778',
                long: '-58.5111667'
            }
        },
        tags: ['carnaval', 'playas', 'vida nocturna'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Gualeguaychú - Carnaval, Playas y Cultura',
            seoDescription:
                'Viví el carnaval, las playas y la energía cultural de Gualeguaychú. Un destino imperdible del litoral argentino.',
            seoKeywords: [
                'Gualeguaychú',
                'Entre Ríos',
                'carnaval del país',
                'río Gualeguaychú',
                'vida nocturna',
                'turismo joven',
                'costanera'
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
