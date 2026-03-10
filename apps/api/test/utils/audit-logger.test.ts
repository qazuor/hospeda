/**
 * Unit tests for the audit-logger utility.
 *
 * Covers all AuditEventType values, timestamp auto-generation,
 * sensitive field scrubbing, logger category registration,
 * and anonymous actor handling.
 *
 * @module test/utils/audit-logger
 */

import type { Mock } from 'vitest';

// vi.mock is hoisted to the top of the file by Vitest before any variable
// declarations, so the factory must be completely self-contained.
// We capture the audit logger's info mock AFTER imports by inspecting the
// return value that registerCategory produced when the module was loaded.

vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel
    };
});

import { logger } from '@repo/logger';
// Imports must come after vi.mock declarations.
import { AuditEventType, auditLog } from '../../src/utils/audit-logger';

/**
 * Retrieve the `info` mock from the audit logger instance that was created
 * when `audit-logger.ts` called `logger.registerCategory('AUDIT', ...)` at
 * module load time. registerCategory returns a new mocked logger each call,
 * so the first (and only) call's return value is the audit logger.
 */
function getAuditInfoMock(): Mock {
    const registerCategoryMock = logger.registerCategory as Mock;
    const auditLoggerInstance = registerCategoryMock.mock.results[0]?.value as
        | { info: Mock }
        | undefined;
    if (!auditLoggerInstance) {
        throw new Error('registerCategory was not called during module initialization');
    }
    return auditLoggerInstance.info;
}

describe('audit-logger', () => {
    beforeEach(() => {
        getAuditInfoMock().mockClear();
    });

    describe('AuditEventType entries', () => {
        it('should log AUTH_LOGIN_FAILED with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
                email: 'test@example.com',
                ip: '1.2.3.4',
                reason: 'invalid_credentials',
                attemptNumber: 1,
                locked: false
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.AUTH_LOGIN_FAILED });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.AUTH_LOGIN_FAILED}`);
        });

        it('should log AUTH_LOGIN_SUCCESS with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.AUTH_LOGIN_SUCCESS}`);
        });

        it('should log AUTH_LOCKOUT with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOCKOUT,
                email: 'test@example.com',
                ip: '1.2.3.4',
                attemptNumber: 5,
                retryAfter: 900
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.AUTH_LOCKOUT });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.AUTH_LOCKOUT}`);
        });

        it('should log ACCESS_DENIED with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'user-123',
                actorRole: 'user',
                resource: '/api/v1/admin/users',
                method: 'GET',
                statusCode: 403,
                reason: 'insufficient_permissions'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.ACCESS_DENIED });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.ACCESS_DENIED}`);
        });

        it('should log BILLING_MUTATION with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: 'admin-1',
                action: 'create' as const,
                resourceType: 'promo_code',
                resourceId: 'pc-123'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.BILLING_MUTATION });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.BILLING_MUTATION}`);
        });

        it('should log PERMISSION_CHANGE with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.PERMISSION_CHANGE,
                actorId: 'admin-1',
                targetUserId: 'user-456',
                changeType: 'role_assignment' as const,
                oldValue: 'user',
                newValue: 'admin'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.PERMISSION_CHANGE });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.PERMISSION_CHANGE}`);
        });

        it('should log SESSION_SIGNOUT with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.SESSION_SIGNOUT });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.SESSION_SIGNOUT}`);
        });
    });

    describe('timestamp handling', () => {
        it('should auto-generate timestamp when not provided', () => {
            // Arrange
            const before = new Date().toISOString();
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);
            const after = new Date().toISOString();

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry] = mockInfo.mock.calls[0] as [Record<string, unknown>, string];
            const timestamp = loggedEntry.timestamp as string;

            expect(typeof timestamp).toBe('string');
            // Verify it is a valid ISO-8601 string by parsing it
            expect(Number.isNaN(new Date(timestamp).getTime())).toBe(false);
            // Verify the timestamp falls within the test execution window
            expect(timestamp >= before).toBe(true);
            expect(timestamp <= after).toBe(true);
        });

        it('should preserve an explicitly provided timestamp', () => {
            // Arrange
            const fixedTimestamp = '2024-01-15T10:30:00.000Z';
            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4',
                timestamp: fixedTimestamp
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.timestamp).toBe(fixedTimestamp);
        });
    });

    describe('sensitive field scrubbing', () => {
        it('should scrub fields matching sensitive patterns', () => {
            // Arrange - cast to bypass strict typing to simulate runtime data
            // carrying extra fields that match the sensitive patterns regex.
            const entryWithSensitiveField = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4',
                password: 'super-secret'
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entryWithSensitiveField);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.password).toBe('[REDACTED]');
        });

        it('should preserve non-sensitive fields intact', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
                email: 'test@example.com',
                ip: '1.2.3.4',
                reason: 'invalid_credentials',
                attemptNumber: 1,
                locked: false
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.email).toBe('test@example.com');
            expect(loggedEntry.ip).toBe('1.2.3.4');
            expect(loggedEntry.reason).toBe('invalid_credentials');
            expect(loggedEntry.attemptNumber).toBe(1);
            expect(loggedEntry.locked).toBe(false);
        });
    });

    describe('logger category registration', () => {
        it('should register the AUDIT logger category with RED color on module load', () => {
            // Assert - registerCategory is invoked when the module is first imported;
            // by the time tests run it has already been called exactly once.
            expect(logger.registerCategory as Mock).toHaveBeenCalledWith('AUDIT', 'AUDIT', {
                color: 'RED'
            });
        });
    });

    describe('anonymous actor handling', () => {
        it('should log ACCESS_DENIED correctly when actorId is anonymous', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'anonymous',
                actorRole: 'guest',
                resource: '/api/v1/admin/users',
                method: 'GET',
                statusCode: 403,
                reason: 'insufficient_permissions'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const mockInfo = getAuditInfoMock();
            expect(mockInfo).toHaveBeenCalledOnce();
            const [loggedEntry, loggedMessage] = mockInfo.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry).toMatchObject({
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'anonymous',
                actorRole: 'guest',
                resource: '/api/v1/admin/users',
                method: 'GET',
                statusCode: 403,
                reason: 'insufficient_permissions'
            });
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.ACCESS_DENIED}`);
        });
    });
});
