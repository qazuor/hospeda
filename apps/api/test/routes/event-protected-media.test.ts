/**
 * Route tests for the protected event media endpoints (HOS-390).
 *
 * The five handlers are thin — they resolve the actor, forward to the service
 * helper and map the error envelope — so the interesting risk is not the handler
 * bodies but ROUTING RESOLUTION. Three of the paths overlap:
 *
 *   PATCH /{id}/media/reorder
 *   PUT   /{id}/media/{mediaId}/featured
 *   DELETE/{id}/media/{mediaId}
 *
 * What these tests actually prove — measured by mutation, not assumed:
 *
 *  - Each path reaches the helper it names, with the right ids extracted, and
 *    does NOT fall through to the delete handler. Deleting the reorder
 *    registration turns the reorder case red.
 *  - They do NOT pin the REGISTRATION ORDER, despite the "must be registered
 *    before" comments in `index.ts`. Registering the DELETE route first leaves
 *    every test green: Hono's router resolves a static segment (`reorder`,
 *    `featured`) ahead of a param segment (`{mediaId}`) regardless of insertion
 *    order. The ordering convention is kept because the rest of the codebase
 *    follows it and it costs nothing, but it is belt-and-braces — do not rely on
 *    this file to catch a reordering.
 *
 * The service layer is mocked: its behavior is covered by
 * `packages/service-core/test/services/event/event.media.test.ts`.
 *
 * @module test/routes/event-protected-media
 */

import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const { mockGetMedia, mockAddMedia, mockRemoveMedia, mockReorderMedia, mockSetFeaturedMedia } =
    vi.hoisted(() => ({
        mockGetMedia: vi.fn(),
        mockAddMedia: vi.fn(),
        mockRemoveMedia: vi.fn(),
        mockReorderMedia: vi.fn(),
        mockSetFeaturedMedia: vi.fn()
    }));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        getEventMedia: mockGetMedia,
        addEventMedia: mockAddMedia,
        removeEventMedia: mockRemoveMedia,
        reorderEventMedia: mockReorderMedia,
        setFeaturedEventMedia: mockSetFeaturedMedia
    };
});

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_MEDIA_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BASE = `/api/v1/protected/events/${EVENT_ID}/media`;
/**
 * The `x-mock-actor-*` triplet is this suite's actor convention (mirrors
 * `gastronomy/admin/media.test.ts`). Do NOT mock `utils/actor.js` instead — the
 * auth middleware chain reads through it too, and stubbing it makes every
 * request 500 before routing.
 *
 * `user-agent` is separately mandatory (`API_VALIDATION_REQUIRED_HEADERS`
 * defaults to it); omitting it short-circuits every request with a 400.
 */
const AUTH = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'USER',
    'x-mock-actor-permissions': JSON.stringify([PermissionEnum.EVENT_UPDATE_OWN])
};

const NOW = new Date('2026-01-15T12:00:00.000Z');

