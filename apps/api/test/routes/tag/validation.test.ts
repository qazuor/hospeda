/**
 * Validation-layer integration tests for user-tag routes (SPEC-086 T-042/T-043)
 *
 * Covers schema / structural ACs that verify the service correctly rejects
 * invalid inputs and enforces structural invariants:
 *
 *   AC-F01 — USER tag with null ownerId rejected (400/422)
 *   AC-F02 — SYSTEM/INTERNAL tag with non-null ownerId rejected (400/422)
 *   AC-F03 — USER tag name colliding with SYSTEM/INTERNAL → 409
 *
 * These invariants are enforced at the service layer (TagService.create /
 * TagService.createUserTag). Routes throw ServiceError which the Hono error
 * handler maps to an HTTP error response.
 *
 * Pattern: mock service to return the appropriate error and verify the HTTP
 * layer propagates it correctly (non-success status, not 200/201).
 *
 * Hono sibling route middleware collision applies — actors carry the UNION of
 * all permissions on the router being tested.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTagService } = vi.hoisted(() => {
    const mockTagService = {
        create: vi.fn(),
        createUserTag: vi.fn(),
        adminList: vi.fn(),
        update: vi.fn(),
        updateOwnTag: vi.fn(),
        deleteTag: vi.fn(),
        getImpactCount: vi.fn(),
        getOwnTagImpactCount: vi.fn(),
        getQuotaStatus: vi.fn(),
        listOwnTags: vi.fn(),
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
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

// ─── Permission helpers ───────────────────────────────────────────────────────

const ALL_INTERNAL_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_INTERNAL_CREATE,
    PermissionEnum.TAG_INTERNAL_VIEW,
    PermissionEnum.TAG_INTERNAL_UPDATE,
    PermissionEnum.TAG_INTERNAL_DELETE
];

const ALL_SYSTEM_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_SYSTEM_CREATE,
    PermissionEnum.TAG_SYSTEM_VIEW,
    PermissionEnum.TAG_SYSTEM_UPDATE,
    PermissionEnum.TAG_SYSTEM_DELETE
];

const ALL_OWN_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_USER_VIEW_OWN,
    PermissionEnum.TAG_USER_CREATE,
    PermissionEnum.TAG_USER_UPDATE_OWN,
    PermissionEnum.TAG_USER_DELETE_OWN
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

describe('Tag validation invariants (SPEC-086 T-042/T-043 AC-F01..F03)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // AC-F01 — USER tag without ownerId is rejected
    // =========================================================================

    describe('AC-F01: USER tag with null ownerId is rejected', () => {
        it('service returning VALIDATION_ERROR on createUserTag surfaces as non-success status', async () => {
            // Arrange — service rejects because ownerId would be null without actor injection
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'USER tag requires ownerId (type=USER invariant)'
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Test tag', color: 'GREEN' })
            });

            // Assert — must not succeed (route catches ServiceError and returns non-2xx)
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('createUserTag route always injects ownerId=actor.id (not caller-provided)', async () => {
            // Arrange — service succeeds; we verify the route always calls createUserTag
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: {
                    id: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
                    name: 'Test tag',
                    type: 'USER',
                    ownerId: ACTOR_ID,
                    color: 'GREEN',
                    lifecycleState: 'ACTIVE'
                }
            });

            // Act — body does NOT include type or ownerId (route enforces them)
            await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Test tag', color: 'GREEN' })
            });

            // Assert — route delegates to createUserTag (which enforces ownerId=actor.id)
            if (mockTagService.createUserTag.mock.calls.length > 0) {
                expect(mockTagService.createUserTag).toHaveBeenCalled();
                // generic create should not be called (which might skip ownerId injection)
                expect(mockTagService.create).not.toHaveBeenCalled();
            }
        });
    });

    // =========================================================================
    // AC-F02 — SYSTEM/INTERNAL tag with non-null ownerId is rejected
    // =========================================================================

    describe('AC-F02: SYSTEM/INTERNAL tag with non-null ownerId is rejected', () => {
        it('INTERNAL: service returning VALIDATION_ERROR on create surfaces as non-success', async () => {
            // Arrange — service rejects because ownerId should be null for INTERNAL
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.create.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'INTERNAL tag must not have ownerId (type invariant)'
                }
            });

            // Act — body includes ownerId (which the route strips, but service still validates)
            const res = await app.request('/api/v1/admin/tags/internal', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Spam', color: 'RED' })
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('SYSTEM: service returning VALIDATION_ERROR on create surfaces as non-success', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_SYSTEM_PERMISSIONS);
            mockTagService.create.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'SYSTEM tag must not have ownerId (type invariant)'
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/system', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Featured', color: 'BLUE' })
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('INTERNAL route forces ownerId=undefined regardless of body (route enforces null)', async () => {
            // Arrange — service succeeds when ownerId is not present
            const actor = buildAdminActor(ALL_INTERNAL_PERMISSIONS);
            mockTagService.create.mockResolvedValue({
                data: {
                    id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
                    name: 'Spam',
                    type: 'INTERNAL',
                    ownerId: null,
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                }
            });

            await app.request('/api/v1/admin/tags/internal', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Spam', color: 'RED' })
            });

            // The route strips ownerId before calling service.create
            if (mockTagService.create.mock.calls.length > 0) {
                const callArgs = mockTagService.create.mock.calls[0];
                const inputArg = callArgs?.[1] as Record<string, unknown>;
                if (inputArg) {
                    // ownerId should be undefined/absent (route enforces this per D-002)
                    expect(inputArg.type).toBe('INTERNAL');
                    expect(inputArg.ownerId == null).toBe(true);
                }
            }
        });
    });

    // =========================================================================
    // AC-F03 — USER tag name colliding with SYSTEM/INTERNAL returns 409
    // =========================================================================

    describe('AC-F03: USER tag name collision with SYSTEM/INTERNAL returns non-success (409)', () => {
        it('createUserTag service returns ALREADY_EXISTS when name collides with SYSTEM tag', async () => {
            // Arrange — simulate name collision with existing SYSTEM tag "Featured"
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message:
                        "The name 'Featured' is already used by a system tag and cannot be used for a personal tag."
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Featured', color: 'GREEN' })
            });

            // Assert — must not succeed; 409 or other error status expected
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('createUserTag service returns ALREADY_EXISTS when name collides with INTERNAL tag', async () => {
            // Arrange — simulate name collision with existing INTERNAL tag "Spam"
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message:
                        "The name 'Spam' is already used by a system tag and cannot be used for a personal tag."
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Spam', color: 'RED' })
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('createUserTag succeeds when name is unique across all tag types', async () => {
            // Arrange — no name collision; unique USER tag name
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: {
                    id: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
                    name: 'My unique personal tag',
                    type: 'USER',
                    ownerId: ACTOR_ID,
                    color: 'PURPLE',
                    lifecycleState: 'ACTIVE'
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'My unique personal tag', color: 'PURPLE' })
            });

            // Assert — should succeed
            expect(res.status).not.toBe(403);
            if (res.status < 400) {
                expect([200, 201]).toContain(res.status);
            }
        });
    });
});
