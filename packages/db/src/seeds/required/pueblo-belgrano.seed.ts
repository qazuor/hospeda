import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Pueblo Belgrano
 */
export async function seedRequiredDestinationPuebloBelgrano() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'pueblo-belgrano')
    });

    if (existing) {
        console.log('[seed] Destination "Pueblo Belgrano" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Pueblo Belgrano');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000015',
        name: 'Pueblo Belgrano',
        longName: 'Pueblo General Belgrano',
        slug: 'pueblo-belgrano',
        summary:
            'Destino tranquilo junto a Gualeguaychú, con playas, naturaleza, termas y excelente acceso al carnaval.',
        description: `
Pueblo Belgrano es una localidad vecina a Gualeguaychú que ha crecido rápidamente como destino turístico alternativo. Ofrece alojamientos rurales, acceso a balnearios sobre el río y contacto directo con la naturaleza.

Uno de sus principales atractivos es su cercanía al famoso Carnaval del País, lo que lo convierte en una excelente base para quienes buscan tranquilidad sin alejarse del evento. También cuenta con un parque termal que complementa su propuesta de relax.

Pueblo Belgrano conserva un ambiente sereno, calles arboladas y un entorno familiar. Es ideal para parejas, familias o grupos que buscan una estadía accesible y conectada con la naturaleza.

Un rincón verde y estratégico para descansar, explorar y vivir el espíritu del litoral entrerriano.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/235049/pexels-photo-235049.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${235049 + i}/pexels-photo-${235049 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Gualeguaychú',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-33.0098',
                long: '-58.5198'
            }
        },
        tags: ['playas', 'carnaval', 'termas', 'naturaleza'],
        visibility: 'PUBLIC',
        isFeatured: true,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Pueblo Belgrano - Relax, carnaval y naturaleza',
            seoDescription:
                'Descubrí Pueblo Belgrano: termas, tranquilidad y excelente ubicación junto a Gualeguaychú.',
            seoKeywords: [
                'Pueblo Belgrano',
                'Entre Ríos',
                'termas',
                'playas',
                'carnaval del país',
                'naturaleza',
                'turismo alternativo'
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
