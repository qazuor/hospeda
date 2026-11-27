/**
 * Owner translation routes of the three listing verticals (HOS-2658, spec §9).
 *
 * Route-level contract with the services mocked: each vertical's three routes
 * are wired to the right service call, a malformed id answers 400, a foreign or
 * missing listing 404 (never 403, AC-24), the body schema is per vertical
 * (AC-10), and `richDescription` demands `can_use_rich_description` (AC-23).
 * The DB-backed behaviour is in
 * `test/integration/listing-translations/listing-translations.routes.test.ts`.
 *
 * @module test/routes/listing-translations/listing-translation-routes
 */
import {
    type ListingTranslationsResponse,
    ListingTranslationsResponseSchema,
    PublicationStatusEnum,
    type VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';

const { state, services } = vi.hoisted(() => ({
    state: {
        ownerId: '11111111-1111-4111-8111-111111111111' as string | null,
        keys: [] as string[]
    },
    services: {
        getListingTranslationState: vi.fn(),
        writeManualTranslation: vi.fn(),
        translateListingFieldWithAi: vi.fn()
    }
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () =>
            state.ownerId === null
                ? { facts: null, ownerId: null }
                : {
                      facts: {
                          ownerId: state.ownerId,
                          publicationStatus: PublicationStatusEnum.PUBLISHED,
                          businessLines: []
                      },
                      ownerId: state.ownerId
                  },
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: state.keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
            })
    })
}));

// Test-environment alignment: in this vitest config `@repo/service-core/types`
// (imported by `handleRouteError`) and `@repo/service-core` (imported by the
// listing-access middleware) load two copies of `ServiceError`, so a refusal
// thrown inside a factory handler fails `instanceof` and maps to 500. The
// bundled API resolves both to one module; this mock makes the middleware
// throw the class the error mapper checks.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    ServiceError: (await import('@repo/service-core/types')).ServiceError
}));

vi.mock('../../../src/services/translation/listing-translation-state', () => ({
    getListingTranslationState: services.getListingTranslationState
}));
vi.mock('../../../src/services/translation/listing-translation.service', () => ({
    writeManualTranslation: services.writeManualTranslation,
    translateListingFieldWithAi: services.translateListingFieldWithAi
}));

const {
    ownerAccommodationTranslationRoutes,
    ownerExperienceTranslationRoutes,
    ownerVenueTranslationRoutes,
    translationWriteCapabilities
} = await import('../../../src/routes/listing-translations/index.js');
const { createErrorHandler } = await import('../../../src/middlewares/response.js');

type Vertical = 'accommodation' | 'venue' | 'experience';

const ROUTES = {
    accommodation: ownerAccommodationTranslationRoutes,
    venue: ownerVenueTranslationRoutes,
    experience: ownerExperienceTranslationRoutes
} as const;

const EDIT_KEY: Record<Vertical, string> = {
    accommodation: 'edit_accommodation_info',
    venue: 'edit_venue_info',
    experience: 'edit_experience_info'
};

function app({ vertical, actorId = OWNER }: { vertical: Vertical; actorId?: string }) {
    const instance = new Hono<AppBindings>();
    instance.onError(createErrorHandler());
    instance.use((ctx, next) => {
        ctx.set('actor', { id: actorId, roles: [], permissions: [] } as never);
        return next();
    });
    instance.route('/', ROUTES[vertical].get);
    instance.route('/', ROUTES[vertical].putManual);
    instance.route('/', ROUTES[vertical].postAi);
    return instance;
}

function payload(vertical: Vertical): ListingTranslationsResponse {
    return {
        listingId: LISTING,
        vertical,
        ai: { status: 'available' },
        fields: [
            {
                field: 'name',
                source: 'Casa del Sol',
                locales: {
                    en: {
                        value: 'Sun House',
                        state: 'auto',
                        translatedAt: '2026-11-20T10:00:00.000Z'
                    },
                    pt: { value: '', state: 'pending', translatedAt: null }
                }
            }
        ]
    };
}

const json = (body: unknown) => ({
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
});
const post = (body: unknown) => ({ ...json(body), method: 'POST' });

beforeEach(() => {
    vi.clearAllMocks();
    state.ownerId = OWNER;
    state.keys = [];
    for (const fn of Object.values(services)) {
        fn.mockImplementation(async ({ vertical }: { vertical: Vertical }) => payload(vertical));
    }
});

