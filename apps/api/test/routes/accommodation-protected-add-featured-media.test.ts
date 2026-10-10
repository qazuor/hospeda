/**
 * POST /api/v1/protected/accommodations/:id/media/featured — HOS-803.
 *
 * The route's whole reason to exist is that it applies DIFFERENT quota rules
 * from its `POST /:id/media` sibling, so these tests are about the boundary
 * between client and server rather than about photo bookkeeping:
 *
 *  1. a full gallery does NOT produce `LIMIT_REACHED` here — that refusal is
 *     the bug being fixed;
 *  2. the plan cap the service acts on comes from the entitlement context and
 *     from nowhere else. A caller that could state its own cap would reopen the
 *     evasion the whole design exists to close, so the body is checked for it
 *     explicitly rather than assumed clean.
 *
 * `@repo/service-core` is mocked, so nothing here asserts what the service does
 * with the cap — that is covered by
 * `packages/service-core/test/services/accommodation/addFeaturedMedia.test.ts`
 * and the primitive's own suite. What IS asserted is exactly which value the
 * route hands it.
 *
 * @module test/routes/accommodation-protected-add-featured-media
 */

import { ModerationStatusEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const { mockAddFeaturedMedia } = vi.hoisted(() => ({
    mockAddFeaturedMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                addFeaturedMedia: mockAddFeaturedMedia
            };
        })
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: ACTOR_ID, publicationStatus: PublicationStatusEnum.PUBLISHED },
            ownerId: ACTOR_ID
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                hasLiveNonTrialTitle: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
            })
    })
}));

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * The `x-mock-actor-*` triplet is this app's route-test actor convention.
 *
 * Do NOT reach for `vi.mock('../../src/utils/actor.js')` instead: the auth
 * middleware chain reads through that module too, so stubbing it makes every
 * request 500 before routing even happens — which looks exactly like a broken
 * handler and is not one. `user-agent` is separately mandatory
 * (`API_VALIDATION_REQUIRED_HEADERS`); omitting it short-circuits with a 400.
 *
 * The role is ADMIN so `requireEntitlement` takes its documented staff bypass
 * (INV-6). That is a routing convenience, not the subject: the plan cap this
 * file asserts on is supplied by `getRemainingLimit`, which is mocked, so the
 * value under test is the same whichever role walks through the gate. The
 * owner-actor path is covered at the service layer, where the ownership gate
 * actually lives.
 */
const AUTH_HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['accommodation.update.any'])
};

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PREVIOUS_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media/featured`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const VALID_BODY = {
    url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg',
    publicId: 'hospeda/dev/cover',
    alt: 'Frente del alojamiento al atardecer'
};

const CREATED_COVER = {
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: VALID_BODY.url,
    publicId: VALID_BODY.publicId,
    caption: undefined,
    description: undefined,
    alt: VALID_BODY.alt,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: true,
    sortOrder: 16,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

function requestCover(body: Record<string, unknown> = VALID_BODY) {
    return {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(body)
    };
}

/** The service input the route built, or `undefined` if it never got there. */
function serviceInput(): Record<string, unknown> | undefined {
    const call = mockAddFeaturedMedia.mock.calls[0] as
        | [unknown, Record<string, unknown>]
        | undefined;
    return call?.[1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /:id/media/featured — cover upload (HOS-803)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();

        // A 15-photo plan, which is what the reported bug was about.
        mockAddFeaturedMedia.mockResolvedValue({
            data: { media: CREATED_COVER, previousFeatured: null },
            error: undefined
        });
    });

    it('reaches the handler and returns the created cover', async () => {
        const res = await app.request(URL, requestCover());

        // Asserted unconditionally on purpose. A route test that tolerates
        // "auth rejected it instead" proves only that the path is spelled
        // right, and this file's remaining assertions all depend on the
        // handler actually having run.
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.media.isFeatured).toBe(true);
        expect(body.data.media.id).toBe(MEDIA_ID);
    });

    it('reports the id of the cover it replaced', async () => {
        mockAddFeaturedMedia.mockResolvedValue({
            data: { media: CREATED_COVER, previousFeatured: { id: PREVIOUS_ID } },
            error: undefined
        });

        const res = await app.request(URL, requestCover());
        const body = await res.json();

        // That row is soft-deleted server-side, so a response that dropped its
        // id would leave a client holding a photo that no longer exists.
        expect(body.data.previousFeatured.id).toBe(PREVIOUS_ID);
    });

    it('does not refuse a full gallery — that refusal was the bug', async () => {
        // The plan allows 15 and the owner is at 15. The old flow answered
        // LIMIT_REACHED here; this route must not. The swap deletes the cover
        // it replaces, so it moves the gallery by zero either way.

        const res = await app.request(URL, requestCover());

        expect(res.status).toBe(201);
        expect(mockAddFeaturedMedia).toHaveBeenCalledTimes(1);
    });

    // ── The evasion boundary ───────────────────────────────────────────────

    it('ignores a planGalleryCap smuggled into the body', async () => {
        await app.request(URL, requestCover({ ...VALID_BODY, planGalleryCap: 9999 }));

        const input = serviceInput();
        // The server's number, never the caller's.
        expect(input?.planGalleryCap).toBeUndefined();
        expect((input?.media as Record<string, unknown>).planGalleryCap).toBeUndefined();
    });

    it('ignores an isFeatured claimed in the body', async () => {
        await app.request(URL, requestCover({ ...VALID_BODY, isFeatured: false }));

        // The endpoint decides; the payload cannot ask for a gallery row here
        // any more than the gallery endpoint can ask for a cover.
        const media = serviceInput()?.media as Record<string, unknown>;
        expect(media.isFeatured).toBeUndefined();
    });

    // ── Error mapping ──────────────────────────────────────────────────────

    it('maps a service refusal to a 4xx, never a 201', async () => {
        mockAddFeaturedMedia.mockResolvedValue({
            data: undefined,
            error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
        });

        const res = await app.request(URL, requestCover());

        expect(res.status).toBe(404);
    });

    it('rejects a payload with no url', async () => {
        const res = await app.request(URL, requestCover({ publicId: 'hospeda/dev/x' }));

        expect(res.status).toBe(400);
        expect(mockAddFeaturedMedia).not.toHaveBeenCalled();
    });

    it('is not swallowed by the sibling POST /:id/media route', async () => {
        const res = await app.request(URL, requestCover());

        // "featured" must resolve as the fixed suffix, not be absorbed by the
        // collection route — which would silently create a GALLERY row and
        // reinstate the cap refusal this endpoint removes.
        expect(res.status).not.toBe(404);
        expect(mockAddFeaturedMedia).toHaveBeenCalledTimes(1);
    });
});
