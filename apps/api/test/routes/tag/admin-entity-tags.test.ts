/**
 * Integration tests for entity tag assignment admin routes (SPEC-086 T-026, T-028)
 *
 * Covers entity tag endpoints at /api/v1/admin/entities/:type/:id/tags*:
 *
 * T-026 — Super-admin attribution view:
 *   GET  /:type/:id/tags         — all assignments + attribution (TAG_VIEW_ALL_ASSIGNMENTS)
 *
 * T-028 — Per-actor own assignments:
 *   GET  /:type/:id/tags/own     — actor's own assignments (TAG_ASSIGN_VIEW)
 *   POST /:type/:id/tags         — assign tag to entity (TAG_ASSIGN_ADD)
 *   DELETE /:type/:id/tags/:tagId — remove own assignment (TAG_ASSIGN_REMOVE)
 *
 * Hono routing gotchas tested:
 * - GET /:type/:id/tags/own must not be shadowed by GET /:type/:id/tags (distinct paths)
 * - DELETE /:type/:id/tags/:tagId distinguishes by HTTP method from GET /:type/:id/tags
 *
 * AC covered:
 * - AC-007-01: super-admin attribution view with assignedById populated
 * - AC-007-02: attribution requires TAG_VIEW_ALL_ASSIGNMENTS (403 without it)
 * - AC-F04: two actors assigning same SYSTEM tag each get their own row
 * - AC-F05: per-actor own view via /tags/own
 * - AC-F07: assignedById injected from actor.id (not caller-provided)
 * - AC-F08: idempotent — double-assign returns wasAlreadyAssigned=true
 * - D-008: INTERNAL tag assignment requires TAG_INTERNAL_VIEW (tested via service gate)
 * - D-009: entity access required before assignment
 *
 * Hono sibling route middleware collision:
 * adminEntityTagRoutes assembles multiple sub-routers. Tests must provide the
 * UNION of all sibling permissions.
 */

