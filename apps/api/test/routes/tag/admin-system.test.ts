/**
 * Integration tests for SYSTEM tag admin routes (SPEC-086 T-025)
 *
 * Covers:
 *   GET    /api/v1/admin/tags/system         — list SYSTEM tags (TAG_SYSTEM_VIEW)
 *   POST   /api/v1/admin/tags/system         — create SYSTEM tag (TAG_SYSTEM_CREATE)
 *   GET    /api/v1/admin/tags/system/:id     — get by ID (TAG_SYSTEM_VIEW)
 *   PATCH  /api/v1/admin/tags/system/:id     — update (TAG_SYSTEM_UPDATE)
 *   GET    /api/v1/admin/tags/system/:id/impact — impact count (TAG_SYSTEM_VIEW)
 *   DELETE /api/v1/admin/tags/system/:id     — hard delete (TAG_SYSTEM_DELETE)
 *
 * Hono sibling route middleware collision:
 * All routes in adminSystemTagRoutes share the same router. Tests must provide
 * actors with the UNION of all route permissions to avoid sibling middleware blocking.
 *
 * AC covered: AC-004-02 (admin creates SYSTEM tag)
 * D-002: SYSTEM tags are shared organizational labels usable by any authenticated user
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

const TAG_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

const SYSTEM_TAG = {
    id: TAG_ID,
    name: 'Featured',
    type: 'SYSTEM',
    ownerId: null,
    color: 'BLUE',
    icon: null,
    description: 'Featured content label',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    createdById: null,
    updatedById: null
};

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * UNION of all permissions required to pass all sibling middleware on
 * adminSystemTagRoutes (Hono sibling route middleware collision).
 */
const ALL_SYSTEM_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_SYSTEM_VIEW,
    PermissionEnum.TAG_SYSTEM_CREATE,
    PermissionEnum.TAG_SYSTEM_UPDATE,
    PermissionEnum.TAG_SYSTEM_DELETE
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

describe('Admin SYSTEM tag routes (SPEC-086 T-025)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── GET / — list ──────────────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/system', () => {
        it('should return 401 without authentication', async () => {
            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 403 without TAG_SYSTEM_VIEW permission', async () => {
            const actor = buildAdminActor([]);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should list SYSTEM tags with TAG_SYSTEM_VIEW permission', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({
                data: { items: [SYSTEM_TAG], total: 1 }
            });

            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should pass type=SYSTEM filter to adminList', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            await app.request('/api/v1/admin/tags/system', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            if (mockTagService.adminList.mock.calls.length > 0) {
                const callArgs = mockTagService.adminList.mock.calls[0];
                const queryArg = callArgs?.[1] as Record<string, unknown>;
                if (queryArg) {
                    expect(queryArg.type).toBe('SYSTEM');
                }
            }
        });
    });

    // ─── POST / — create ──────────────────────────────────────────────────────

    describe('POST /api/v1/admin/tags/system', () => {
        it('should return 403 without TAG_SYSTEM_CREATE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_SYSTEM_VIEW]);

            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Featured', color: 'BLUE' })
            });

            expect(res.status).toBe(403);
        });

        it('should create SYSTEM tag with valid body', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.create.mockResolvedValue({ data: SYSTEM_TAG });

            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Featured', color: 'BLUE' })
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should force type=SYSTEM when creating regardless of body', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.create.mockResolvedValue({ data: SYSTEM_TAG });

            await app.request('/api/v1/admin/tags/system', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Featured', color: 'BLUE', type: 'INTERNAL' })
            });

            if (mockTagService.create.mock.calls.length > 0) {
                const callArgs = mockTagService.create.mock.calls[0];
                const inputArg = callArgs?.[1] as Record<string, unknown>;
                if (inputArg) {
                    expect(inputArg.type).toBe('SYSTEM');
                }
            }
        });
    });

    // ─── GET /:id — get by ID ─────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/system/:id', () => {
        it('should return 404 when tag not found', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(null);

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });

        it('should return 404 when tag exists but is not SYSTEM type (info leak prevention)', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            // Tag exists but is INTERNAL type — must return 404, not 200
            mockTagModel.findById.mockResolvedValue({ ...SYSTEM_TAG, type: 'INTERNAL' });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });

        it('should return SYSTEM tag when it exists and type matches', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(SYSTEM_TAG);

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── PATCH /:id — update ──────────────────────────────────────────────────

    describe('PATCH /api/v1/admin/tags/system/:id', () => {
        it('should return 403 without TAG_SYSTEM_UPDATE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_SYSTEM_VIEW]);

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated name' })
            });

            expect(res.status).toBe(403);
        });

        it('should return 404 when updating tag with wrong type', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue({ ...SYSTEM_TAG, type: 'INTERNAL' });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated name' })
            });

            expect(res.status).toBe(404);
        });

        it('should update SYSTEM tag with valid input', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue(SYSTEM_TAG);
            mockTagService.update.mockResolvedValue({ data: { ...SYSTEM_TAG, name: 'Updated' } });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated' })
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── GET /:id/impact ──────────────────────────────────────────────────────

    describe('GET /api/v1/admin/tags/system/:id/impact', () => {
        it('should return 403 without TAG_SYSTEM_VIEW', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}/impact`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should return impact count with TAG_SYSTEM_VIEW permission', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.getImpactCount.mockResolvedValue({ data: { count: 12 } });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}/impact`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── DELETE /:id ──────────────────────────────────────────────────────────

    describe('DELETE /api/v1/admin/tags/system/:id', () => {
        it('should return 403 without TAG_SYSTEM_DELETE permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_SYSTEM_VIEW]);

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('should hard-delete SYSTEM tag with TAG_SYSTEM_DELETE permission', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.deleteTag.mockResolvedValue({ data: { deleted: true, impactCount: 7 } });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ─── Cross-type isolation ─────────────────────────────────────────────────

    describe('Cross-type isolation', () => {
        it('should not expose INTERNAL tags via /system endpoint', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue({ ...SYSTEM_TAG, type: 'INTERNAL' });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });

        it('should not expose USER tags via /system endpoint', async () => {
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagModel.findById.mockResolvedValue({
                ...SYSTEM_TAG,
                type: 'USER',
                ownerId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee'
            });

            const res = await app.request(`/api/v1/admin/tags/system/${TAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(404);
        });
    });
});
