/**
 * Unit tests for admin user create and restore routes (GAP-009).
 *
 * Verifies that user lifecycle operations (create and restore) emit a
 * USER_ADMIN_MUTATION audit log entry with the correct actorId,
 * targetUserId, and operation fields.
 *
 * Pattern: mock `createAdminRoute` to capture the handler function directly,
 * then invoke it with a mock context. This avoids instantiating the full
 * Hono application and all its middleware chain.
 *
 * @module test/routes/user/admin-create-restore
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

const { auditLogSpy, mockCreate, mockRestore } = vi.hoisted(() => ({
    auditLogSpy: vi.fn(),
    mockCreate: vi.fn(),
    mockRestore: vi.fn()
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
        create: mockCreate,
        restore: mockRestore
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
await import('../../../src/routes/user/admin/create');
await import('../../../src/routes/user/admin/restore');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.USER_CREATE, PermissionEnum.USER_RESTORE]
};

const TARGET_USER_ID = 'target-user-id-123';

const CREATED_USER = {
    id: TARGET_USER_ID,
    email: 'newuser@example.com',
    firstName: 'New',
    lastName: 'User',
    displayName: 'New User',
    role: RoleEnum.USER
};

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

describe('Admin user create and restore routes - audit log [SPEC-026 GAP-009]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Create (POST /admin/users)
    // -------------------------------------------------------------------------

    describe('adminCreateUserRoute handler', () => {
        it('should emit USER_ADMIN_MUTATION audit log with create operation on success', async () => {
            // Arrange
            mockCreate.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/');
            const ctx = buildMockContext() as unknown as Context;
            const body = {
                email: 'newuser@example.com',
                firstName: 'New',
                lastName: 'User',
                displayName: 'New User',
                role: RoleEnum.USER
            };

            // Act
            await handler(ctx, {}, body);

            // Assert: auditLog called exactly once with correct payload
            expect(auditLogSpy).toHaveBeenCalledOnce();
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry).toMatchObject({
                auditEvent: AuditEventType.USER_ADMIN_MUTATION,
                actorId: ADMIN_ACTOR.id,
                targetUserId: TARGET_USER_ID,
                operation: 'create'
            });
        });

        it('should NOT emit audit log when service returns an error', async () => {
            // Arrange
            mockCreate.mockResolvedValue({
                data: undefined,
                error: { code: 'VALIDATION_ERROR', message: 'Email already exists' }
            });
            const handler = getHandler('/');
            const ctx = buildMockContext() as unknown as Context;
            const body = { email: 'duplicate@example.com', firstName: 'Dup', lastName: 'User' };

            // Act: handler throws ServiceError before reaching auditLog
            await expect(handler(ctx, {}, body)).rejects.toThrow();

            // Assert
            expect(auditLogSpy).not.toHaveBeenCalled();
        });

        it('should capture the actorId of the performing admin', async () => {
            // Arrange
            const otherAdmin = { ...ADMIN_ACTOR, id: 'other-admin-id' };
            mockGetActorFromContext.mockReturnValue(otherAdmin);
            mockCreate.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, { email: 'user@example.com' });

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.actorId).toBe('other-admin-id');
        });

        it('should use the created user id as targetUserId', async () => {
            // Arrange
            const specificId = 'specific-created-user-456';
            mockCreate.mockResolvedValue({
                data: { ...CREATED_USER, id: specificId },
                error: undefined
            });
            const handler = getHandler('/');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, { email: 'user@example.com' });

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.targetUserId).toBe(specificId);
        });

        it('should use create (not soft_delete or hard_delete) as the operation field', async () => {
            // Arrange
            mockCreate.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, { email: 'user@example.com' });

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.operation).toBe('create');
            expect(entry.operation).not.toBe('soft_delete');
            expect(entry.operation).not.toBe('hard_delete');
            expect(entry.operation).not.toBe('restore');
        });
    });

    // -------------------------------------------------------------------------
    // Restore (POST /admin/users/{id}/restore)
    // -------------------------------------------------------------------------

    describe('adminRestoreUserRoute handler', () => {
        it('should emit USER_ADMIN_MUTATION audit log with restore operation on success', async () => {
            // Arrange
            mockRestore.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/{id}/restore');
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
                operation: 'restore'
            });
        });

        it('should NOT emit audit log when service returns an error', async () => {
            // Arrange
            mockRestore.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
            const handler = getHandler('/{id}/restore');
            const ctx = buildMockContext() as unknown as Context;
            const params = { id: TARGET_USER_ID };

            // Act: handler throws ServiceError before reaching auditLog
            await expect(handler(ctx, params, {})).rejects.toThrow();

            // Assert
            expect(auditLogSpy).not.toHaveBeenCalled();
        });

        it('should capture the targetUserId from route params', async () => {
            // Arrange
            const specificId = 'specific-restore-user-789';
            mockRestore.mockResolvedValue({
                data: { ...CREATED_USER, id: specificId },
                error: undefined
            });
            const handler = getHandler('/{id}/restore');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: specificId }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.targetUserId).toBe(specificId);
        });

        it('should capture the actorId of the performing admin', async () => {
            // Arrange
            const otherAdmin = { ...ADMIN_ACTOR, id: 'other-admin-restore-id' };
            mockGetActorFromContext.mockReturnValue(otherAdmin);
            mockRestore.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/{id}/restore');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.actorId).toBe('other-admin-restore-id');
        });

        it('should use restore (not soft_delete or hard_delete) as the operation field', async () => {
            // Arrange
            mockRestore.mockResolvedValue({ data: CREATED_USER, error: undefined });
            const handler = getHandler('/{id}/restore');
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, { id: TARGET_USER_ID }, {});

            // Assert
            const entry = auditLogSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(entry.operation).toBe('restore');
            expect(entry.operation).not.toBe('soft_delete');
            expect(entry.operation).not.toBe('hard_delete');
            expect(entry.operation).not.toBe('create');
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