const MEDIA_ROW = {
    id: MEDIA_ID,
    eventId: EVENT_ID,
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    publicId: 'hospeda/dev/sample',
    caption: 'Vista al río',
    alt: 'Foto del evento',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.PENDING,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

describe('protected event media routes (HOS-390)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();

        mockGetMedia.mockResolvedValue({ data: { media: [MEDIA_ROW] }, error: undefined });
        mockAddMedia.mockResolvedValue({ data: { media: MEDIA_ROW }, error: undefined });
        mockRemoveMedia.mockResolvedValue({ data: { success: true }, error: undefined });
        mockReorderMedia.mockResolvedValue({ data: { media: [MEDIA_ROW] }, error: undefined });
        mockSetFeaturedMedia.mockResolvedValue({
            data: { media: { ...MEDIA_ROW, isFeatured: true } },
            error: undefined
        });
    });

    // ── Routing resolution ────────────────────────────────────────────────────

    describe('routing resolution', () => {
        it('PATCH /{id}/media/reorder reaches the reorder helper, not the delete one', async () => {
            const res = await app.request(`${BASE}/reorder`, {
                method: 'PATCH',
                headers: AUTH,
                body: JSON.stringify({ orderedIds: [MEDIA_ID, OTHER_MEDIA_ID] })
            });

            expect(res.status).toBe(200);
            expect(mockReorderMedia).toHaveBeenCalledTimes(1);
            expect(mockRemoveMedia).not.toHaveBeenCalled();
            // The literal "reorder" must never have been read as a mediaId.
            // (Hono gets this right by itself — see the module note.)
            expect(mockReorderMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                orderedIds: [MEDIA_ID, OTHER_MEDIA_ID]
            });
        });

        it('PUT /{id}/media/{mediaId}/featured reaches the set-featured helper', async () => {
            const res = await app.request(`${BASE}/${MEDIA_ID}/featured`, {
                method: 'PUT',
                headers: AUTH
            });

            expect(res.status).toBe(200);
            expect(mockSetFeaturedMedia).toHaveBeenCalledTimes(1);
            expect(mockRemoveMedia).not.toHaveBeenCalled();
            expect(mockSetFeaturedMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                mediaId: MEDIA_ID
            });
        });

        it('DELETE /{id}/media/{mediaId} reaches the remove helper with both ids', async () => {
            const res = await app.request(`${BASE}/${MEDIA_ID}`, {
                method: 'DELETE',
                headers: AUTH
            });

            expect(res.status).toBe(200);
            expect(mockRemoveMedia).toHaveBeenCalledTimes(1);
            expect(mockRemoveMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                mediaId: MEDIA_ID
            });
        });

        it('GET /{id}/media forwards the optional state filter', async () => {
            const res = await app.request(`${BASE}?state=archived`, {
                method: 'GET',
                headers: AUTH
            });

            expect(res.status).toBe(200);
            expect(mockGetMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                state: 'archived'
            });
        });

        it('GET /{id}/media leaves state undefined when not supplied', async () => {
            await app.request(BASE, { method: 'GET', headers: AUTH });

            expect(mockGetMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                state: undefined
            });
        });

        it('POST /{id}/media forwards the body as the media payload', async () => {
            const body = { url: MEDIA_ROW.url, caption: 'Una leyenda' };
            const res = await app.request(BASE, {
                method: 'POST',
                headers: AUTH,
                body: JSON.stringify(body)
            });

            expect([200, 201]).toContain(res.status);
            expect(mockAddMedia.mock.calls[0]?.[2]).toEqual({
                eventId: EVENT_ID,
                media: expect.objectContaining({ url: MEDIA_ROW.url, caption: 'Una leyenda' })
            });
        });
    });

    // ── Error mapping ─────────────────────────────────────────────────────────

    describe('error mapping', () => {
        it('maps a service FORBIDDEN onto a 4xx rather than a 200', async () => {
            mockAddMedia.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Forbidden: cannot update event'
                }
            });

            const res = await app.request(BASE, {
                method: 'POST',
                headers: AUTH,
                body: JSON.stringify({ url: MEDIA_ROW.url })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('maps a service NOT_FOUND onto a 4xx', async () => {
            mockRemoveMedia.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Event not found' }
            });

            const res = await app.request(`${BASE}/${MEDIA_ID}`, {
                method: 'DELETE',
                headers: AUTH
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });

    // ── Input validation ──────────────────────────────────────────────────────

    describe('input validation', () => {
        it('rejects a non-UUID event id before reaching the service', async () => {
            const res = await app.request('/api/v1/protected/events/not-a-uuid/media', {
                method: 'GET',
                headers: AUTH
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(mockGetMedia).not.toHaveBeenCalled();
        });

        it('rejects an add payload whose url is not a URL', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: AUTH,
                body: JSON.stringify({ url: 'not-a-url' })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(mockAddMedia).not.toHaveBeenCalled();
        });
    });
});
