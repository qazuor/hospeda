/**
 * Tests for PATCH /api/v1/admin/accommodations/:id/media/:mediaId
 * Correct photo text metadata — Admin endpoint (HOS-388)
 *
 * The admin twin of the protected route that shipped first. What is worth
 * asserting HERE, rather than re-testing the service:
 *
 * - The route is actually REGISTERED, and does not collide with the DELETE that
 *   shares its path shape. A route file that exists but was never wired into
 *   the admin barrel is the classic way this kind of work looks done and 404s.
 * - It forwards all four text fields, `null` included — `null` is the caller's
 *   "clear this" signal and is the half of "correct it" that a naive
 *   `if (value)` forward silently drops.
 * - It carries NO entitlement gate, unlike the protected twin.
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed.
 *
 * @module test/routes/accommodation-admin-update-media
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModerationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockUpdateMedia } = vi.hoisted(() => ({
    mockUpdateMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                updateMedia: mockUpdateMedia
            };
        })
    };
});

const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: ['SUPER_ADMIN'],
    permissions: ['accommodation.update.any', 'access.panelAdmin']
};
vi.mock('../../src/utils/actor.js', () => ({
    getActorFromContext: () => mockActor
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = '00000000-0000-0000-0000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/admin/accommodations/${ACCOMMODATION_ID}/media/${MEDIA_ID}`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const MEDIA_ROW = {
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    publicId: 'hospeda/dev/sample',
    caption: 'Vista al mar',
    alt: 'Foto corregida por el staff',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

/**
 * `user-agent` is NOT decorative: `validationConfig.requiredHeaders` defaults to
 * `['user-agent']`, so omitting it makes every request 400 with
 * MISSING_REQUIRED_HEADER before the handler is ever reached — which is what a
 * happy-path assertion guarded by `if (res.status === 200)` quietly swallows.
 */
const ADMIN_HEADERS = {
    Authorization: 'Bearer test-admin-token',
    'Content-Type': 'application/json',
    'User-Agent': 'vitest'
} as const;

function patch(body: unknown) {
    return {
        method: 'PATCH',
        headers: ADMIN_HEADERS,
        body: JSON.stringify(body)
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/admin/accommodations/:id/media/:mediaId — updateMedia (HOS-388)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockUpdateMedia.mockResolvedValue({
            data: { media: MEDIA_ROW },
            error: undefined
        });
    });

    describe('Route registration', () => {
        it('is wired into the admin barrel — the path does not 404', async () => {
            const res = await app.request(BASE_URL, patch({ alt: 'Texto nuevo' }));

            // A file that exists but was never registered answers 404 here even
            // with a perfectly valid body. Anything else means it is mounted.
            expect(res.status).not.toBe(404);
        });

        it('does not swallow the DELETE that shares its path shape', async () => {
            // PATCH and DELETE differ only by method on this path; registering
            // one must not shadow the other.
            const res = await app.request(BASE_URL, {
                method: 'DELETE',
                headers: ADMIN_HEADERS
            });

            expect(res.status).not.toBe(404);
        });
    });

    describe('Authentication', () => {
        it('rejects a request with no Authorization header', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'vitest' },
                body: JSON.stringify({ alt: 'Texto nuevo' })
            });

            // Asserts the property that matters — the request is NOT served —
            // rather than a specific code. In this harness the auth failure
            // surfaces as 500 rather than 401/403; that is worth a look on its
            // own, but pinning 500 here would enshrine it, and pinning
            // [400,401,403] passed before only because a MISSING_REQUIRED_HEADER
            // 400 was being returned before auth ever ran.
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('Parity with the protected twin', () => {
        // The happy path is NOT asserted here, deliberately. `initApp()` runs
        // the real admin auth middleware, which cannot authenticate a synthetic
        // bearer token, so every request in this harness stops before the
        // handler. The three sibling admin media route tests
        // (setFeaturedMedia / removeMedia / archiveMedia) hide exactly that
        // behind `if (res.status === 200)`, so their happy-path assertions have
        // never actually executed. Repeating the trick here would buy a green
        // that means nothing.
        //
        // What IS worth pinning, and does not need a session, is that the two
        // tiers stay in sync: the drift that would actually hurt is one tier
        // gaining or losing a forwarded field. Behavior itself is covered where
        // it can really run — `updateMedia.test.ts` in service-core asserts the
        // resulting DB write.
        const TEXT_FIELDS = ['caption', 'description', 'alt', 'attribution'] as const;

        const adminSource = readFileSync(
            resolve(__dirname, '../../src/routes/accommodation/admin/updateMedia.ts'),
            'utf8'
        );
        const protectedSource = readFileSync(
            resolve(__dirname, '../../src/routes/accommodation/protected/updateMedia.ts'),
            'utf8'
        );

        it.each(TEXT_FIELDS)('the admin route forwards %s', (field) => {
            expect(adminSource).toContain(`${field}: payload.${field}`);
        });

        it.each(TEXT_FIELDS)('the protected route forwards %s', (field) => {
            expect(protectedSource).toContain(`${field}: payload.${field}`);
        });

        it('both tiers call the same service method', () => {
            // If one tier ever grows its own write path, the shared rules —
            // which columns are reachable, what null means, 404-not-403 — stop
            // being shared.
            expect(adminSource).toContain('accommodationService.updateMedia(');
            expect(protectedSource).toContain('accommodationService.updateMedia(');
        });

        it('only the protected tier carries the billing entitlement gate', () => {
            // Staff bypass entitlements (INV-6), so the gate would be dead
            // weight on the admin path — and a moderator correcting misleading
            // alt text is not exercising a billable feature.
            expect(protectedSource).toContain('EDIT_ACCOMMODATION_INFO');
            expect(adminSource).not.toContain('requireEntitlement');
        });
    });
});
