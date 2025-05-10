import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Santa Ana
 */
export async function seedRequiredDestinationSantaAna() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'santa-ana')
    });

    if (existing) {
        console.log('[seed] Destination "Santa Ana" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Santa Ana');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000018',
        name: 'Santa Ana',
        longName: 'Santa Ana',
        slug: 'santa-ana',
        summary:
            'Localidad costera sobre el lago Salto Grande, famosa por sus playas, citrus y entorno natural privilegiado.',
        description: `
Santa Ana es una pequeña localidad del norte entrerriano ubicada a orillas del lago Salto Grande. Su paisaje combina playa, verde y citrus, lo que la convierte en un lugar ideal para el descanso, el turismo de naturaleza y la vida al aire libre.

Las playas de arena clara, las aguas calmas y los campings hacen de Santa Ana un destino veraniego por excelencia. La actividad citrícola también forma parte de su identidad, con plantaciones de naranjas y mandarinas que tiñen de color la región.

A lo largo del año se celebran eventos como la Fiesta del Citrus, que mezcla música, cultura y tradición. Es un lugar ideal para disfrutar en familia, practicar deportes náuticos o simplemente relajarse mirando el lago.

Santa Ana es un remanso de paz y frescura en el litoral argentino.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${258154 + i}/pexels-photo-${258154 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Federación',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-30.9476',
                long: '-57.9314'
            }
        },
        tags: ['playas', 'citrus', 'lago', 'verano'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Santa Ana - Playas y citrus junto al lago',
            seoDescription:
                'Disfrutá de las playas, los campos cítricos y la tranquilidad de Santa Ana, a orillas del lago Salto Grande.',
            seoKeywords: [
                'Santa Ana',
                'Entre Ríos',
                'playas',
                'citrus',
                'lago Salto Grande',
                'naturaleza',
                'turismo familiar'
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
