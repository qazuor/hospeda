import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Concordia
 */
export async function seedRequiredDestinationConcordia() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'concordia')
    });

    if (existing) {
        console.log('[seed] Destination "Concordia" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Concordia');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000004',
        name: 'Concordia',
        longName: 'Concordia',
        slug: 'concordia',
        summary:
            'Ciudad con atractivos naturales, termas, lago Salto Grande y cultura, ubicada a orillas del río Uruguay.',
        description: `
Concordia es una ciudad vibrante del noreste entrerriano, reconocida por su imponente paisaje ribereño, sus termas y su patrimonio histórico. Está situada junto al río Uruguay, en la costa del lago Salto Grande, que le brinda un marco natural inigualable.

La ciudad es famosa por su circuito termal, que ofrece bienestar y relax para todas las edades. Además, es un centro productivo clave del país, especialmente en la producción de cítricos. Su costanera invita a recorrerla a pie o en bicicleta, disfrutando de su ambiente tranquilo.

Concordia ofrece una interesante vida cultural, con museos, centros históricos, plazas y una activa agenda de eventos durante todo el año. La gastronomía local combina lo mejor del litoral y la cocina criolla.

Es un destino ideal para quienes buscan relajarse, disfrutar de actividades al aire libre y conocer la historia y vida de una ciudad pujante y amable.
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
                lat: '-31.39195',
                long: '-58.01706'
            }
        },
        tags: ['termas', 'lago', 'relax'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Concordia - Termas, Lago y Cultura',
            seoDescription:
                'Relajate en las termas, paseá por el lago y disfrutá de la historia en Concordia, Entre Ríos.',
            seoKeywords: [
                'Concordia',
                'Entre Ríos',
                'termas',
                'lago Salto Grande',
                'río Uruguay',
                'cítricos',
                'turismo cultural',
                'actividades al aire libre'
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
