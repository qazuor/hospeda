/**
 * @fileoverview Host reply to a review (HOS-2199): route wiring.
 *
 * Two layers. A static guard over the route source pins the authorization
 * declaration (a mutation that drops the entitlement key or changes the
 * operation would otherwise leave every runtime test green, because
 * `test/setup.ts` mocks `@repo/db` wholesale). A runtime check proves the
 * routes are registered and refuse a guest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const replySource = readFileSync(
    resolve(import.meta.dirname, '../../src/routes/accommodation/reviews/protected/reply.ts'),
    'utf8'
);

describe('reply routes: authorization declaration', () => {
    it('declares the respond_reviews entitlement at step 6 through a single shared listingAccess', () => {
        expect(replySource).toContain("const RESPOND_REVIEWS_KEY = 'respond_reviews'");
        expect(replySource).toContain('step6Key: RESPOND_REVIEWS_KEY');
        expect(replySource).toContain("operation: 'READ_OWN_COMMERCIAL'");
        expect(replySource).toContain("idParam: 'accommodationId'");
    });

    it('wires listingAccess on all three write routes', () => {
        const routes = replySource.split('createProtectedRoute(').slice(1);
        expect(routes).toHaveLength(3);
        for (const block of routes) {
            expect(block).toContain('listingAccess,');
        }
    });

    it('passes the URL accommodation id to the service so a foreign review answers 404', () => {
        expect(replySource.match(/accommodationId, reviewId/g)?.length).toBeGreaterThanOrEqual(3);
    });
});

describe('reply routes: runtime registration', () => {
    let app: AppOpenAPI;
    const A = '11111111-1111-4111-8111-111111111111';
    const R = '22222222-2222-4222-8222-222222222222';
    const url = `/api/v1/protected/accommodations/${A}/reviews/${R}/reply`;

    beforeAll(() => {
        app = initApp();
    });

    it.each(['POST', 'PATCH', 'DELETE'])('%s is registered and refuses a guest', async (method) => {
        const res = await app.request(url, {
            method,
            headers: {
                'user-agent': 'vitest',
                accept: 'application/json',
                'content-type': 'application/json'
            },
            body: method === 'DELETE' ? undefined : JSON.stringify({ content: 'Gracias!' })
        });

        expect(res.status).not.toBe(404);
        expect([401, 403]).toContain(res.status);
    });

    it('the received-reviews list refuses a guest', async () => {
        const res = await app.request('/api/v1/protected/users/me/received-reviews', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect([401, 403]).toContain(res.status);
    });

    it('the admin moderation route refuses a guest', async () => {
        const res = await app.request(
            `/api/v1/admin/accommodations/reviews/replies/${R}/moderate`,
            {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ decision: 'REJECTED' })
            }
        );

        expect([401, 403]).toContain(res.status);
    });
});
