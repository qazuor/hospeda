import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Ubajay
 */
export async function seedRequiredDestinationUbajay() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'ubajay')
    });

    if (existing) {
        console.log('[seed] Destination "Ubajay" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Ubajay');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000019',
        name: 'Ubajay',
        longName: 'Ubajay',
        slug: 'ubajay',
        summary:
            'Pequeña localidad con raíces ferroviarias e inmigrantes judíos, puerta de entrada al Parque Nacional El Palmar.',
        description: `
Ubajay es una localidad ubicada al norte del Parque Nacional El Palmar, en el departamento Colón. Fue uno de los primeros asentamientos de inmigrantes judíos en la provincia, con fuerte vínculo con el ferrocarril y la agricultura.

La historia está presente en sus calles, su estación de tren y su gente. El Museo de la Colonización Judía y la sinagoga local dan testimonio de una comunidad que dejó huella.

Ubajay es también la puerta de entrada al parque nacional, lo que la convierte en una excelente base para explorar los palmares y senderos naturales.

Es un destino ideal para quienes valoran la historia, la identidad local y el turismo tranquilo en entornos rurales y naturales.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${269077 + i}/pexels-photo-${269077 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Colón',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-31.85',
                long: '-58.2833'
            }
        },
        tags: ['historia', 'ferrocarril', 'Parque El Palmar', 'inmigración'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Ubajay - Historia y naturaleza en el litoral',
            seoDescription:
                'Conocé Ubajay, lugar histórico de colonos judíos y entrada al Parque Nacional El Palmar.',
            seoKeywords: [
                'Ubajay',
                'ferrocarril',
                'inmigración judía',
                'Parque El Palmar',
                'historia',
                'colonia agrícola',
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
