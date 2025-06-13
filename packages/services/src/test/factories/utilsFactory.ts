import crypto from 'node:crypto';
import type { SeoType } from '@repo/types';

/**
 * Returns mock admin info for testing purposes.
 * @param overrides - Fields to override in the mock.
 * @returns AdminInfo object
 */
export const getMockAdminInfo = (
    overrides: Partial<{ notes: string; favorite: boolean }> = {}
) => ({
    notes: 'Notas para administración',
    favorite: false,
    ...overrides
});

/**
 * Returns mock SEO information for testing purposes.
 * @param overrides - Fields to override in the mock.
 * @returns SeoType object
 */
export const getMockSeo = (overrides: Partial<SeoType> = {}) => ({
    title: 'Título SEO válido para test (máx 60)',
    description:
        'Descripción SEO suficientemente larga para pasar la validación de Zod. Debe tener más de 70 caracteres para que pase.',
    keywords: ['test', 'seo', 'keywords'] as string[],
    ...overrides
});

type idTypes =
    | 'user'
    | 'accommodation'
    | 'destination'
    | 'post'
    | 'event'
    | 'tag'
    | 'destination-review'
    | 'accommodation-review'
    | 'postReview'
    | 'eventReview'
    | 'amenity'
    | 'attraction'
    | 'event-location'
    | 'feature'
    | 'post-sponsor'
    | 'user-bookmark';

const idTypeStrings = {
    user: generateValidUuidFromLabel('user'),
    accommodation: generateValidUuidFromLabel('accommodation'),
    destination: generateValidUuidFromLabel('destination'),
    post: generateValidUuidFromLabel('post'),
    event: generateValidUuidFromLabel('event'),
    tag: generateValidUuidFromLabel('tag'),
    'destination-review': generateValidUuidFromLabel('destination-review'),
    'accommodation-review': generateValidUuidFromLabel('accommodation-review'),
    postReview: generateValidUuidFromLabel('postReview'),
    eventReview: generateValidUuidFromLabel('eventReview'),
    amenity: generateValidUuidFromLabel('amenity'),
    attraction: generateValidUuidFromLabel('attraction'),
    'event-location': generateValidUuidFromLabel('event-location'),
    feature: generateValidUuidFromLabel('feature'),
    'post-sponsor': generateValidUuidFromLabel('post-sponsor'),
    'user-bookmark': generateValidUuidFromLabel('user-bookmark')
};

function generateValidUuidFromLabel(label: string): string {
    const rawUuid = crypto.randomUUID();
    const prefix = crypto.createHash('md5').update(label).digest('hex').slice(0, 8);
    return `${prefix}-${rawUuid.slice(9)}`;
}

export const getMockId = (type: idTypes, id?: string) => {
    if (id && /^[0-9a-fA-F-]{36}$/.test(id)) return id;
    if (id) {
        const hash = crypto.createHash('md5').update(id).digest('hex');
        return (
            `${hash.substring(0, 8)}-` +
            `${hash.substring(8, 12)}-` +
            `${hash.substring(12, 16)}-` +
            `${hash.substring(16, 20)}-` +
            `${hash.substring(20, 32)}`
        );
    }
    return idTypeStrings[type];
};