describe.each([
    'accommodation',
    'venue',
    'experience'
] as const)('%s translation routes', (vertical) => {
    beforeEach(() => {
        state.keys = [EDIT_KEY[vertical]];
    });

    it('GET answers the state projection and validates against the response schema', async () => {
        // Act
        const res = await app({ vertical }).request(`/${LISTING}/translations`);
        const body = (await res.json()) as { success: boolean; data: unknown };

        // Assert
        expect(res.status).toBe(200);
        expect(body.data).toEqual(payload(vertical));
        expect(ListingTranslationsResponseSchema.safeParse(body.data).success).toBe(true);
        expect(services.getListingTranslationState).toHaveBeenCalledWith({
            vertical,
            listingId: LISTING
        });
    });

    it('PUT writes one manual pair through the service', async () => {
        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations`,
            json({ field: 'description', locale: 'en', value: 'Fixed' })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(services.writeManualTranslation).toHaveBeenCalledWith({
            vertical,
            listingId: LISTING,
            field: 'description',
            locale: 'en',
            value: 'Fixed'
        });
    });

    it('POST ai forwards the field and the requested locales', async () => {
        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations/ai`,
            post({ field: 'name', locales: ['pt'] })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(services.translateListingFieldWithAi).toHaveBeenCalledWith({
            vertical,
            listingId: LISTING,
            field: 'name',
            locales: ['pt']
        });
    });

    it('POST ai without locales leaves the default to the service', async () => {
        // Act
        await app({ vertical }).request(`/${LISTING}/translations/ai`, post({ field: 'name' }));

        // Assert
        expect(services.translateListingFieldWithAi).toHaveBeenCalledWith({
            vertical,
            listingId: LISTING,
            field: 'name'
        });
    });

    it('answers 400 VALIDATION_ERROR for a non-UUID id (AC-24)', async () => {
        // Act
        const res = await app({ vertical }).request('/not-a-uuid/translations');

        // Assert
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
            'VALIDATION_ERROR'
        );
        expect(services.getListingTranslationState).not.toHaveBeenCalled();
    });

    it.each([
        ['GET', `/${LISTING}/translations`, undefined],
        ['PUT', `/${LISTING}/translations`, json({ field: 'name', locale: 'en', value: 'x' })],
        ['POST', `/${LISTING}/translations/ai`, post({ field: 'name' })]
    ] as const)('%s answers 404 NOT_FOUND for a listing of somebody else (AC-24)', async (_m, path, init) => {
        // Act
        const res = await app({ vertical, actorId: STRANGER }).request(path, init);

        // Assert
        expect(res.status).toBe(404);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
        for (const fn of Object.values(services)) expect(fn).not.toHaveBeenCalled();
    });

    it('answers 404 NOT_FOUND for a missing listing', async () => {
        // Arrange
        state.ownerId = null;

        // Act
        const res = await app({ vertical }).request(`/${LISTING}/translations`);

        // Assert
        expect(res.status).toBe(404);
    });

    it.each([
        ['locale es', { field: 'name', locale: 'es', value: 'x' }],
        ['over the field max', { field: 'name', locale: 'en', value: 'x'.repeat(101) }],
        ['unknown key', { field: 'name', locale: 'en', value: 'x', extra: true }]
    ])('PUT answers 400 VALIDATION_ERROR for %s (AC-10)', async (_label, body) => {
        // Act
        const res = await app({ vertical }).request(`/${LISTING}/translations`, json(body));

        // Assert
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
            'VALIDATION_ERROR'
        );
        expect(services.writeManualTranslation).not.toHaveBeenCalled();
    });

    it('PUT richDescription answers 403 ENTITLEMENT_REQUIRED without can_use_rich_description (AC-23)', async () => {
        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations`,
            json({ field: 'richDescription', locale: 'en', value: 'Rich' })
        );

        // Assert
        expect(res.status).toBe(403);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
            'ENTITLEMENT_REQUIRED'
        );
        expect(services.writeManualTranslation).not.toHaveBeenCalled();
    });

    it('POST ai richDescription answers 403 ENTITLEMENT_REQUIRED without can_use_rich_description (AC-23)', async () => {
        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations/ai`,
            post({ field: 'richDescription' })
        );

        // Assert
        expect(res.status).toBe(403);
        expect(services.translateListingFieldWithAi).not.toHaveBeenCalled();
    });

    it('PUT richDescription succeeds when the plan grants can_use_rich_description (AC-23)', async () => {
        // Arrange
        state.keys = [EDIT_KEY[vertical], 'can_use_rich_description'];

        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations`,
            json({ field: 'richDescription', locale: 'pt', value: 'Rica' })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(services.writeManualTranslation).toHaveBeenCalledTimes(1);
    });
});

describe('entryNote is a venue-only field (AC-10)', () => {
    it.each([
        'accommodation',
        'experience'
    ] as const)('%s PUT entryNote answers 400', async (vertical) => {
        // Arrange
        state.keys = [EDIT_KEY[vertical]];

        // Act
        const res = await app({ vertical }).request(
            `/${LISTING}/translations`,
            json({ field: 'entryNote', locale: 'en', value: 'Free' })
        );

        // Assert
        expect(res.status).toBe(400);
        expect(services.writeManualTranslation).not.toHaveBeenCalled();
    });

    it('venue PUT entryNote is accepted', async () => {
        // Arrange
        state.keys = [EDIT_KEY.venue];

        // Act
        const res = await app({ vertical: 'venue' }).request(
            `/${LISTING}/translations`,
            json({ field: 'entryNote', locale: 'en', value: 'Free until 1am' })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(services.writeManualTranslation).toHaveBeenCalledWith({
            vertical: 'venue',
            listingId: LISTING,
            field: 'entryNote',
            locale: 'en',
            value: 'Free until 1am'
        });
    });
});

describe('translationWriteCapabilities', () => {
    it('demands can_use_rich_description only for richDescription', () => {
        expect(translationWriteCapabilities({ body: { field: 'richDescription' } })).toEqual([
            'can_use_rich_description'
        ]);
        expect(translationWriteCapabilities({ body: { field: 'description' } })).toEqual([]);
        expect(translationWriteCapabilities({ body: undefined })).toEqual([]);
    });
});
