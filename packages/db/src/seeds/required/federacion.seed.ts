import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Federación
 */
export async function seedRequiredDestinationFederacion() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'federacion')
    });

    if (existing) {
        console.log('[seed] Destination "Federación" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Federación');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000005',
        name: 'Federación',
        longName: 'Federación',
        slug: 'federacion',
        summary:
            'Ciudad termal por excelencia, con lago, naturaleza y un parque acuático ideal para el relax y la familia.',
        description: `
Federación, conocida como la “ciudad jardín”, es un destino termal por excelencia en Entre Ríos. Reconstruida a orillas del lago Salto Grande luego de la inundación original, combina historia de resiliencia con un crecimiento turístico sostenido.

El Parque Termal Federación es uno de los más modernos del país, con piscinas cubiertas y al aire libre, espacios para niños y tratamientos de bienestar. A su alrededor, se extiende un entorno natural ideal para desconectarse, practicar deportes y descansar.

La ciudad también cuenta con un parque acuático que atrae a familias y jóvenes, paseos costeros, ferias de productos locales y una oferta gastronómica que destaca por su calidez y sabor regional.

Federación es sin duda un lugar para recargar energías, disfrutar del agua y la naturaleza, y compartir momentos inolvidables en pareja, familia o con amigos.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${262048 + i}/pexels-photo-${262048 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Federación',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-30.985',
                long: '-57.92'
            }
        },
        tags: ['termas', 'parque acuático', 'lago'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Federación - Termas y Parque Acuático en Entre Ríos',
            seoDescription:
                'Disfrutá del agua, el lago y el relax en Federación. Un destino termal ideal para toda la familia.',
            seoKeywords: [
                'Federación',
                'Entre Ríos',
                'termas',
                'parque acuático',
                'relax',
                'turismo termal',
                'familia',
                'lago Salto Grande',
                'bienestar'
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
