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
            const ownerId = crypto.randomUUID();
            const actor = makeActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], ownerId);
            const result = validateEntityMediaPermission({
                actor,
                entityType: 'accommodation',
                entity: { ownerId }
            });
            expect(result).toEqual({ allowed: true });
        });

        it('rejects actor with UPDATE_OWN when they are NOT the owner', () => {
            const ownerId = crypto.randomUUID();
            const actor = makeActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], ownerId);
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
            const permMap: Record<'destination' | 'event' | 'post', PermissionEnum> = {
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

/**
 * SPEC-078-GAPS T-005 — security hardening for DELETE /admin/media.
 *
 * Covers:
 *   - GAP-078-035: env-prefix validation via `resolveEnvironment()` returns 403
 *     when `publicId` does not target the current environment.
 *   - GAP-078-034 + GAP-078-173: schema-level path-traversal rejection (raw `..`
 *     and URL-encoded `%2E%2E`) surfaces as HTTP 422.
 *
 * The runtime environment under Vitest is `'test'` (NODE_ENV=test), so
 * `resolveEnvironment()` yields `'test'`. All test paths use
 * either `hospeda/test/...` (allowed prefix) or `hospeda/prod/...` (forbidden).
 */
describe('DELETE /api/v1/admin/media — security hardening (T-005)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    const adminWithDelete = () =>
        createMockAdminActor({
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.MEDIA_DELETE
            ]
        });

    describe('GAP-078-035 — env prefix enforcement', () => {
        it('returns 403 when publicId targets a different environment (prod from test)', async () => {
            // Arrange
            const actor = adminWithDelete();

            // Act
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/prod/accommodations/id-1/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );

            // Assert
            expect(res.status).toBe(403);
            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('does NOT return 403 (env reason) when publicId matches the current env', async () => {
            // Arrange
            const actor = adminWithDelete();

            // Act
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/test/accommodations/id-1/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );

            // Assert: env check passes; downstream lookup/permission/provider
            // layers may still surface other statuses, but none must be 403
            // *with reason FORBIDDEN-from-env*. We accept the same set as the
            // permission-gate happy path.
            expect([400, 403, 404, 422, 503]).toContain(res.status);
            if (res.status === 403) {
                const body = (await res.json()) as { error: { message: string } };
                // If 403, it must be from the entity-permission layer, not env.
                expect(body.error.message).not.toContain('in this environment');
            }
        });
    });

    describe('GAP-078-034 + GAP-078-173 — path traversal rejection', () => {
        it('returns 422 for raw ".." traversal segment', async () => {
            // Arrange
            const actor = adminWithDelete();

            // Act
            const res = await app.request('/api/v1/admin/media?publicId=hospeda/dev/../prod/x', {
                method: 'DELETE',
                ...createAuthenticatedRequest(actor)
            });

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
        });

        it('returns 422 for URL-encoded ".." (%2E%2E) traversal segment', async () => {
            // Arrange
            const actor = adminWithDelete();

            // Act
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/dev/%2E%2E/prod/x',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
        });
    });
});

// ============================================================================
// Commerce media permissions (SPEC-249 T-015b) — split OWN/ANY
// ============================================================================

describe('validateEntityMediaPermission — commerce verticals', () => {
    for (const entityType of [
        'gastronomy',
        'experience'
    ] as const satisfies readonly MediaEntityType[]) {
        describe(entityType, () => {
            it('allows actor with COMMERCE_EDIT_ALL regardless of ownership', () => {
                const actor = makeActor([PermissionEnum.COMMERCE_EDIT_ALL]);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { ownerId: 'some-other-user' }
                });
                expect(result).toEqual({ allowed: true });
            });

            it('allows owner with COMMERCE_EDIT_OWN', () => {
                // SPEC-253 D2=b: COMMERCE_MEDIA_EDIT_OWN replaced by COMMERCE_EDIT_OWN
                const ownerId = crypto.randomUUID();
                const actor = makeActor([PermissionEnum.COMMERCE_EDIT_OWN], ownerId);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { ownerId }
                });
                expect(result).toEqual({ allowed: true });
            });

            it('rejects COMMERCE_EDIT_OWN actor who is NOT the owner', () => {
                const actor = makeActor([PermissionEnum.COMMERCE_EDIT_OWN], crypto.randomUUID());
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { ownerId: 'someone-else' }
                });
                expect(result).toEqual({ allowed: false, reason: 'NOT_ENTITY_OWNER' });
            });

            it('rejects actor with no commerce media permission', () => {
                const actor = makeActor([PermissionEnum.MEDIA_UPLOAD]);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { ownerId: 'any' }
                });
                expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
            });
        });
    }
});
