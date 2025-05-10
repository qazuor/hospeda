import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Aldea San Antonio
 */
export async function seedRequiredDestinationAldeaSanAntonio() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'aldea-san-antonio')
    });

    if (existing) {
        console.log('[seed] Destination "Aldea San Antonio" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Aldea San Antonio');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000023',
        name: 'Aldea San Antonio',
        longName: 'Aldea San Antonio',
        slug: 'aldea-san-antonio',
        summary:
            'Aldea rural con raíces alemanas del Volga, fiestas típicas y un entorno natural para disfrutar la tradición y el campo.',
        description: `
Aldea San Antonio es una localidad del departamento Gualeguaychú, fundada por inmigrantes alemanes del Volga que dejaron una fuerte impronta en su cultura, gastronomía y arquitectura.

Es reconocida por su Fiesta del Inmigrante Alemán, donde se celebran las tradiciones, trajes típicos y bailes del Volga. Sus calles son tranquilas, sus casas bajas y prolijas, y su gente cálida y orgullosa de su herencia.

El entorno rural que rodea la aldea ofrece campos cultivados, caminos arbolados y horizontes abiertos ideales para paseos, fotografía o simplemente respirar aire puro.

Un destino perfecto para reconectar con las raíces, la vida sencilla y las costumbres centroeuropeas que perduran en Entre Ríos.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${271624 + i}/pexels-photo-${271624 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Gualeguaychú',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-32.4455',
                long: '-58.6029'
            }
        },
        tags: ['inmigrantes', 'alemán del Volga', 'tradición', 'fiesta'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Aldea San Antonio - Tradición alemana en el campo entrerriano',
            seoDescription:
                'Visitá Aldea San Antonio: cultura del Volga, fiestas típicas y naturaleza en el sur de Entre Ríos.',
            seoKeywords: [
                'Aldea San Antonio',
                'inmigrantes alemanes',
                'fiesta del inmigrante',
                'alemán del Volga',
                'turismo rural',
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
