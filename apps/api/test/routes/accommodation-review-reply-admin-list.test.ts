/**
 * @fileoverview Admin moderation queue for host replies (HOS-2675): route wiring.
 *
 * Two layers. A static guard over the route source pins the authorization
 * declaration and the literal `/replies` path (a permission that silently
 * changed would otherwise leave every runtime test green, because
 * `test/setup.ts` mocks `@repo/db` wholesale). A runtime check proves the route
 * is registered and refuses a guest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const listRepliesSource = readFileSync(
    resolve(
        import.meta.dirname,
        '../../src/routes/accommodation/reviews/admin/listReviewReplies.ts'
    ),
    'utf8'
);

describe('admin reply moderation queue: authorization declaration', () => {
    it('declares ACCOMMODATION_REVIEW_MODERATE and the literal /replies path', () => {
        expect(listRepliesSource).toContain(
            'requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]'
        );
        expect(listRepliesSource).toContain("path: '/replies'");
    });

    it('reads the queue through the admin service, not the host write service', () => {
        expect(listRepliesSource).toContain('AccommodationReviewReplyAdminService');
        expect(listRepliesSource).not.toContain('AccommodationReviewReplyService,');
    });
});

describe('admin reply moderation queue: runtime registration', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('is registered and refuses a guest', async () => {
        const res = await app.request('/api/v1/admin/accommodations/reviews/replies', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).not.toBe(404);
        expect([401, 403]).toContain(res.status);
    });

    it('is not swallowed by the /:id review route', async () => {
        // A 400 here would mean Hono matched `replies` as a review id; the
        // literal route must be registered first.
        const res = await app.request('/api/v1/admin/accommodations/reviews/replies', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).not.toBe(400);
    });
});
