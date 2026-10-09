/** TEST:V5:6 — public detail responses for published and hidden foreign listings. */
import { afterEach, describe, expect, it, vi } from 'vitest';

const { addMedia } = vi.hoisted(() => ({ addMedia: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    addGastronomyMedia: addMedia
}));

import { GastronomySchema, PublicationStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { assertListingReadable, GastronomyService, ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

const LISTING_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';
const row = GastronomySchema.parse({
    id: LISTING_ID,
    slug: 'test-listing',
    name: 'Test Listing',
    type: 'PARRILLA',
    summary: 'A test listing',
    description: 'A sufficiently detailed description for this listing.',
    ownerId: '22222222-2222-4222-8222-222222222222',
    destinationId: '55555555-5555-4555-8555-555555555555',
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    moderationState: 'APPROVED',
    isPriceOnRequest: false,
    featuredByEntitlement: false,
    averageRating: 4.5,
    reviewsCount: 0,
    isFeatured: false,
    media: null,
    seo: null,
    socialNetworks: null,
    contactInfo: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    richDescription: null,
    openingHours: null,
    deletedAt: null,
    deletedById: null,
    createdById: null,
    updatedById: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
});

describe('TEST:V5:6 published foreign gastronomy writes', () => {
    it('pairs PATCH and POST media refusals with an invented id', async () => {
        const { initApp } = await import('../../src/app.js');
        const app = initApp();
        vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({ data: row });
        const updateOwn = vi.spyOn(GastronomyService.prototype, 'updateOwn');
        updateOwn.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'gastronomy not found' }
        });
        addMedia.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'gastronomy not found' }
        });
        const headers = {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': '11111111-1111-4111-8111-111111111111',
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': JSON.stringify(['gastronomy.editOwn'])
        };
        for (const [method, suffix, body] of [
            ['PATCH', '', { name: 'Changed' }],
            ['POST', '/media', { url: 'https://example.com/photo.jpg' }]
        ] as const) {
            const send = async (id: string) => {
                const response = await app.request(
                    `/api/v1/protected/gastronomies/${id}${suffix}`,
                    {
                        method,
                        headers,
                        body: JSON.stringify(body)
                    }
                );
                const result: unknown = await response.json();
                if (result && typeof result === 'object' && 'metadata' in result) {
                    const { metadata, ...rest } = result;
                    return {
                        status: response.status,
                        body: {
                            ...rest,
                            metadataKeys:
                                metadata && typeof metadata === 'object'
                                    ? Object.keys(metadata).sort()
                                    : []
                        }
                    };
                }
                return { status: response.status, body: result };
            };
            const foreign = await send(LISTING_ID);
            const missing = await send(MISSING_ID);
            expect(foreign).toEqual(missing);
            expect(foreign.status).toBe(404);
        }
        expect(updateOwn).toHaveBeenCalled();
        expect(addMedia).toHaveBeenCalled();
    });
});

async function probe(app: Hono<AppBindings>, id: string) {
    const response = await app.request(`/${id}`);
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'metadata' in body) {
        const { metadata, ...rest } = body;
        return {
            status: response.status,
            body: {
                ...rest,
                metadataKeys:
                    metadata && typeof metadata === 'object' ? Object.keys(metadata).sort() : []
            }
        };
    }
    return { status: response.status, body };
}

afterEach(() => vi.restoreAllMocks());

describe('TEST:V5:6 public gastronomy detail', () => {
    it('shows only PUBLISHED and pairs every hidden state with an invented id', async () => {
        const { publicGetGastronomyByIdRoute } = await import(
            '../../src/routes/gastronomy/public/getById.js'
        );
        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('actor', {
                id: '11111111-1111-4111-8111-111111111111',
                roles: [RoleEnum.USER],
                permissions: []
            });
            return next();
        });
        app.route('/', publicGetGastronomyByIdRoute);
        let publicationStatus: PublicationStatusEnum | null = null;
        let visibility = 'PUBLIC';
        vi.spyOn(GastronomyService.prototype, 'getById').mockImplementation(async (actor, id) => {
            if (id === MISSING_ID) {
                return {
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'gastronomy not found' }
                };
            }
            const entity = { ...row, publicationStatus, visibility };
            try {
                assertListingReadable({ actor, entity, entityName: GastronomyService.ENTITY_NAME });
            } catch (error) {
                if (error instanceof ServiceError) {
                    return { error: { code: error.code, message: error.message } };
                }
                throw error;
            }
            return { data: row };
        });
        const missing = await probe(app, MISSING_ID);
        expect(missing.status).toBe(404);
        for (const status of [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED,
            null
        ]) {
            publicationStatus = status;
            visibility = status === null ? 'RESTRICTED' : 'PUBLIC';
            expect(await probe(app, LISTING_ID)).toEqual(missing);
        }
        publicationStatus = PublicationStatusEnum.PUBLISHED;
        visibility = 'PUBLIC';
        expect((await probe(app, LISTING_ID)).status).toBe(200);
    });
});
