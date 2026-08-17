/**
 * Regression tests for H-165 — three admin billing routes answered 403 to an
 * anonymous caller where every sibling answers 401.
 *
 * Measured against production without a session: `/admin/posts`,
 * `/admin/accommodations`, `/admin/events` and `/admin/destinations` all
 * answered `401 UNAUTHORIZED`; `/admin/billing/subscriptions`,
 * `/admin/billing/payments` and `/admin/billing/customers` answered
 * `403 FORBIDDEN`. `/admin/billing/plans` answered 401 — same prefix, so no
 * explanation blaming the mount as a whole survives that fourth route.
 *
 * The cause the finding could not determine from outside: this middleware
 * tested `!actor?.id`, and the guest actor carries a real UUID
 * (`00000000-0000-4000-8000-000000000000`), so the check never fired and an
 * anonymous request fell through to the `BILLING_READ_ALL` test below it.
 * `/plans` escaped because it is served by `createAdminListRoute`, whose native
 * guard asks `isGuestActor`.
 *
 * Nothing leaked either way — this is about which of the two codes is chosen,
 * not about whether the gate holds. But the codes ask the client for different
 * things: 401 sends an administrator whose session expired back to the login
 * screen, 403 tells them they lack permissions they actually have.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingAdminAuthMiddleware } from '../../src/middlewares/billing-admin-auth.middleware';

vi.mock('../../src/utils/logger');

/**
 * The guest actor's real id, copied from `utils/actor.ts`.
 *
 * Written as a literal on purpose: importing the factory would make this test
 * agree with whatever the source says, and the whole finding is that the guest
 * actor HAS an id. A literal is what keeps `!actor?.id` measurably wrong.
 */
const GUEST_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

const guestActor = (): Actor => ({
    id: GUEST_ACTOR_ID,
    roles: [RoleEnum.GUEST],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC]
});

const signedInActor = (permissions: PermissionEnum[] = []): Actor => ({
    id: '44444444-4444-4444-8444-444444444444',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, ...permissions]
});

let currentActor: Actor = guestActor();

vi.mock('../../src/utils/actor', async () => {
    const real =
        await vi.importActual<typeof import('../../src/utils/actor')>('../../src/utils/actor');
    return {
        ...real,
        // `isGuestActor` stays REAL — it is the predicate under test.
        getActorFromContext: () => currentActor
    };
});

const createApp = (): Hono => {
    const app = new Hono();
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return c.json({ message: err.message }, err.status);
        }
        return c.json({ message: 'Internal server error' }, 500);
    });
    app.use('*', billingAdminAuthMiddleware);
    app.get('/subscriptions', (c) => c.json({ ok: true }));
    app.get('/payments', (c) => c.json({ ok: true }));
    app.get('/customers', (c) => c.json({ ok: true }));
    app.get('/plans', (c) => c.json({ ok: true }));
    app.post('/subscriptions/abc/cancel', (c) => c.json({ ok: true }));
    app.post('/payments/abc/refund', (c) => c.json({ ok: true }));
    return app;
};

describe('billingAdminAuthMiddleware — 401 before 403', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createApp();
    });

    describe('anonymous callers', () => {
        beforeEach(() => {
            currentActor = guestActor();
        });

        it.each([
            '/subscriptions',
            '/payments',
            '/customers',
            '/plans'
        ])('answers 401 on %s, matching every sibling admin route', async (path) => {
            const res = await app.request(path);

            expect(res.status).toBe(401);
        });

        it('never answers 403 to a caller it has not identified', async () => {
            for (const path of ['/subscriptions', '/payments', '/customers']) {
                expect((await app.request(path)).status).not.toBe(403);
            }
        });

        it('answers 401 on write paths too, before any permission is considered', async () => {
            const cancel = await app.request('/subscriptions/abc/cancel', { method: 'POST' });
            const refund = await app.request('/payments/abc/refund', { method: 'POST' });

            expect(cancel.status).toBe(401);
            expect(refund.status).toBe(401);
        });
    });

    describe('identified callers keep getting 403', () => {
        it('answers 403 when signed in without BILLING_READ_ALL', async () => {
            currentActor = signedInActor();

            const res = await app.request('/subscriptions');

            // The gate itself is not being loosened: an actor we DID identify
            // and who lacks the permission still gets 403. Only the anonymous
            // case changes.
            expect(res.status).toBe(403);
        });

        it('lets a reader through', async () => {
            currentActor = signedInActor([PermissionEnum.BILLING_READ_ALL]);

            expect((await app.request('/subscriptions')).status).toBe(200);
        });

        it('still requires MANAGE_SUBSCRIPTIONS to cancel', async () => {
            currentActor = signedInActor([PermissionEnum.BILLING_READ_ALL]);

            const res = await app.request('/subscriptions/abc/cancel', { method: 'POST' });

            expect(res.status).toBe(403);
        });

        it('still requires BILLING_MANAGE to refund', async () => {
            currentActor = signedInActor([PermissionEnum.BILLING_READ_ALL]);

            const res = await app.request('/payments/abc/refund', { method: 'POST' });

            expect(res.status).toBe(403);
        });

        it('allows a refund once BILLING_MANAGE is present', async () => {
            currentActor = signedInActor([
                PermissionEnum.BILLING_READ_ALL,
                PermissionEnum.BILLING_MANAGE
            ]);

            const res = await app.request('/payments/abc/refund', { method: 'POST' });

            expect(res.status).toBe(200);
        });
    });
});
