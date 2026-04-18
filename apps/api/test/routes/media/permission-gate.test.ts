/**
 * Tests for admin media permission gates (SPEC-078 / GAP-078-053 + 164).
 *
 * Covers two defensive layers:
 *   1. Route-level `requiredPermissions: [MEDIA_UPLOAD/MEDIA_DELETE]` enforced
 *      by the admin route factory before the handler runs.
 *   2. Entity-specific permission validation inside the handler, via the
 *      `validateEntityMediaPermission` helper.
 *
 * The helper is tested exhaustively because it holds the OWN/ANY branching
 * logic. The route-level gate is verified via smoke requests with mock actors
 * holding different permission sets.
 *
 * @module test/routes/media/permission-gate
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import {
    type MediaEntityType,
    validateEntityMediaPermission
} from '../../../src/routes/media/admin/permissions';
import type { AppOpenAPI } from '../../../src/types';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

const makeActor = (permissions: PermissionEnum[], id = crypto.randomUUID()): Actor => ({
    id,
    role: RoleEnum.ADMIN,
    permissions
});

describe('validateEntityMediaPermission (unit)', () => {
    describe('accommodation — split OWN/ANY', () => {
        it('allows actor with UPDATE_ANY regardless of ownership', () => {
            const actor = makeActor([PermissionEnum.ACCOMMODATION_UPDATE_ANY]);
            const result = validateEntityMediaPermission({
                actor,
                entityType: 'accommodation',
                entity: { ownerId: 'some-other-user' }
            });
            expect(result).toEqual({ allowed: true });
        });

        it('allows actor with UPDATE_OWN when they are the owner', () => {
            const actor = makeActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], 'owner-1');
            const result = validateEntityMediaPermission({
                actor,
                entityType: 'accommodation',
                entity: { ownerId: 'owner-1' }
            });
            expect(result).toEqual({ allowed: true });
        });

        it('rejects actor with UPDATE_OWN when they are NOT the owner', () => {
            const actor = makeActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], 'owner-1');
            const result = validateEntityMediaPermission({
                actor,
                entityType: 'accommodation',
                entity: { ownerId: 'someone-else' }
            });
            expect(result).toEqual({ allowed: false, reason: 'NOT_ENTITY_OWNER' });
        });

        it('rejects actor with no accommodation update permission', () => {
            const actor = makeActor([PermissionEnum.MEDIA_UPLOAD]);
            const result = validateEntityMediaPermission({
                actor,
                entityType: 'accommodation',
                entity: { ownerId: 'any' }
            });
            expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
        });
    });

    describe.each(['destination', 'event', 'post'] as const)(
        '%s — single flat permission',
        (entityType) => {
            const permMap: Record<Exclude<MediaEntityType, 'accommodation'>, PermissionEnum> = {
                destination: PermissionEnum.DESTINATION_UPDATE,
                event: PermissionEnum.EVENT_UPDATE,
                post: PermissionEnum.POST_UPDATE
            };

            it('allows actor with the flat UPDATE permission (no ownership check)', () => {
                const actor = makeActor([permMap[entityType]]);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { ownerId: 'not-the-actor' }
                });
                expect(result).toEqual({ allowed: true });
            });

            it('rejects actor without the UPDATE permission', () => {
                const actor = makeActor([PermissionEnum.MEDIA_UPLOAD]);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: null
                });
                expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
            });
        }
    );
});

describe('Admin media routes — route-level permission gate (smoke)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    describe('POST /api/v1/admin/media/upload', () => {
        it('rejects actor without MEDIA_UPLOAD with 403', async () => {
            const actor = createMockAdminActor({
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN]
            });
            const res = await app.request('/api/v1/admin/media/upload', {
                method: 'POST',
                ...createAuthenticatedRequest(actor, {
                    'content-type': 'multipart/form-data; boundary=----x'
                })
            });
            expect(res.status).toBe(403);
        });

        it('passes the route gate when MEDIA_UPLOAD is present (handler-level outcomes apply)', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD
                ]
            });
            const res = await app.request('/api/v1/admin/media/upload', {
                method: 'POST',
                ...createAuthenticatedRequest(actor, {
                    'content-type': 'multipart/form-data; boundary=----x'
                })
            });
            // Route gate passes; subsequent layers (provider absent / multipart invalid)
            // may return 400/422/503. Critically, NOT 403 from the gate.
            expect(res.status).not.toBe(403);
            expect([400, 422, 503]).toContain(res.status);
        });
    });

    describe('DELETE /api/v1/admin/media', () => {
        it('rejects actor without MEDIA_DELETE with 403', async () => {
            const actor = createMockAdminActor({
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN]
            });
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/test/accommodations/id-1/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            expect(res.status).toBe(403);
        });

        it('passes the route gate when MEDIA_DELETE is present', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_DELETE
                ]
            });
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/test/accommodations/id-1/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            // Handler-level outcomes apply (entity lookup fails, provider absent).
            // Critically, NOT 403 from the route gate.
            expect(res.status).not.toBe(403);
            expect([400, 404, 422, 503]).toContain(res.status);
        });
    });
});
