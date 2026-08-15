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
    roles: [RoleEnum.ADMIN],
    permissions
});

/**
 * The one accommodation id the mocked `AccommodationService.getById`
 * (`test/helpers/mocks/accommodation-services.ts`) reports as missing. Every
 * other id resolves to a mock row owned by somebody else.
 *
 * The delete route smoke below depends on that: it asserts the ROUTE-level
 * gate lets a MEDIA_DELETE holder through, and any id that resolves would then
 * hit the handler's entity-ownership check and answer 403 for a different and
 * entirely correct reason — making the assertion unable to tell the two apart.
 * That is not hypothetical: the test used a resolving id and only passed while
 * CI had no Cloudinary credentials, so the request short-circuited at the
 * provider check with 503. Adding the `HOSPEDA_CLOUDINARY_*` secrets on
 * 2026-08-15 15:26 UTC let the request reach the ownership check and turned
 * this into a red on every branch.
 */
const MISSING_ACCOMMODATION_ID = '87654321-4321-4321-8765-876543218765';

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

    describe.each([
        'destination',
        'event',
        'post'
    ] as const)('%s — single flat permission', (entityType) => {
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
    });
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
                    PermissionEnum.MEDIA_DELETE,
                    // Carried so the assertion below can only ever be about the
                    // ROUTE gate. Past it sits a second, per-entity gate
                    // (`validateEntityMediaPermission`) that answers 403 for an
                    // accommodation unless the actor holds ACCOMMODATION_UPDATE_*.
                    // Whether the handler reaches that gate depends on the entity
                    // lookup resolving, which depends on mock state a NEIGHBOURING
                    // test file leaves behind — so without this the test passed or
                    // failed according to which files shared its worker.
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            const res = await app.request(
                `/api/v1/admin/media?publicId=hospeda/test/accommodations/${MISSING_ACCOMMODATION_ID}/featured`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            // Route gate passes; the entity lookup then misses, so the handler
            // answers 404 (or 503 when no media provider is configured).
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

/**
 * Regression: post/event media authorization (HOS-374 phase 0).
 *
 * The protected upload route cast every entity to `{ ownerId?: string | null }`
 * and rejected on a falsy value. `post` and `event` carry `authorId`, never
 * `ownerId`, so the check was unconditionally true and the route answered 403 to
 * everyone — the actual author included. `destination` has neither column and
 * failed the same way.
 *
 * The author fallback below is what makes a non-staff author able to manage
 * media on their own content. Staff keep passing on the flat permission alone,
 * so the admin route's behavior is unchanged.
 */
describe('author-owned entities (regression, HOS-374)', () => {
    for (const entityType of ['post', 'event'] as MediaEntityType[]) {
        describe(`${entityType}`, () => {
            it('allows the author without the flat editorial permission', () => {
                const authorId = crypto.randomUUID();
                const actor = makeActor([PermissionEnum.MEDIA_UPLOAD], authorId);
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { authorId }
                });
                expect(result).toEqual({ allowed: true });
            });

            it('rejects a non-author without the flat editorial permission', () => {
                const actor = makeActor([PermissionEnum.MEDIA_UPLOAD], crypto.randomUUID());
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { authorId: crypto.randomUUID() }
                });
                expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
            });

            it('still allows staff holding the flat editorial permission', () => {
                const permission =
                    entityType === 'post'
                        ? PermissionEnum.POST_UPDATE
                        : PermissionEnum.EVENT_UPDATE;
                const actor = makeActor([permission], crypto.randomUUID());
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { authorId: crypto.randomUUID() }
                });
                expect(result).toEqual({ allowed: true });
            });

            it('rejects when the entity carries no author at all', () => {
                const actor = makeActor([PermissionEnum.MEDIA_UPLOAD], crypto.randomUUID());
                const result = validateEntityMediaPermission({
                    actor,
                    entityType,
                    entity: { authorId: null }
                });
                expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
            });
        });
    }

    it('does not grant an author fallback to owner-based entity types', () => {
        // Guards the fallback's scope: passing an authorId that matches must not
        // unlock an entity type whose belonging is expressed by ownerId.
        const actorId = crypto.randomUUID();
        const actor = makeActor([PermissionEnum.MEDIA_UPLOAD], actorId);
        const result = validateEntityMediaPermission({
            actor,
            entityType: 'accommodation',
            entity: { authorId: actorId }
        });
        expect(result).toEqual({ allowed: false, reason: 'MISSING_ENTITY_PERMISSION' });
    });
});
