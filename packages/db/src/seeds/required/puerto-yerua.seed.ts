import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Puerto Yeruá
 */
export async function seedRequiredDestinationPuertoYerua() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'puerto-yerua')
    });

    if (existing) {
        console.log('[seed] Destination "Puerto Yeruá" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Puerto Yeruá');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000016',
        name: 'Puerto Yeruá',
        longName: 'Puerto Yeruá',
        slug: 'puerto-yerua',
        summary:
            'Pequeño pueblo ribereño ideal para pescar, descansar y disfrutar del entorno natural junto al río Uruguay.',
        description: `
Puerto Yeruá es una tranquila localidad entrerriana ubicada a orillas del río Uruguay, al sur de Concordia. Es un destino elegido por quienes buscan paz, contacto con el río y actividades como la pesca y el camping.

Su costanera arbolada, sus playas fluviales y su puerto natural hacen de este lugar una joya escondida para el turismo de naturaleza. Es habitual ver pescadores, familias acampando y visitantes paseando entre sauces y barrancas.

La cercanía con Concordia permite disfrutar de comodidades urbanas sin perder el entorno rural y natural que caracteriza a Puerto Yeruá. Su comunidad pequeña y hospitalaria conserva tradiciones locales y una vida serena.

Un destino para quienes valoran lo simple, lo verde y lo auténtico.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/162809/pexels-photo-162809.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${162809 + i}/pexels-photo-${162809 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Concordia',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-31.5674',
                long: '-58.0336'
            }
        },
        tags: ['río', 'pesca', 'naturaleza', 'camping'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Puerto Yeruá - Naturaleza, pesca y descanso',
            seoDescription:
                'Descubrí Puerto Yeruá, un paraíso fluvial escondido en Entre Ríos. Pesca, camping y aire libre.',
            seoKeywords: [
                'Puerto Yeruá',
                'pesca',
                'playa fluvial',
                'río Uruguay',
                'turismo natural',
                'camping',
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
