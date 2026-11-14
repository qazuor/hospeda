import { PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const ACCOMMODATION = '33333333-3333-4333-8333-333333333333';
let keys: string[] = [];
let factsOwner: string | null = OWNER;
let actorIsGuest = false;
const effectiveRead = vi.fn();
const loadFacts = vi.fn(async () =>
    factsOwner === null
        ? { facts: null, ownerId: null }
        : {
              facts: {
                  ownerId: factsOwner,
                  publicationStatus: PublicationStatusEnum.PUBLISHED,
                  businessLines: ['standard']
              },
              ownerId: factsOwner
          }
);
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts,
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: effectiveRead
    })
}));
const { protectedGetAccommodationSectionStatesRoute } = await import(
    '../../../../src/routes/accommodation/protected/sectionStates.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const { createGuestActor } = await import('../../../../src/utils/actor.js');

function app() {
    const instance = new Hono<AppBindings>();
    instance.onError(createErrorHandler());
    instance.use((ctx, next) => {
        ctx.set(
            'actor',
            (actorIsGuest ? createGuestActor() : { id: OWNER, roles: [], permissions: [] }) as never
        );
        return next();
    });
    instance.route('/', protectedGetAccommodationSectionStatesRoute);
    return instance;
}

beforeEach(() => {
    vi.clearAllMocks();
    keys = [];
    factsOwner = OWNER;
    actorIsGuest = false;
    effectiveRead.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' }))
            })
    );
});

describe('GET /accommodations/:id/sections', () => {
    it('answers the complete 11 section map to the owner', async () => {
        const response = await app().request(`/${ACCOMMODATION}/sections`);
        expect(response.status).toBe(200);
        const { data } = await response.json();
        expect(Object.keys(data.sections)).toEqual([
            'basicInfo',
            'capacityPricing',
            'location',
            'amenities',
            'photos',
            'faqs',
            'contact',
            'seo',
            'calendar',
            'translations',
            'externalReputation'
        ]);
        expect(data.multiLine).toBe(false);
        // Without keys: every plain section is available (rubro standard), the
        // keyed ones are locked and their traits follow.
        expect(data.sections.basicInfo.state).toBe('available');
        expect(data.sections.basicInfo.traits).toEqual({
            richDescription: 'locked',
            verification: 'locked'
        });
        expect(data.sections.photos.traits).toEqual({ videos: 'locked' });
        expect(data.sections.calendar).toEqual({
            state: 'locked',
            traits: { externalSync: 'locked' }
        });
    });

    it('reflects each owner key in its trait', async () => {
        keys = [
            'can_use_rich_description',
            'can_embed_video',
            'has_verification_badge',
            'can_use_calendar',
            'can_sync_external_calendar'
        ];
        const { data } = await (await app().request(`/${ACCOMMODATION}/sections`)).json();
        expect(data.sections.basicInfo.traits).toEqual({
            richDescription: 'available',
            verification: 'available'
        });
        expect(data.sections.photos.traits.videos).toBe('available');
        expect(data.sections.calendar).toEqual({
            state: 'available',
            traits: { externalSync: 'available' }
        });
    });

    it('answers 404 for another owner and for a missing accommodation', async () => {
        factsOwner = STRANGER;
        expect((await app().request(`/${ACCOMMODATION}/sections`)).status).toBe(404);
        factsOwner = null;
        expect((await app().request(`/${ACCOMMODATION}/sections`)).status).toBe(404);
    });

    it('answers 400 for a non-UUID id without reading the listing', async () => {
        const response = await app().request('/not-a-uuid/sections');
        expect(response.status).toBe(400);
        expect(loadFacts).not.toHaveBeenCalled();
    });

    it('answers 401 without a session', async () => {
        actorIsGuest = true;
        expect((await app().request(`/${ACCOMMODATION}/sections`)).status).toBe(401);
    });

    it('answers 503 when the effective set cannot be read', async () => {
        effectiveRead.mockRejectedValueOnce(new Error('unavailable'));
        const response = await app().request(`/${ACCOMMODATION}/sections`);
        expect(response.status).toBe(503);
    });
});
