/**
 * Route tests for the photo text-metadata PATCH added by HOS-1036:
 *
 *   PATCH /api/v1/{protected,admin}/posts/:id/media/:mediaId
 *   PATCH /api/v1/{protected,admin}/events/:id/media/:mediaId
 *   PATCH /api/v1/{protected,admin}/gastronomies/:id/media/:mediaId
 *   PATCH /api/v1/{protected,admin}/experiences/:id/media/:mediaId
 *
 * Eight thin handlers with one job each: resolve the actor, forward the four
 * text fields, map the error envelope. So what is worth pinning here is not
 * business behavior (covered in service-core's `*.media.update.test.ts`) but
 * the three things a route can get wrong on its own:
 *
 *  1. NOT BEING WIRED. A route file that exists but was never added to its
 *     tier's barrel 404s while looking perfectly finished in the diff. Every
 *     case below would fail on an unregistered route, and the DELETE that
 *     shares the exact same path shape is asserted to still resolve — one must
 *     not shadow the other.
 *  2. DROPPING A FIELD. The forwarded object is asserted with `toEqual` on the
 *     WHOLE payload, never `expect.objectContaining`: that matcher is blind to
 *     a missing key, and "the handler forgets `alt`" is precisely the bug this
 *     endpoint exists to prevent. `null` is asserted separately, because a
 *     naive `if (value)` forward drops exactly the half of "correct it" that
 *     means "clear it".
 *  3. ANSWERING THE WRONG STATUS. A media row owned by someone else must come
 *     back 404, never 403 — a 403 confirms the id exists
 *     (`apps/api/docs/error-contract.md`) — and a 4xx must never carry
 *     `INTERNAL_ERROR`.
 *
 * The service layer is mocked, so no DB is touched. `user-agent` is mandatory
 * on every request: `validationConfig.requiredHeaders` defaults to it, and
 * omitting it short-circuits with a 400 before the handler ever runs, which is
 * how a suite ends up green having exercised nothing.
 *
 * @module test/routes/media-update-text
 */

import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const {
    mockUpdatePost,
    mockUpdateEvent,
    mockUpdateGastronomy,
    mockUpdateExperience,
    mockRemovePost,
    mockRemoveEvent,
    mockRemoveGastronomy,
    mockRemoveExperience
} = vi.hoisted(() => ({
    mockUpdatePost: vi.fn(),
    mockUpdateEvent: vi.fn(),
    mockUpdateGastronomy: vi.fn(),
    mockUpdateExperience: vi.fn(),
    mockRemovePost: vi.fn(),
    mockRemoveEvent: vi.fn(),
    mockRemoveGastronomy: vi.fn(),
    mockRemoveExperience: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        updatePostMedia: mockUpdatePost,
        updateEventMedia: mockUpdateEvent,
        updateGastronomyMedia: mockUpdateGastronomy,
        updateExperienceMedia: mockUpdateExperience,
        // The DELETE on the SAME path is mocked too — not to test removal, but
        // so "did the PATCH swallow the DELETE (or vice versa)?" has a real
        // answer. Left unmocked, the delete handler reaches the globally-mocked
        // `@repo/db` and answers 404 for a row that does not exist, which is
        // indistinguishable from "the route was never registered".
        removePostMedia: mockRemovePost,
        removeEventMedia: mockRemoveEvent,
        removeGastronomyMedia: mockRemoveGastronomy,
        removeExperienceMedia: mockRemoveExperience
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

const ENTITY_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-01-15T12:00:00.000Z');

/** The full four-field body — every case that asserts forwarding uses this. */
const FULL_BODY = {
    caption: 'Atardecer en el muelle',
    description: 'El muelle viejo visto desde la costanera',
    alt: 'Muelle de madera sobre el río al atardecer',
    attribution: { photographer: 'Estudio Paraná' }
} as const;

interface RouteCase {
    readonly name: string;
    readonly tier: 'protected' | 'admin';
    readonly segment: string;
    readonly fk: string;
    readonly mock: ReturnType<typeof vi.fn>;
    /** The remove helper reachable at the SAME path, one HTTP method away. */
    readonly removeMock: ReturnType<typeof vi.fn>;
    readonly permissions: readonly string[];
    readonly role: string;
}

const CASES: readonly RouteCase[] = [
    {
        name: 'protected post',
        tier: 'protected',
        segment: 'posts',
        fk: 'postId',
        mock: mockUpdatePost,
        removeMock: mockRemovePost,
        permissions: [PermissionEnum.POST_UPDATE_OWN],
        role: 'USER'
    },
    {
        name: 'admin post',
        tier: 'admin',
        segment: 'posts',
        fk: 'postId',
        mock: mockUpdatePost,
        removeMock: mockRemovePost,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.POST_UPDATE],
        role: 'ADMIN'
    },
    {
        name: 'protected event',
        tier: 'protected',
        segment: 'events',
        fk: 'eventId',
        mock: mockUpdateEvent,
        removeMock: mockRemoveEvent,
        permissions: [PermissionEnum.EVENT_UPDATE_OWN],
        role: 'USER'
    },
    {
        name: 'admin event',
        tier: 'admin',
        segment: 'events',
        fk: 'eventId',
        mock: mockUpdateEvent,
        removeMock: mockRemoveEvent,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.EVENT_UPDATE],
        role: 'ADMIN'
    },
    {
        name: 'protected gastronomy',
        tier: 'protected',
        segment: 'gastronomies',
        fk: 'gastronomyId',
        mock: mockUpdateGastronomy,
        removeMock: mockRemoveGastronomy,
        permissions: [PermissionEnum.COMMERCE_EDIT_OWN],
        role: 'COMMERCE_OWNER'
    },
    {
        name: 'admin gastronomy',
        tier: 'admin',
        segment: 'gastronomies',
        fk: 'gastronomyId',
        mock: mockUpdateGastronomy,
        removeMock: mockRemoveGastronomy,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.GASTRONOMY_EDIT_ALL],
        role: 'ADMIN'
    },
    {
        name: 'protected experience',
        tier: 'protected',
        segment: 'experiences',
        fk: 'experienceId',
        mock: mockUpdateExperience,
        removeMock: mockRemoveExperience,
        permissions: [PermissionEnum.COMMERCE_EDIT_OWN],
        role: 'COMMERCE_OWNER'
    },
    {
        name: 'admin experience',
        tier: 'admin',
        segment: 'experiences',
        fk: 'experienceId',
        mock: mockUpdateExperience,
        removeMock: mockRemoveExperience,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.EXPERIENCE_EDIT_ALL],
        role: 'ADMIN'
    }
];

