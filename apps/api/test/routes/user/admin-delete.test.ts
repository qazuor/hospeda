/**
 * Unit tests for admin user delete and hard delete routes (GAP-009).
 *
 * Verifies that both PII-critical operations (soft delete and permanent
 * hard delete) emit a USER_ADMIN_MUTATION audit log entry with the
 * correct actorId, targetUserId, and operation fields.
 *
 * Pattern: mock `createAdminRoute` to capture the handler function directly,
 * then invoke it with a mock context. This avoids instantiating the full
 * Hono application and all its middleware chain.
 *
 * @module test/routes/user/admin-delete
 * @see SPEC-026 GAP-009
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs - available inside vi.mock factories.
// ---------------------------------------------------------------------------

/**
 * Stores the handler captured from createAdminRoute for each route file.
 * Keys are the path string from the route config.
 */
const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { auditLogSpy, mockSoftDelete, mockHardDelete } = vi.hoisted(() => ({
    auditLogSpy: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockHardDelete: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createAdminRoute to capture the raw handler function.
vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            // Return something that resembles a Hono router stub (not used by tests)
            return config.handler;
        }
    )
}));

// Spy on auditLog while keeping AuditEventType intact.
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return {
        ...original,
        auditLog: (...args: Parameters<typeof original.auditLog>) => {
            auditLogSpy(...args);
        }
    };
});

// Mock actor resolution.
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock UserService so no real DB calls happen.
vi.mock('@repo/service-core', () => ({
    UserService: vi.fn(() => ({
        softDelete: mockSoftDelete,
        hardDelete: mockHardDelete
    })),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';
import { AuditEventType } from '../../../src/utils/audit-logger';

// Trigger module execution so createAdminRoute captures the handlers.
await import('../../../src/routes/user/admin/delete');
await import('../../../src/routes/user/admin/hardDelete');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE]
};

const TARGET_USER_ID = 'target-user-id-123';

function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for a given route path. Throws if not found. */
function getHandler(
    path: string
): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get(path);
    if (!handler) {
        throw new Error(`No handler captured for path: ${path}`);
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin user delete routes - audit log [SPEC-026 GAP-009]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Soft delete (DELETE /admin/users/{id})
    // -------------------------------------------------------------------------

    describe('adminDeleteUserRoute handler (soft delete)', () => {
        it('should emit USER_ADMIN_MUTATION audit log with soft_delete operation on success', async () => {
            // Arrange
            mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
            const handler = getHandler('/{id}');
            const ctx = buildMockContext() as unknown as Context;
            const params = { id: TARGET_USER_ID };

            // Act
            await handler(ctx, params, {});

            // Assert: auditLog called exactly once with correct payload
            expect(auditLogSpy).toHaveBeenCalledOnce();
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry).toMatchObject({
                auditEvent: AuditEventType.USER_ADMIN_MUTATION,
                actorId: ADMIN_ACTOR.id,
                targetUserId: TARGET_USER_ID,
                operation: 'soft_delete'
            });
        });

        it('should NOT emit audit log when service returns an error', async () => {
            // Arrange
            mockSoftDelete.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
            const handler = getHandler('/{id}');
            const ctx = buildMockContext() as unknown as Context;
            const params = { id: TARGET_USER_ID };

            // Act: handler throws ServiceError before reaching auditLog
            await expect(handler(ctx, params, {})).rejects.toThrow();

            // Assert
            expect(auditLogSpy).not.toHaveBeenCalled();
        });

        it('should capture the actorId of the performing admin', async () => {
            // Arrange
            const otherAdmin = { ...ADMIN_ACTOR, id: 'other-admin-id' };
            mockGetActorFromContext.mockReturnValue(otherAdmin);
            mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
            const handler = getHandler('/{id}');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.actorId).toBe('other-admin-id');
        });

        it('should use soft_delete (not hard_delete) as the operation field', async () => {
            // Arrange
            mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
            const handler = getHandler('/{id}');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.operation).toBe('soft_delete');
            expect(entry.operation).not.toBe('hard_delete');
        });
    });

    // -------------------------------------------------------------------------
    // Hard delete (DELETE /admin/users/{id}/hard)
    // -------------------------------------------------------------------------

    describe('adminHardDeleteUserRoute handler (hard delete)', () => {
        it('should emit USER_ADMIN_MUTATION audit log with hard_delete operation on success', async () => {
            // Arrange
            mockHardDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
            const handler = getHandler('/{id}/hard');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            expect(auditLogSpy).toHaveBeenCalledOnce();
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry).toMatchObject({
                auditEvent: AuditEventType.USER_ADMIN_MUTATION,
                actorId: ADMIN_ACTOR.id,
                targetUserId: TARGET_USER_ID,
                operation: 'hard_delete'
            });
        });

        it('should NOT emit audit log when service returns an error', async () => {
            // Arrange
            mockHardDelete.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
            const handler = getHandler('/{id}/hard');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await expect(handler(ctx, { id: TARGET_USER_ID }, {})).rejects.toThrow();

            // Assert
            expect(auditLogSpy).not.toHaveBeenCalled();
        });

        it('should capture the targetUserId from route params', async () => {
            // Arrange
            const specificId = 'specific-target-user-999';
            mockHardDelete.mockResolvedValue({ data: { id: specificId }, error: undefined });
            const handler = getHandler('/{id}/hard');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: specificId }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.targetUserId).toBe(specificId);
        });

        it('should use hard_delete (not soft_delete) as the operation field', async () => {
            // Arrange
            mockHardDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });
            const handler = getHandler('/{id}/hard');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.operation).toBe('hard_delete');
            expect(entry.operation).not.toBe('soft_delete');
        });
    });

    // -------------------------------------------------------------------------
    // AuditEventType constant
    // -------------------------------------------------------------------------

    describe('AuditEventType.USER_ADMIN_MUTATION', () => {
        it('should equal "user.admin.mutation"', () => {
            expect(AuditEventType.USER_ADMIN_MUTATION).toBe('user.admin.mutation');
        });
    });
});