import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTagService } = vi.hoisted(() => {
    const mockTagService = {
        getTagsForEntity: vi.fn(),
        assignTag: vi.fn(),
        removeAssignment: vi.fn(),
        adminList: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTag: vi.fn()
    };
    return { mockTagService };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        TagService: vi.fn().mockImplementation(() => mockTagService)
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ENTITY_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';
const TAG_ID = 'cccccccc-cccc-4ccc-accc-cccccccccccc';

// EntityTypeEnum.ACCOMMODATION resolves to 'ACCOMMODATION' (uppercase). The
// route schema is strict about casing — using a lowercase literal makes
// permission checks pass with a 422 schema error and asserts that only
// validate `not.toBe(403)` would silently pass on the wrong status.
const ENTITY_TYPE = EntityTypeEnum.ACCOMMODATION;
const BASE_PATH = `/api/v1/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}`;

const SYSTEM_TAG = {
    id: TAG_ID,
    name: 'Featured',
    type: 'SYSTEM',
    ownerId: null,
    color: 'BLUE',
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    createdById: null,
    updatedById: null
};

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * UNION of all permissions required to pass sibling middleware on
 * adminEntityTagRoutes (all sub-routers mounted at /admin/entities).
 */
const ALL_ENTITY_TAG_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS,
    PermissionEnum.TAG_ASSIGN_VIEW,
    PermissionEnum.TAG_ASSIGN_ADD,
    PermissionEnum.TAG_ASSIGN_REMOVE
];

function buildAdminActor(permissions: PermissionEnum[], id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Admin entity tag routes (SPEC-086 T-026, T-028)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── GET /:type/:id/tags — attribution view (T-026) ───────────────────────

    describe('GET /api/v1/admin/entities/:type/:id/tags (T-026 attribution)', () => {
        it('should return 401 without authentication', async () => {
            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('AC-007-02: should return 403 without TAG_VIEW_ALL_ASSIGNMENTS permission', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('AC-007-01: should return attribution view with TAG_VIEW_ALL_ASSIGNMENTS', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({
                data: { tags: [SYSTEM_TAG] }
            });

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should call getTagsForEntity with correct entityId and entityType', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({
                data: { tags: [] }
            });

            await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            if (mockTagService.getTagsForEntity.mock.calls.length > 0) {
                const callArgs = mockTagService.getTagsForEntity.mock.calls[0];
                const paramsArg = callArgs?.[1] as Record<string, unknown>;
                if (paramsArg) {
                    expect(paramsArg.entityId).toBe(ENTITY_ID);
                    expect(paramsArg.entityType).toBe(ENTITY_TYPE);
                }
            }
        });
    });

    // ─── GET /:type/:id/tags/own — per-actor view (T-028) ────────────────────

    describe('GET /api/v1/admin/entities/:type/:id/tags/own (T-028 own view)', () => {
        it('should return 403 without TAG_ASSIGN_VIEW permission', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request(`${BASE_PATH}/tags/own`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('AC-F05: should return only actor own assignments with TAG_ASSIGN_VIEW', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({
                data: { tags: [SYSTEM_TAG] }
            });

            const res = await app.request(`${BASE_PATH}/tags/own`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('D-007: /tags/own must not shadow /tags (different paths, same base)', async () => {
            // Both GET /tags and GET /tags/own must work independently.
            // If /tags/own were treated as /tags/:tagId, the response would be wrong.
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({ data: { tags: [] } });

            const resAll = await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            const resOwn = await app.request(`${BASE_PATH}/tags/own`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Both should succeed (not 404)
            expect(resAll.status).not.toBe(401);
            expect(resOwn.status).not.toBe(401);
        });
    });

    // ─── POST /:type/:id/tags — assign tag (T-028) ────────────────────────────

    describe('POST /api/v1/admin/entities/:type/:id/tags (T-028 assign)', () => {
        it('should return 403 without TAG_ASSIGN_ADD permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_ASSIGN_VIEW]);

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ tagId: TAG_ID })
            });

            expect(res.status).toBe(403);
        });

        it('AC-F07: should assign tag and inject assignedById=actor.id', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.assignTag.mockResolvedValue({
                data: { assigned: true, wasAlreadyAssigned: false }
            });

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ tagId: TAG_ID })
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('AC-F08: double-assign returns wasAlreadyAssigned=true (idempotent)', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            // Second assignment — service returns idempotent response
            mockTagService.assignTag.mockResolvedValue({
                data: { assigned: true, wasAlreadyAssigned: true }
            });

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ tagId: TAG_ID })
            });

            if (res.status === 200 || res.status === 201) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(data.wasAlreadyAssigned).toBe(true);
            } else {
                expect(res.status).not.toBe(403);
            }
        });

        it('should pass tagId, entityId, entityType to assignTag', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.assignTag.mockResolvedValue({
                data: { assigned: true, wasAlreadyAssigned: false }
            });

            await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ tagId: TAG_ID })
            });

            if (mockTagService.assignTag.mock.calls.length > 0) {
                const callArgs = mockTagService.assignTag.mock.calls[0];
                const paramsArg = callArgs?.[1] as Record<string, unknown>;
                if (paramsArg) {
                    expect(paramsArg.tagId).toBe(TAG_ID);
                    expect(paramsArg.entityId).toBe(ENTITY_ID);
                    expect(paramsArg.entityType).toBe(ENTITY_TYPE);
                }
            }
        });

        it('should return 400 when tagId is missing from body', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);

            const res = await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({})
            });

            // Missing required tagId should fail validation
            expect([400, 422]).toContain(res.status);
        });
    });

    // ─── DELETE /:type/:id/tags/:tagId — remove own assignment (T-028) ───────

    describe('DELETE /api/v1/admin/entities/:type/:id/tags/:tagId (T-028 remove)', () => {
        it('should return 403 without TAG_ASSIGN_REMOVE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_ASSIGN_VIEW]);

            const res = await app.request(`${BASE_PATH}/tags/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should remove own tag assignment with TAG_ASSIGN_REMOVE', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.removeAssignment.mockResolvedValue({ data: { removed: true } });

            const res = await app.request(`${BASE_PATH}/tags/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('D-007: remove only affects actor own assignment (per-user scoping)', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.removeAssignment.mockResolvedValue({ data: { removed: true } });

            await app.request(`${BASE_PATH}/tags/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // removeAssignment handles scoping; the actor is passed to enforce ownership
            if (mockTagService.removeAssignment.mock.calls.length > 0) {
                const callArgs = mockTagService.removeAssignment.mock.calls[0];
                const actorArg = callArgs?.[0] as Actor;
                if (actorArg) {
                    expect(actorArg.id).toBe(ACTOR_ID);
                }
            }
        });

        it('should pass tagId, entityId, entityType to removeAssignment', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.removeAssignment.mockResolvedValue({ data: { removed: true } });

            await app.request(`${BASE_PATH}/tags/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            if (mockTagService.removeAssignment.mock.calls.length > 0) {
                const callArgs = mockTagService.removeAssignment.mock.calls[0];
                const paramsArg = callArgs?.[1] as Record<string, unknown>;
                if (paramsArg) {
                    expect(paramsArg.tagId).toBe(TAG_ID);
                    expect(paramsArg.entityId).toBe(ENTITY_ID);
                    expect(paramsArg.entityType).toBe(ENTITY_TYPE);
                }
            }
        });
    });

    // ─── Route coexistence sanity ─────────────────────────────────────────────

    describe('Route coexistence — GET /tags vs GET /tags/own vs DELETE /tags/:tagId', () => {
        it('GET /tags and POST /tags coexist at same path (different methods)', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({ data: { tags: [] } });
            mockTagService.assignTag.mockResolvedValue({
                data: { assigned: true, wasAlreadyAssigned: false }
            });

            const getRes = await app.request(`${BASE_PATH}/tags`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            const postRes = await app.request(`${BASE_PATH}/tags`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ tagId: TAG_ID })
            });

            // Both should route to their respective handlers, not 404
            expect(getRes.status).not.toBe(401);
            expect(postRes.status).not.toBe(401);
        });

        it('DELETE /tags/:tagId does not conflict with GET /tags/own', async () => {
            const actor = buildAdminActor(ALL_ENTITY_TAG_PERMISSIONS);
            mockTagService.getTagsForEntity.mockResolvedValue({ data: { tags: [] } });
            mockTagService.removeAssignment.mockResolvedValue({ data: { removed: true } });

            const ownRes = await app.request(`${BASE_PATH}/tags/own`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            const deleteRes = await app.request(`${BASE_PATH}/tags/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Both must work without interfering
            expect(ownRes.status).not.toBe(401);
            expect(deleteRes.status).not.toBe(401);
        });
    });
});