/** Build the media row the mocked service resolves with, per entity. */
function mediaRow(fk: string) {
    return {
        id: MEDIA_ID,
        [fk]: ENTITY_ID,
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'hospeda/dev/sample',
        caption: FULL_BODY.caption,
        description: FULL_BODY.description,
        alt: FULL_BODY.alt,
        attribution: FULL_BODY.attribution,
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible' as const,
        isFeatured: false,
        sortOrder: 0,
        archivedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null
    };
}

function headers(c: RouteCase): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': c.role,
        'x-mock-actor-permissions': JSON.stringify(c.permissions)
    };
}

function url(c: RouteCase, mediaId: string = MEDIA_ID): string {
    return `/api/v1/${c.tier}/${c.segment}/${ENTITY_ID}/media/${mediaId}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH media text metadata (HOS-1036)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        for (const c of CASES) {
            c.mock.mockResolvedValue({ data: { media: mediaRow(c.fk) }, error: undefined });
            c.removeMock.mockResolvedValue({ data: { success: true }, error: undefined });
        }
    });

    describe.each(CASES)('$name', (c) => {
        it('is wired into its tier barrel — the PATCH path does not 404', async () => {
            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({ alt: 'Texto nuevo' })
            });

            // An unregistered route file answers 404 even with a valid body.
            expect(res.status).not.toBe(404);
        });

        it('forwards ALL four text fields, exactly and with nothing extra', async () => {
            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify(FULL_BODY)
            });

            expect(res.status).toBe(200);
            expect(c.mock).toHaveBeenCalledTimes(1);
            // ...and the PATCH did not fall through to the remove handler that
            // shares this exact path.
            expect(c.removeMock).not.toHaveBeenCalled();
            // toEqual, never objectContaining: the latter stays green when the
            // handler silently drops `alt`.
            expect(c.mock.mock.calls[0]?.[2]).toEqual({
                [c.fk]: ENTITY_ID,
                mediaId: MEDIA_ID,
                caption: FULL_BODY.caption,
                description: FULL_BODY.description,
                alt: FULL_BODY.alt,
                attribution: FULL_BODY.attribution
            });
        });

        it('forwards an explicit null instead of dropping it', async () => {
            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({ caption: null, alt: 'Sigue igual' })
            });

            expect(res.status).toBe(200);
            const forwarded = c.mock.mock.calls[0]?.[2] as Record<string, unknown>;
            // `null` means CLEAR. A truthiness-guarded forward turns it into
            // "leave unchanged", which is the half of the feature that fixes a
            // mistake rather than making one.
            expect(forwarded.caption).toBeNull();
            expect(forwarded.alt).toBe('Sigue igual');
        });

        it('answers 404 (never 403, never INTERNAL_ERROR) for a foreign media row', async () => {
            c.mock.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Media not found for this entity'
                }
            });

            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({ alt: 'Texto nuevo' })
            });

            expect(res.status).toBe(404);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('INTERNAL_ERROR');
        });

        it('rejects a non-UUID mediaId before reaching the service', async () => {
            const res = await app.request(url(c, 'not-a-uuid'), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({ alt: 'Texto nuevo' })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
            expect(c.mock).not.toHaveBeenCalled();
        });

        it('rejects an alt over 200 chars before reaching the service', async () => {
            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({ alt: 'x'.repeat(201) })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
            expect(c.mock).not.toHaveBeenCalled();
        });

        it('does not accept url or isFeatured through the body', async () => {
            const res = await app.request(url(c), {
                method: 'PATCH',
                headers: headers(c),
                body: JSON.stringify({
                    alt: 'Texto nuevo',
                    url: 'https://evil.example.com/other.jpg',
                    isFeatured: true,
                    sortOrder: 99
                })
            });

            expect(res.status).toBe(200);
            const forwarded = c.mock.mock.calls[0]?.[2] as Record<string, unknown>;
            expect(forwarded).not.toHaveProperty('url');
            expect(forwarded).not.toHaveProperty('isFeatured');
            expect(forwarded).not.toHaveProperty('sortOrder');
        });

        it('does not shadow the DELETE that shares its path shape', async () => {
            const res = await app.request(url(c), {
                method: 'DELETE',
                headers: headers(c)
            });

            // Same path, different method. Registering the PATCH must leave the
            // DELETE resolving to the REMOVE helper, and the PATCH itself must
            // not have been reached.
            expect(res.status).toBe(200);
            expect(c.removeMock).toHaveBeenCalledTimes(1);
            expect(c.mock).not.toHaveBeenCalled();
        });
    });
});
