import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: San Justo
 */
export async function seedRequiredDestinationSanJusto() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'san-justo')
    });

    if (existing) {
        console.log('[seed] Destination "San Justo" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: San Justo');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000009',
        name: 'San Justo',
        longName: 'San Justo',
        slug: 'san-justo',
        summary:
            'Localidad cercana a Concepción del Uruguay, con historia, aire puro y una vida comunitaria activa y rural.',
        description: `
San Justo es una pequeña ciudad ubicada en el departamento Uruguay, en el corazón de Entre Ríos. Se caracteriza por su entorno apacible, rodeado de campos, y por mantener una vida comunitaria muy activa.

Históricamente, San Justo ha sido centro de encuentros culturales y religiosos. En sus calles se respira tradición, y sus plazas y edificios reflejan una arquitectura sencilla pero encantadora.

A pocos minutos de Concepción del Uruguay, San Justo ofrece una alternativa tranquila con fácil acceso a la ciudad y a puntos turísticos como las termas y playas de río.

Es un excelente lugar para descansar, conectarse con lo esencial y disfrutar de un estilo de vida relajado en un entorno seguro y hospitalario.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/5554622/pexels-photo-5554622.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${5554622 + i}/pexels-photo-${5554622 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.4423',
                long: '-58.2401'
            }
        },
        tags: ['pueblo', 'tranquilidad', 'historia'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'San Justo - Tranquilidad y comunidad',
            seoDescription:
                'San Justo, un pueblo entrerriano ideal para quienes buscan paz, tradición y cercanía con la ciudad.',
            seoKeywords: ['San Justo', 'Entre Ríos', 'pueblo rural', 'historia', 'vida tranquila']
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
