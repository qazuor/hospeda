import { db } from '../../client';
import { posts } from '../../schema/posts';

const now = new Date().toISOString();

/**
 * Seeds example blog/news posts with varying structure.
 */
export async function seedExamplePosts() {
    await db.delete(posts);

    await db.insert(posts).values([
        {
            id: '40000000-0000-0000-0000-000000000001',
            slug: 'playas-colon-verano',
            category: 'TOURISM',
            title: 'Las mejores playas para disfrutar en Colón',
            summary: 'Una guía rápida para encontrar tu rincón favorito al sol.',
            content: '<p>Colón ofrece playas amplias, arena limpia y balnearios familiares.</p>',
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg',
                    state: 'ACTIVE'
                }
            },
            tags: ['verano', 'río', 'familia'],
            isFeatured: true,
            visibility: 'PUBLIC',
            authorId: '10000000-0000-0000-0000-000000000001', // admin1
            seo: {
                seoTitle: 'Playas de Colón',
                seoDescription: 'Descubrí las playas más lindas de Colón, Entre Ríos.',
                seoKeywords: ['playas', 'colon', 'verano']
            },
            adminInfo: {
                notes: '',
                favorite: true,
                tags: ['destacado', 'turismo']
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '40000000-0000-0000-0000-000000000002',
            slug: 'sabores-entre-rios',
            category: 'GASTRONOMY',
            title: 'Sabores entrerrianos que no te podés perder',
            summary: 'Exploramos los platos típicos de la región litoral.',
            content:
                '<p>Desde el asado criollo hasta el pescado de río, una experiencia única.</p>',
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/262047/pexels-photo-262047.jpeg',
                    state: 'ACTIVE'
                }
            },
            tags: ['comida', 'gastronomía', 'local'],
            isFeatured: false,
            visibility: 'PUBLIC',
            authorId: '10000000-0000-0000-0000-000000000002', // editor1
            seo: {
                seoTitle: 'Comida típica de Entre Ríos',
                seoDescription: 'Conocé qué platos probar durante tu visita.',
                seoKeywords: ['comida regional', 'pescado', 'asado']
            },
            adminInfo: {
                notes: 'Artículo semestral, actualizar cada temporada.',
                favorite: false,
                tags: []
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '40000000-0000-0000-0000-000000000003',
            slug: 'evento-cultural-pueblo',
            category: 'CULTURE',
            title: 'Festival en Pueblo Belgrano',
            summary: 'Arte, danza y tradición en un evento para toda la familia.',
            content: '',
            media: {
                featuredImage: {
                    url: 'https://images.pexels.com/photos/235049/pexels-photo-235049.jpeg',
                    state: 'ACTIVE'
                }
            },
            tags: [],
            isFeatured: false,
            visibility: 'PUBLIC',
            authorId: '10000000-0000-0000-0000-000000000001', // admin1
            seo: undefined,
            adminInfo: {
                notes: '',
                favorite: false,
                tags: []
            },
            createdAt: now,
            updatedAt: now
        }
    ]);
}
