import { db } from '../../client';
import { postSponsors, postSponsorships } from '../../schema/posts';

const now = new Date().toISOString();

export async function seedExampleSponsors() {
    await db.delete(postSponsorships);
    await db.delete(postSponsors);

    console.log('[seed] Inserting sponsors...');

    await db.insert(postSponsors).values([
        {
            id: '70000000-0000-0000-0000-000000000001',
            name: 'Turismo Río',
            type: 'POST_SPONSOR',
            description: 'Promotora de actividades turísticas en el litoral.',
            contact: {
                personalEmail: 'contacto@turismorio.com',
                mobilePhone: '+5493410000000',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            social: {
                website: 'https://turismorio.com',
                facebook: 'https://facebook.com/turismorio'
            },
            logo: {
                url: 'https://images.pexels.com/photos/1062249/pexels-photo-1062249.jpeg',
                state: 'ACTIVE'
            },
            tags: ['turismo', 'verano'],
            state: 'ACTIVE',
            adminInfo: {
                notes: 'Cliente premium desde 2023',
                favorite: true,
                tags: ['recurrente']
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '70000000-0000-0000-0000-000000000002',
            name: 'Sabores del Litoral',
            type: 'POST_SPONSOR',
            description: 'Empresas gastronómicas regionales aliadas.',
            contact: {
                personalEmail: 'sabores@litoral.com',
                mobilePhone: '+5493411112222',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            social: {},
            tags: [],
            state: 'ACTIVE',
            adminInfo: {
                notes: '',
                favorite: false,
                tags: []
            },
            createdAt: now,
            updatedAt: now
        }
    ]);

    console.log('[seed] Inserting sponsorships...');

    await db.insert(postSponsorships).values([
        {
            id: '71000000-0000-0000-0000-000000000001',
            sponsorId: '70000000-0000-0000-0000-000000000001',
            description: 'Campaña verano 2024',
            message: 'Queremos invitar a los turistas a visitar nuestras playas',
            tags: ['verano', 'río'],
            paid: { price: 25000, currency: 'ARS' },
            paidAt: now,
            fromDate: now,
            toDate: now,
            isHighlighted: true,
            adminInfo: {
                notes: 'Incluir en posts destacados',
                favorite: false,
                tags: ['temporal']
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '71000000-0000-0000-0000-000000000002',
            sponsorId: '70000000-0000-0000-0000-000000000002',
            description: 'Campaña gourmet',
            message: '',
            tags: ['gastronomía'],
            paid: { price: 18000, currency: 'ARS' },
            paidAt: now,
            fromDate: now,
            toDate: now,
            isHighlighted: false,
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
