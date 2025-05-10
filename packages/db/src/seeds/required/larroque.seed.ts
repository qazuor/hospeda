import { db } from '../../client';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

/**
 * Seeds destination: Larroque
 */
export async function seedRequiredDestinationLarroque() {
    const existing = await db.query.destinations.findFirst({
        where: (d, { eq }) => eq(d.slug, 'larroque')
    });

    if (existing) {
        console.log('[seed] Destination "Larroque" already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting destination: Larroque');

    await db.insert(destinations).values({
        id: '30000000-0000-0000-0000-000000000014',
        name: 'Larroque',
        longName: 'Larroque',
        slug: 'larroque',
        summary:
            'Ciudad del departamento Gualeguaychú con raíces rurales, ambiente familiar y una vida cultural activa.',
        description: `
Larroque es una pequeña ciudad ubicada entre Gualeguaychú y Urdinarrain. Se destaca por su identidad rural, su comunidad unida y su desarrollo cultural sostenido en los últimos años.

En Larroque se realizan festivales, encuentros literarios y eventos deportivos que involucran a toda la comunidad. La tranquilidad de sus calles y la amabilidad de su gente la hacen ideal para visitas relajadas.

Cuenta con clubes deportivos, escuelas, comercios y plazas que reflejan su perfil de ciudad organizada y autosustentable. Los visitantes pueden disfrutar de comidas caseras, historia local y naturaleza tranquila.

Larroque es sinónimo de tradición, participación comunitaria y espíritu entrerriano.
    `.trim(),
        media: {
            featuredImage: {
                url: 'https://images.pexels.com/photos/2570063/pexels-photo-2570063.jpeg',
                state: 'ACTIVE'
            },
            gallery: Array.from({ length: 15 }).map((_, i) => ({
                url: `https://images.pexels.com/photos/${2570063 + i}/pexels-photo-${2570063 + i}.jpeg`,
                state: 'ACTIVE'
            }))
        },
        location: {
            department: 'Gualeguaychú',
            state: 'Entre Ríos',
            country: 'Argentina',
            coordinates: {
                lat: '-33.0331',
                long: '-58.6453'
            }
        },
        tags: ['cultura', 'rural', 'eventos'],
        visibility: 'PUBLIC',
        isFeatured: false,
        rating: undefined,
        reviews: [],
        seo: {
            seoTitle: 'Larroque - Cultura y comunidad rural',
            seoDescription:
                'Conocé Larroque: ciudad entrerriana con raíces rurales, festivales y vida tranquila.',
            seoKeywords: [
                'Larroque',
                'Entre Ríos',
                'cultura',
                'eventos',
                'turismo rural',
                'ciudad tranquila'
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
