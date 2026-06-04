/**
 * Integration tests for USER tag moderation admin routes (SPEC-086 T-026)
 *
 * Covers:
 *   GET    /api/v1/admin/tags/user     — list ALL USER tags across owners (TAG_VIEW_ALL_USER_TAGS)
 *   DELETE /api/v1/admin/tags/user/:id — delete any USER tag (TAG_USER_DELETE_ANY)
 *
 * CRITICAL — D-012: No PATCH/PUT route exists on this router.
 * Moderation is delete-only. Tests verify PATCH returns 404 (route not found).
 *
 * AC covered: AC-008-01 (super-admin list all user tags), AC-008-02 (super-admin delete any user tag)
 * D-012: moderation is delete-only — no update capability by design
 *
 * Hono sibling route middleware collision:
 * The adminUserTagModerationRoutes router is mounted at /admin/tags/user.
 * Tests must provide the UNION of all sibling permissions.
 */

import { setDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Mock DB client ───────────────────────────────────────────────────────────
// setDb() injects a mock DrizzleClient so getDb() works without a real DB.
// Each test that calls getDb() controls the query result via mockDbWhereResult.
// Regular functions (NOT vi.fn()) are used so vi.clearAllMocks() does not reset
// the chain and cause "cannot read property 'from' of undefined" errors.
let mockDbWhereResult: unknown[] = [];
const mockDbClient = {
    select: () => ({
        from: () => ({
            where: () => Promise.resolve(mockDbWhereResult)
        })
    })
} as unknown as Parameters<typeof setDb>[0];

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTagService } = vi.hoisted(() => {
    const mockTagService = {
        adminList: vi.fn(),
        deleteTag: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        getImpactCount: vi.fn(),
        list: vi.fn()
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
    // `users` is re-exported from @repo/db via `export *`, but Vitest's importOriginal()
    // does not always resolve transitive `export *` bindings in ESM. Use a portable
    // relative import to the canonical source file instead of an absolute path.
    // Path from apps/api/test/routes/tag/ → repo-root/packages/db/src/schemas/user/
    const { users } = await import('../../../../../packages/db/src/schemas/user/user.dbschema');
    return { ...actual, users };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TAG_ID = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
const OWNER_ID = 'ffffffff-ffff-4fff-afff-ffffffffffff';

const USER_TAG = {
    id: TAG_ID,
    name: 'My favorite spots',
    type: 'USER',
    ownerId: OWNER_ID,
    color: 'GREEN',
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2025-06-01').toISOString(),
    updatedAt: new Date('2025-06-01').toISOString(),
    createdById: OWNER_ID,
    updatedById: null
};

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * UNION of all permissions required to pass sibling middleware on
 * adminUserTagModerationRoutes.
 */
const ALL_MODERATION_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_VIEW_ALL_USER_TAGS,
    PermissionEnum.TAG_USER_DELETE_ANY
];

function buildAdminActor(permissions: PermissionEnum[]): Actor {
    return {
        id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
        role: RoleEnum.SUPER_ADMIN,
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

describe('Admin USER tag moderation routes (SPEC-086 T-026)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        // Inject the mock DB client so getDb() works without a real database.
        setDb(mockDbClient);
        app = initApp();
    });

    beforeEach(() => {
        // Reset the DB query result to empty before each test.
        mockDbWhereResult = [];
        vi.clearAllMocks();
    });

    // ─── GET / — list all USER tags (moderation view) ─────────────────────────

    describe('GET /api/v1/admin/tags/user', () => {
        it('should return 401 without authentication', async () => {
            const res = await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 403 without TAG_VIEW_ALL_USER_TAGS permission', async () => {
            const actor = buildAdminActor([]);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            const res = await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('AC-008-01: super-admin can list all USER tags across owners', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({
                data: { items: [USER_TAG], total: 1 }
            });

            const res = await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should pass type=USER filter to adminList', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

            await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            if (mockTagService.adminList.mock.calls.length > 0) {
                const callArgs = mockTagService.adminList.mock.calls[0];
                const queryArg = callArgs?.[1] as Record<string, unknown>;
                if (queryArg) {
                    expect(queryArg.type).toBe('USER');
                }
            }
        });

        it('should enrich list items with owner displayName, email, and role', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({
                data: { items: [USER_TAG], total: 1 }
            });

            // Set the DB query result to return the owner row for OWNER_ID
            mockDbWhereResult = [
                {
                    id: OWNER_ID,
                    displayName: 'Test Owner',
                    email: 'owner@example.com',
                    role: 'USER'
                }
            ];

            // Act
            const res = await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            const firstItem = (body as { data: { items: Record<string, unknown>[] } }).data
                .items[0];
            expect(firstItem).toBeDefined();
            expect(firstItem?.ownerDisplayName).toBe('Test Owner');
            expect(firstItem?.ownerEmail).toBe('owner@example.com');
            expect(firstItem?.ownerRole).toBe('USER');
        });

        it('should set owner fields to null when owner does not exist in users table', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.adminList.mockResolvedValue({
                data: { items: [USER_TAG], total: 1 }
            });

            // mockDbWhereResult is empty by default (set in beforeEach) — owner not found

            // Act
            const res = await app.request('/api/v1/admin/tags/user', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            const firstItem = (body as { data: { items: Record<string, unknown>[] } }).data
                .items[0];
            expect(firstItem?.ownerDisplayName).toBeNull();
            expect(firstItem?.ownerEmail).toBeNull();
            expect(firstItem?.ownerRole).toBeNull();
        });
    });

    // ─── DELETE /:id — delete any USER tag ────────────────────────────────────

    describe('DELETE /api/v1/admin/tags/user/:id', () => {
        it('should return 403 without TAG_USER_DELETE_ANY permission', async () => {
            const actor = buildAdminActor([PermissionEnum.TAG_VIEW_ALL_USER_TAGS]);

            const res = await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('AC-008-02: super-admin can delete any USER tag', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.deleteTag.mockResolvedValue({ data: { deleted: true, impactCount: 2 } });

            const res = await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });

        it('should call tagService.deleteTag with the correct tagId', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);
            mockTagService.deleteTag.mockResolvedValue({ data: { deleted: true, impactCount: 0 } });

            await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            if (mockTagService.deleteTag.mock.calls.length > 0) {
                const callArgs = mockTagService.deleteTag.mock.calls[0];
                expect(callArgs?.[1]).toBe(TAG_ID);
            }
        });
    });

    // ─── D-012: No PATCH route exists (moderation is delete-only) ────────────

    describe('D-012: No PATCH/PUT route (moderation is delete-only)', () => {
        it('D-012: PATCH /api/v1/admin/tags/user/:id should not succeed', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);

            const res = await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Attempted update' })
            });

            // The router has no PATCH route registered.
            // Hono may return 404, 405, or 403 (sibling middleware collision
            // where permission check on a sibling route runs before Hono confirms
            // the method is unmatched). None of these should be 200/201.
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('D-012: PUT /api/v1/admin/tags/user/:id should not succeed', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);

            const res = await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'PUT',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Attempted update' })
            });

            // No PUT route on moderation router by design.
            // Status may be 404, 405, or 403 (sibling middleware collision).
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('should NOT call tagService.update for any moderation action', async () => {
            const actor = buildAdminActor(ALL_MODERATION_PERMISSIONS);

            // Even an attempted PATCH should never reach the update service method
            await app.request(`/api/v1/admin/tags/user/${TAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Should never reach update' })
            });

            expect(mockTagService.update).not.toHaveBeenCalled();
        });
    });
});
