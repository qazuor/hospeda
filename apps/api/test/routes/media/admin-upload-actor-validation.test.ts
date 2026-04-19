/**
 * Tests for admin media upload actor.id and session re-verify defenses.
 *
 * Covers SPEC-078-GAPS T-008:
 *   - GAP-078-058 + GAP-078-175: actor.id MUST be a valid UUID before being
 *     used as a publicId/storage path component. A non-UUID actor.id MUST
 *     yield a sanitized HTTP 500 that does NOT leak the actor.id value.
 *   - GAP-078-114: Right before the provider.upload() call, the route MUST
 *     re-verify that actor.id still matches the user resolved into the Hono
 *     context by authMiddleware. A stale session (user.id != actor.id) MUST
 *     yield HTTP 401.
 *
 * Notes on the test environment:
 *   - In test mode, `actorMiddleware` reads `x-mock-actor-id` and creates an
 *     Actor with that exact id (no UUID normalization). This lets us inject
 *     a non-UUID actor.id straight through to the handler.
 *   - In test mode, `authMiddleware` reads the `Authorization: Bearer <token>`
 *     header. If the token is well-formed and not in the invalid-token set,
 *     it sets `user.id = MOCK_USER_ID` ('00000000-0000-4000-8000-000000000099')
 *     and a matching session into context.
 *   - This means we can independently set:
 *       actor.id  via x-mock-actor-id header
 *       user.id   via Authorization: Bearer header
 *     and observe the route's behavior when they disagree.
 *
 * @module test/routes/media/admin-upload-actor-validation
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

// Mock the media provider so it APPEARS configured even though no Cloudinary
// credentials exist in the test env. The provider's `upload` should never
// actually be reached in these tests because the new gates short-circuit
// the request first; we still stub it as a defensive no-op.
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: vi.fn(async () => ({
            url: 'https://res.cloudinary.com/test/image/upload/v1/test.png',
            publicId: 'test/test',
            width: 100,
            height: 100
        })),
        delete: vi.fn(async () => ({ result: 'ok' }))
    })
}));

import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000099';
const VALID_BEARER = 'Bearer test-session-token';

/**
 * Build a multipart FormData body for the upload endpoint.
 *
 * The route never reaches file validation in these tests because it
 * short-circuits earlier (500 for non-UUID actor or 401 for stale session).
 * For the happy-path test we accept any outcome that is NOT 401 and NOT our
 * sanitized 500, which is enough to prove the new gates do not regress.
 */
const buildMultipartBody = (): FormData => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', '00000000-0000-4000-8000-0000000000aa');
    fd.append('role', 'featured');
    fd.append(
        'file',
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'test.png', {
            type: 'image/png'
        })
    );
    return fd;
};

/**
 * Build the auth headers for a multipart request.
 *
 * Mock-actor headers MUST flow through, but we MUST NOT set content-type
 * here so the runtime infers the correct multipart boundary from the
 * FormData body itself.
 */
const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor>,
    extra: Record<string, string> = {}
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor, extra);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

describe('Admin media upload — actor.id UUID validation (GAP-078-058 + 175)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('returns sanitized 500 when actor.id is not a UUID and does not leak the value', async () => {
        // Arrange: actor with a non-UUID id, but with MEDIA_UPLOAD permission
        // so the route-level permission gate passes and the handler runs.
        const badActor = createMockAdminActor({
            id: 'not-a-uuid',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.MEDIA_UPLOAD
            ]
        });

        // Act: include the mock-actor headers (no content-type override or
        // accept: application/json — the validation middleware would reject
        // multipart in that case).
        const res = await app.request('/api/v1/admin/media/upload', {
            method: 'POST',
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-id': badActor.id,
                'x-mock-actor-role': badActor.role,
                'x-mock-actor-permissions': JSON.stringify(badActor.permissions)
            },
            body: buildMultipartBody()
        });

        // Assert
        expect(res.status).toBe(500);
        const payload = await res.json();
        expect(payload.success).toBe(false);
        // Sanitized: must NOT echo the offending actor.id anywhere.
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain('not-a-uuid');
    });
});

describe('Admin media upload — session re-verify before provider call (GAP-078-114)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('returns 401 SESSION_STALE when context user.id no longer matches actor.id', async () => {
        // Arrange: a Bearer token causes authMiddleware to set user.id =
        // MOCK_USER_ID into context. We then inject a *different* UUID via
        // x-mock-actor-id so actor.id != user.id at the time of provider.upload.
        const staleActorId = '11111111-2222-4333-8444-555555555555';
        expect(staleActorId).not.toBe(MOCK_USER_ID);
        const actor = createMockAdminActor({
            id: staleActorId,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.MEDIA_UPLOAD
            ]
        });

        // Act: include both Bearer (sets user) and mock-actor-id (sets actor).
        const res = await app.request('/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor, { authorization: VALID_BEARER }),
            body: buildMultipartBody()
        });

        // Assert
        expect(res.status).toBe(401);
        const payload = await res.json();
        expect(payload.success).toBe(false);
        expect(payload.error?.code).toBe('SESSION_STALE');
    });

    it('does not bail at the session gate when no session is present in context (mock actor only)', async () => {
        // Arrange: no Bearer header, so authMiddleware does NOT set user.
        // actorMiddleware sets actor from the mock header. Without a session
        // in context the route MUST proceed past the re-verify gate.
        const actor = createMockAdminActor({
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.MEDIA_UPLOAD
            ]
        });

        // Act
        const res = await app.request('/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody()
        });

        // Assert: the request should not be blocked by the new gates.
        // Cloudinary is not configured in tests (503), the entity does not
        // exist (404), file validation may fire (400/422), but it must NOT
        // be 401 (session gate) and must NOT be the sanitized 500 from the
        // actor.id UUID check.
        expect(res.status).not.toBe(401);
        const payload = await res.json();
        // If status is 500, ensure it is not from our new sanitized branch.
        if (res.status === 500) {
            expect(payload.error?.code).not.toBe('INTERNAL_ERROR');
        }
    });
});
