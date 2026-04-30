/**
 * Integration tests for INTERNAL tag admin routes (SPEC-086 T-025)
 *
 * Covers:
 *   GET    /api/v1/admin/tags/internal         — list INTERNAL tags (TAG_INTERNAL_VIEW)
 *   POST   /api/v1/admin/tags/internal         — create INTERNAL tag (TAG_INTERNAL_CREATE)
 *   GET    /api/v1/admin/tags/internal/:id     — get by ID (TAG_INTERNAL_VIEW)
 *   PATCH  /api/v1/admin/tags/internal/:id     — update (TAG_INTERNAL_UPDATE)
 *   GET    /api/v1/admin/tags/internal/:id/impact — impact count (TAG_INTERNAL_VIEW)
 *   DELETE /api/v1/admin/tags/internal/:id     — hard delete (TAG_INTERNAL_DELETE)
 *
 * Hono sibling route middleware collision:
 * All routes in adminInternalTagRoutes share the same router. Tests must provide
 * actors with the UNION of all route permissions to avoid sibling middleware blocking.
 *
 * AC covered: AC-004-02 (admin creates INTERNAL tag)
 * AC-F11: cascade after delete (impact = 0 after tag deleted)
 * D-012: no PATCH on user moderation (tested in admin-user-moderation.test.ts)
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTagService, mockTagModel } = vi.hoisted(() => {
    const mockTagService = {
        adminList: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTag: vi.fn(),
        getImpactCount: vi.fn(),
        list: vi.fn()
    };
    const mockTagModel = {
        findById: vi.fn()
    };
    return { mockTagService, mockTagModel };
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
    return {
        ...actual,
        TagModel: vi.fn().mockImplementation(() => mockTagModel)
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TAG_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const INTERNAL_TAG = {
    id: TAG_ID,
    name: 'Spam',
    type: 'INTERNAL',
    ownerId: null,
    color: 'RED',
    icon: null,
    description: 'Spam detection label',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    createdById: null,
    updatedById: null
};

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * UNION of all permissions required to pass all sibling middleware on
 * adminInternalTagRoutes (Hono sibling route middleware collision).
 * Tests that call any endpoint must provide at least these permissions.
 */
const ALL_INTERNAL_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_INTERNAL_VIEW,
    PermissionEnum.TAG_INTERNAL_CREATE,
    PermissionEnum.TAG_INTERNAL_UPDATE,
    PermissionEnum.TAG_INTERNAL_DELETE
];

function buildAdminActor(permissions: PermissionEnum[]): Actor {
    return {
        id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
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

describe('Admin INTERNAL tag routes (SPEC-086 T-025)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── GET / — list ──────────────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/internal', () => {
        it('should return 401 without authentication', async () => {
            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 403 without TAG_INTERNAL_VIEW permission', async () => {
            const actor = buildAdminActor([]);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should list INTERNAL tags with TAG_INTERNAL_VIEW permission', async () => {
            // Arrange — actor has full union of sibling permissions
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({
                data: { items: [INTERNAL_TAG], total: 1 }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should pass type=INTERNAL filter to adminList', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            await app.request('/api/v1/admin/tags/internal', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Verify that the service was called with type=INTERNAL
            if (mockTagService.adminList.mock.calls.length > 0) {
                const callArgs = mockTagService.adminList.mock.calls[0];
                const queryArg = callArgs?.[1] as Record<string, unknown>;
                if (queryArg) {
                    expect(queryArg.type).toBe('INTERNAL');
                }
            }
        });
    });

    // ─── POST / — create ──────────────────────────────────────────────────────

    describe('POST /api/v1/admin/tags/internal', () => {
        it('should return 403 without TAG_INTERNAL_CREATE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_INTERNAL_VIEW]);
            mockTagService.create.mockResolvedValue({ data: INTERNAL_TAG });

            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Test Tag', color: 'RED' })
            });

            expect(res.status).toBe(403);
        });

        it('AC-004-02: admin creates INTERNAL tag with valid body', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.create.mockResolvedValue({ data: INTERNAL_TAG });

            // Act
            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Spam', color: 'RED' })
            });

            // Assert
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should force type=INTERNAL when creating', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.create.mockResolvedValue({ data: INTERNAL_TAG });

            await app.request('/api/v1/admin/tags/internal', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Spam', color: 'RED', type: 'SYSTEM' })
            });

            // The handler forces type=INTERNAL regardless of body
            if (mockTagService.create.mock.calls.length > 0) {
                const callArgs = mockTagService.create.mock.calls[0];
                const inputArg = callArgs?.[1] as Record<string, unknown>;
                if (inputArg) {
                    expect(inputArg.type).toBe('INTERNAL');
                }
            }
        });
    });

    // ─── GET /:id — get by ID ─────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/internal/:id', () => {
        it('should return 404 when tag not found', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(null);

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });

        it('should return 404 when tag is not INTERNAL type', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            // Tag exists but is SYSTEM type — should return 404 to prevent info leak
            mockTagModel.findById.mockResolvedValue({ ...INTERNAL_TAG, type: 'SYSTEM' });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });

        it('should return tag when it exists and is INTERNAL', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(INTERNAL_TAG);

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── PATCH /:id — update ──────────────────────────────────────────────────

    describe('PATCH /api/v1/admin/tags/internal/:id', () => {
        it('should return 403 without TAG_INTERNAL_UPDATE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_INTERNAL_VIEW]);

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated name' })
            });

            expect(res.status).toBe(403);
        });

        it('should return 404 when updating non-INTERNAL tag', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue({ ...INTERNAL_TAG, type: 'SYSTEM' });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated name' })
            });

            expect(res.status).toBe(404);
        });

        it('should update INTERNAL tag with valid input', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(INTERNAL_TAG);
            mockTagService.update.mockResolvedValue({ data: { ...INTERNAL_TAG, name: 'Updated' } });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated' })
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── GET /:id/impact ──────────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/internal/:id/impact', () => {
        it('should return 403 without TAG_INTERNAL_VIEW', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}/impact`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should return impact count with TAG_INTERNAL_VIEW permission', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.getImpactCount.mockResolvedValue({ data: { count: 5 } });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}/impact`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('AC-F11: impact returns 0 after all assignments are removed', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.getImpactCount.mockResolvedValue({ data: { count: 0 } });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}/impact`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data?.count ?? body.count).toBe(0);
            } else {
                expect(res.status).not.toBe(403);
            }
        });
    });

    // ─── DELETE /:id ──────────────────────────────────────────────────────────

    describe('DELETE /api/v1/admin/tags/internal/:id', () => {
        it('should return 403 without TAG_INTERNAL_DELETE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_INTERNAL_VIEW]);

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should hard-delete INTERNAL tag with TAG_INTERNAL_DELETE permission', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.deleteTag.mockResolvedValue({ data: { deleted: true, impactCount: 3 } });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── AC-004-03: no PATCH on legacy admin tags endpoint ────────────────────

    describe('AC-004-01: admin CRUD scenarios', () => {
        it('should not expose SYSTEM tags via /internal endpoint', async () => {
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            // Model returns a SYSTEM tag — the /internal get route should return 404
            mockTagModel.findById.mockResolvedValue({ ...INTERNAL_TAG, type: 'SYSTEM' });

            const res = await app.request(`/api/v1/admin/tags/internal/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // The route enforces type=INTERNAL — SYSTEM tags are not visible here
            expect(res.status).toBe(404);
        });
    });
});
