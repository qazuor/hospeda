/**
 * HOS-2336 D5 / AC-5.1 / AC-5.3: public partner reads carry the catalog type
 * as `{ slug, name, nameI18n }`, resolved in one batched query, whatever the
 * type's lifecycle state. A partner not backfilled yet carries `type: null`.
 *
 * @module test/services/partner-presence/partner-presence-read.type
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindBySlug, mockFindCandidates, mockFindRefsByIds } = vi.hoisted(() => ({
    mockFindBySlug: vi.fn(),
    mockFindCandidates: vi.fn(),
    mockFindRefsByIds: vi.fn()
}));

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        PartnerModel: vi.fn().mockImplementation(function () {
            return {
                findPresenceCandidateBySlug: mockFindBySlug,
                findPresenceCandidates: mockFindCandidates
            };
        }),
        partnerTypeModel: { findRefsByIds: mockFindRefsByIds }
    };
});

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async () => ({ entitlements: { get: () => ({ granted: true }) } })
    })
}));

const { getPublicPartnerPage, listCarouselPartners } = await import(
    '../../../src/services/partner-presence/partner-presence-read.service.js'
);

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_ID = '22222222-2222-4222-8222-222222222222';
const MEDIA_NAMES = { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' };

const candidate = (overrides: Record<string, unknown> = {}) => ({
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'diario-litoral',
    name: 'Diario Litoral',
    description: null,
    logoUrl: null,
    websiteUrl: null,
    lifecycleState: 'ACTIVE',
    ownerUserId: OWNER_ID,
    type: null,
    typeId: MEDIA_ID,
    ...overrides
});

beforeEach(() => {
    mockFindBySlug.mockReset();
    mockFindCandidates.mockReset();
    mockFindRefsByIds.mockReset();
    mockFindRefsByIds.mockResolvedValue(
        new Map([
            [
                MEDIA_ID,
                { id: MEDIA_ID, slug: 'media', nameI18n: MEDIA_NAMES, lifecycleState: 'INACTIVE' }
            ]
        ])
    );
});

describe('getPublicPartnerPage — catalog type', () => {
    it('serializes the type as { slug, name, nameI18n }, even when it is inactive (AC-5.3)', async () => {
        mockFindBySlug.mockResolvedValue(candidate());

        const result = await getPublicPartnerPage({ slug: 'diario-litoral' });

        expect(result?.partner.type).toEqual({
            slug: 'media',
            name: 'Medio',
            nameI18n: MEDIA_NAMES
        });
    });

    it('serializes type: null for a partner the backfill has not reached', async () => {
        mockFindBySlug.mockResolvedValue(candidate({ typeId: null, type: 'business' }));

        const result = await getPublicPartnerPage({ slug: 'diario-litoral' });

        expect(result?.partner.type).toBeNull();
    });
});

describe('listCarouselPartners — catalog type', () => {
    it('hydrates every row from one batched lookup', async () => {
        mockFindCandidates.mockResolvedValue([
            candidate(),
            candidate({ id: '44444444-4444-4444-8444-444444444444', slug: 'radio' })
        ]);

        const result = await listCarouselPartners({ filters: {}, page: 1, pageSize: 10 });

        expect(result.items.map((item) => item.type?.slug)).toEqual(['media', 'media']);
        expect(mockFindRefsByIds).toHaveBeenCalledTimes(1);
    });
});
