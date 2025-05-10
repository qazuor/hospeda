import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

export async function seedRequiredDestinationVillaParanacito() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'villa-paranacito')
    });

    if (existing) {
        console.log('[seed] Destination "Villa Paranacito" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Villa Paranacito');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000006',
        name: 'Villa Paranacito',
        longName: 'Villa Paranacito',
        slug: 'villa-paranacito',
        summary:
            'Un rincón isleño y tranquilo rodeado de naturaleza y ríos, ideal para la pesca y la desconexión total.',
        description: `
Villa Paranacito es una localidad ubicada en el delta entrerriano, donde los paisajes fluviales dominan el entorno. Rodeada de islas y cursos de agua, esta villa ofrece un contacto íntimo con la naturaleza.

Los visitantes disfrutan de paseos en lancha, pesca deportiva, y la tranquilidad característica del delta. Las casas sobre pilotes, los arroyos y el verde exuberante invitan a la contemplación y el descanso.

Su población cálida y hospitalaria mantiene vivas las tradiciones isleñas, y el turismo crece con propuestas sustentables.

Un destino único para los amantes del río, la pesca, la fotografía y la paz.
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
            department: 'Islas del Ibicuy',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-33.7077',
                long: '-58.6453'
            }
        },
        tags: ['delta', 'pesca', 'río'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Villa Paranacito - Naturaleza y Río',
            seoDescription:
                'Explorá el delta entrerriano desde Villa Paranacito. Naturaleza, pesca y tranquilidad.',
            seoKeywords: [
                'Villa Paranacito',
                'pesca',
                'islas',
                'delta',
                'Entre Ríos',
                'turismo de río'
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
