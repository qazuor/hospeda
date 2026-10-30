/**
 * Regression test for HOS-1929 — protected CRUD routes gate guest actors.
 *
 * These 14 routes were mounted with the raw `createCRUDRoute` under
 * `/api/v1/protected`, which declares no route-level gate. The guest actor
 * carries a REAL UUID (see `apps/api/docs/error-contract.md`), so it reached the
 * service and the answer depended on each service. They now use
 * `createProtectedRoute`, whose gate answers 401 before the handler.
 *
 * Table-driven so that every route is covered by an assertion: a guest gets
 * 401 with the `UNAUTHORIZED` code AND no service helper is invoked. The
 * mounted-route set is frozen by `test/static-guards/route-own-gate-declaration`.
 *
 * @module test/routes/protected-crud-guest-gate
 */

import { PermissionEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const HELPER_NAMES = [
    'getEventMedia',
    'addEventMedia',
    'removeEventMedia',
    'reorderEventMedia',
    'setFeaturedEventMedia',
    'updateEventMedia',
    'getPostMedia',
    'addPostMedia',
    'removePostMedia',
    'reorderPostMedia',
    'setFeaturedPostMedia',
    'updatePostMedia',
    'getExperienceMedia'
] as const;

const { helperMocks } = vi.hoisted(() => ({
    helperMocks: {} as Record<string, ReturnType<typeof vi.fn>>
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    const names = [
        'getEventMedia',
        'addEventMedia',
        'removeEventMedia',
        'reorderEventMedia',
        'setFeaturedEventMedia',
        'updateEventMedia',
        'getPostMedia',
        'addPostMedia',
        'removePostMedia',
        'reorderPostMedia',
        'setFeaturedPostMedia',
        'updatePostMedia',
        'getExperienceMedia'
    ];
    for (const name of names) helperMocks[name] = vi.fn();
    return { ...actual, ...helperMocks };
});

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Guest: no `x-mock-actor-*` headers. `user-agent` is mandatory (else 400). */
const GUEST = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };

const AUTHENTICATED = {
    ...GUEST,
    'x-mock-actor-id': USER_ID,
    'x-mock-actor-role': 'USER',
    'x-mock-actor-permissions': JSON.stringify([PermissionEnum.EVENT_UPDATE_OWN])
};

interface RouteCase {
    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    readonly path: string;
}

const P = '/api/v1/protected';
const ROUTES: readonly RouteCase[] = [
    { method: 'GET', path: `${P}/accommodations/${ID}/media` },
    { method: 'GET', path: `${P}/experiences/${ID}/media` },
    { method: 'GET', path: `${P}/events/${ID}/media` },
    { method: 'POST', path: `${P}/events/${ID}/media` },
    { method: 'PATCH', path: `${P}/events/${ID}/media/reorder` },
    { method: 'PUT', path: `${P}/events/${ID}/media/${MEDIA_ID}/featured` },
    { method: 'PATCH', path: `${P}/events/${ID}/media/${MEDIA_ID}` },
    { method: 'DELETE', path: `${P}/events/${ID}/media/${MEDIA_ID}` },
    { method: 'GET', path: `${P}/posts/${ID}/media` },
    { method: 'POST', path: `${P}/posts/${ID}/media` },
    { method: 'PATCH', path: `${P}/posts/${ID}/media/reorder` },
    { method: 'PUT', path: `${P}/posts/${ID}/media/${MEDIA_ID}/featured` },
    { method: 'PATCH', path: `${P}/posts/${ID}/media/${MEDIA_ID}` },
    { method: 'DELETE', path: `${P}/posts/${ID}/media/${MEDIA_ID}` }
];

describe('HOS-1929 protected CRUD routes reject guest actors', () => {
    let app: AppOpenAPI;
    let adminGetMediaSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        adminGetMediaSpy = vi.spyOn(AccommodationService.prototype, 'adminGetMedia');
        for (const name of HELPER_NAMES) {
            helperMocks[name]?.mockResolvedValue({ data: { media: [] }, error: undefined });
        }
    });

    it.each(ROUTES)('$method $path answers 401 and never reaches a service', async ({
        method,
        path
    }) => {
        const res = await app.request(path, {
            method,
            headers: GUEST,
            body: method === 'GET' || method === 'DELETE' ? undefined : '{}'
        });

        expect(res.status).toBe(401);
        const json = (await res.json()) as { success: boolean; error?: { code?: string } };
        expect(json.success).toBe(false);
        expect(json.error?.code).toBe('UNAUTHORIZED');
        for (const name of HELPER_NAMES) {
            expect(helperMocks[name], name).not.toHaveBeenCalled();
        }
        expect(adminGetMediaSpy).not.toHaveBeenCalled();
    });

    it('an authenticated actor still passes the gate and reaches the service', async () => {
        const res = await app.request(`${P}/events/${ID}/media`, {
            method: 'GET',
            headers: AUTHENTICATED
        });

        expect(res.status).toBe(200);
        expect(helperMocks.getEventMedia).toHaveBeenCalledTimes(1);
    });
});
