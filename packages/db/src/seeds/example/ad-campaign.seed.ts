import { db } from '../../client';
import { adCampaigns } from '../../schema/adCampaigns';

const now = new Date().toISOString();

export async function seedExampleAdCampaigns() {
    await db.delete(adCampaigns);

    console.log('[seed] Inserting example ad campaigns...');

    await db.insert(adCampaigns).values([
        {
            id: '80000000-0000-0000-0000-000000000001',
            name: 'Temporada Verano Río 2024',
            sponsor: '70000000-0000-0000-0000-000000000001', // Turismo Río
            description: 'Campaña multicanal para atraer turistas a Colón y Gualeguaychú.',
            startDate: now,
            endDate: now,
            campaignState: 'ACTIVE',
            channels: ['EMAIL', 'WEB_BANNER', 'SEARCH_BOOST'],
            tags: ['verano', 'turismo'],
            webBannerPlace: ['HOME', 'ACCOMMODATION_LIST'],
            webBannerTemplate: '<div class="ad-banner">¡Visitá el río!</div>',
            associatedPosts: ['40000000-0000-0000-0000-000000000001'], // playas-colon-verano
            associatedAccommodations: ['20000000-0000-0000-0000-000000000001'], // cabania-rio-colon
            associatedEvents: ['50000000-0000-0000-0000-000000000001'], // festival-rio-colon
            adminInfo: {
                notes: 'Supervisar resultados semanalmente',
                favorite: true,
                tags: ['multicanal']
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '80000000-0000-0000-0000-000000000002',
            name: 'Gastronomía Regional Q1',
            sponsor: '70000000-0000-0000-0000-000000000002', // Sabores del Litoral
            description: 'Anuncios de temporada para gastronomía típica.',
            startDate: now,
            campaignState: 'DRAFT',
            channels: ['EMAIL', 'SOCIAL_MEDIA'],
            tags: ['gastronomía', 'temporada'],
            webBannerTemplate: '<div class="ad-gourmet">Descubrí sabores locales</div>',
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
