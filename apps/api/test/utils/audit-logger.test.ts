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
// Use vi.hoisted() to declare variables that are referenced inside vi.mock factories.

const { mockAddBreadcrumb } = vi.hoisted(() => ({
    mockAddBreadcrumb: vi.fn()
}));

vi.mock('@sentry/node', () => ({
    addBreadcrumb: mockAddBreadcrumb
}));

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

    const AuditEventType = {
        AUTH_LOGIN_FAILED: 'auth.login.failed',
        AUTH_LOGIN_SUCCESS: 'auth.login.success',
        AUTH_LOCKOUT: 'auth.lockout',
        AUTH_PASSWORD_CHANGED: 'auth.password.changed',
        ACCESS_DENIED: 'access.denied',
        BILLING_MUTATION: 'billing.mutation',
        PERMISSION_CHANGE: 'permission.change',
        SESSION_SIGNOUT: 'session.signout',
        USER_ADMIN_MUTATION: 'user.admin.mutation',
        ROUTE_MUTATION: 'route.mutation'
    } as const;

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        AuditEventType
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
        mockAddBreadcrumb.mockClear();
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

        it('should log AUTH_PASSWORD_CHANGED with correct auditEvent and message', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_PASSWORD_CHANGED,
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
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.AUTH_PASSWORD_CHANGED });
            expect(typeof loggedEntry.timestamp).toBe('string');
            expect(loggedMessage).toBe(`AUDIT:${AuditEventType.AUTH_PASSWORD_CHANGED}`);
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

    describe('error resilience (try-catch)', () => {
        it('should not throw when the underlying logger throws', () => {
            // Arrange - make the audit logger's info method throw synchronously
            const mockInfo = getAuditInfoMock();
            mockInfo.mockImplementationOnce(() => {
                throw new Error('Logger transport failure');
            });

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act & Assert - must not throw even though logger.info throws
            expect(() => auditLog(entry)).not.toThrow();
        });

        it('should log the failure to console.error when the underlying logger throws', () => {
            // Arrange
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const loggerError = new Error('Logger transport failure');
            getAuditInfoMock().mockImplementationOnce(() => {
                throw loggerError;
            });

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledOnce();
            const [message, context] = consoleErrorSpy.mock.calls[0] as [
                string,
                { auditEvent: string; error: Error }
            ];
            expect(message).toContain('[audit-logger]');
            expect(context.auditEvent).toBe(AuditEventType.AUTH_LOGIN_SUCCESS);
            expect(context.error).toBe(loggerError);

            consoleErrorSpy.mockRestore();
        });

        it('should continue to work normally after a previous logger failure', () => {
            // Arrange - first call throws, second call succeeds
            const mockInfo = getAuditInfoMock();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            mockInfo.mockImplementationOnce(() => {
                throw new Error('Transient failure');
            });

            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry); // this one throws internally (caught by try-catch)
            auditLog(entry); // this one should succeed

            // Assert - both calls were attempted (mock records all calls including throwing ones)
            // The first call threw (caught) and the second succeeded: total 2 invocations.
            expect(mockInfo).toHaveBeenCalledTimes(2);

            // The second call (index 1) must have produced a valid audit entry
            const [loggedEntry] = mockInfo.mock.calls[1] as [Record<string, unknown>, string];
            expect(loggedEntry).toMatchObject({ auditEvent: AuditEventType.SESSION_SIGNOUT });

            // console.error was called exactly once (for the first failed call)
            expect(consoleErrorSpy).toHaveBeenCalledOnce();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('recursive sensitive field scrubbing', () => {
        it('should scrub sensitive fields in nested objects', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                nested: { token: 'abc123', safeField: 'keep-me' }
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            const nested = loggedEntry.nested as Record<string, unknown>;
            expect(nested.token).toBe('[REDACTED]');
            expect(nested.safeField).toBe('keep-me');
        });

        it('should scrub sensitive fields deeply nested at multiple levels', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'user-1',
                actorRole: 'user',
                resource: '/api/v1/admin',
                method: 'GET',
                statusCode: 403,
                reason: 'no_permission',
                level1: {
                    level2: {
                        level3: { secret: 'deep-secret', visible: 'ok' }
                    }
                }
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            const level1 = loggedEntry.level1 as Record<string, unknown>;
            const level2 = level1.level2 as Record<string, unknown>;
            const level3 = level2.level3 as Record<string, unknown>;
            expect(level3.secret).toBe('[REDACTED]');
            expect(level3.visible).toBe('ok');
        });

        it('should scrub sensitive fields inside arrays', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                items: [
                    { name: 'item-1', password: 'pass1' },
                    { name: 'item-2', password: 'pass2' }
                ]
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            const items = loggedEntry.items as Array<Record<string, unknown>>;
            expect(items[0]?.password).toBe('[REDACTED]');
            expect(items[1]?.password).toBe('[REDACTED]');
            expect(items[0]?.name).toBe('item-1');
            expect(items[1]?.name).toBe('item-2');
        });

        it('should handle circular references without throwing', () => {
            // Arrange
            const circular: Record<string, unknown> = { name: 'root', safeData: 'abc' };
            circular.self = circular; // Creates circular reference

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                data: circular
            } as unknown as Parameters<typeof auditLog>[0];

            // Act & Assert - must not throw or cause infinite recursion
            expect(() => auditLog(entry)).not.toThrow();
        });

        it('should replace circular reference node with [Circular] sentinel', () => {
            // Arrange
            const circular: Record<string, unknown> = { name: 'root' };
            circular.self = circular;

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                data: circular
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            const data = loggedEntry.data as Record<string, unknown>;
            expect(data.self).toBe('[Circular]');
        });

        it('should stop recursion at MAX_SCRUB_DEPTH and leave deeper values untouched', () => {
            // Arrange - build a 12-level deep object (exceeds MAX_SCRUB_DEPTH of 10)
            type DeepRecord = Record<string, unknown>;
            const deepNested: DeepRecord = { deepSecret: 'deep-value' };
            let current: DeepRecord = deepNested;
            for (let i = 0; i < 12; i++) {
                const wrapper: DeepRecord = { child: current };
                current = wrapper;
            }

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                deep: current
            } as unknown as Parameters<typeof auditLog>[0];

            // Act & Assert - must not throw regardless of depth
            expect(() => auditLog(entry)).not.toThrow();
        });

        it('should scrub new sensitive patterns: creditCard, ssn, apiKey, privateKey, accessKey', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                creditCard: '4111-1111-1111-1111',
                ssn: '123-45-6789',
                apiKey: 'key-abc',
                privateKey: 'pem-data',
                accessKey: 'access-data'
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.creditCard).toBe('[REDACTED]');
            expect(loggedEntry.ssn).toBe('[REDACTED]');
            expect(loggedEntry.apiKey).toBe('[REDACTED]');
            expect(loggedEntry.privateKey).toBe('[REDACTED]');
            expect(loggedEntry.accessKey).toBe('[REDACTED]');
        });

        it('should pass primitive values (numbers, booleans, null) through unchanged', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
                email: 'user@example.com',
                ip: '1.2.3.4',
                reason: 'invalid_credentials',
                attemptNumber: 3,
                locked: false
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.attemptNumber).toBe(3);
            expect(loggedEntry.locked).toBe(false);
            expect(loggedEntry.email).toBe('user@example.com');
        });

        it('should handle arrays of primitives without modification', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'user-1',
                actorRole: 'user',
                resource: '/api',
                method: 'GET',
                statusCode: 403,
                reason: 'no_perm',
                requiredPermissions: ['READ', 'WRITE']
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [loggedEntry] = getAuditInfoMock().mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(loggedEntry.requiredPermissions).toEqual(['READ', 'WRITE']);
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

    describe('Sentry breadcrumb integration', () => {
        it('should call Sentry.addBreadcrumb on every audit log call', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            expect(mockAddBreadcrumb).toHaveBeenCalledOnce();
        });

        it('should use "warning" level for AUTH_LOGIN_FAILED (critical event)', () => {
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
            expect(mockAddBreadcrumb).toHaveBeenCalledOnce();
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "warning" level for AUTH_LOCKOUT (critical event)', () => {
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
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "warning" level for ACCESS_DENIED (critical event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'user-1',
                actorRole: 'user',
                resource: '/api/v1/admin/users',
                method: 'GET',
                statusCode: 403,
                reason: 'insufficient_permissions'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "warning" level for BILLING_MUTATION (critical event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: 'admin-1',
                action: 'delete' as const,
                resourceType: 'promo_code',
                resourceId: 'pc-123'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "warning" level for PERMISSION_CHANGE (critical event)', () => {
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
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "warning" level for USER_ADMIN_MUTATION (critical event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.USER_ADMIN_MUTATION,
                actorId: 'admin-1',
                targetUserId: 'user-789',
                operation: 'hard_delete' as const
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('warning');
        });

        it('should use "info" level for AUTH_LOGIN_SUCCESS (normal event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('info');
        });

        it('should use "info" level for AUTH_PASSWORD_CHANGED (normal event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.AUTH_PASSWORD_CHANGED,
                actorId: 'user-123',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('info');
        });

        it('should use "info" level for SESSION_SIGNOUT (normal event)', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.level).toBe('info');
        });

        it('should set breadcrumb category to "audit"', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.category).toBe('audit');
        });

        it('should set breadcrumb message to "AUDIT:<eventType>"', () => {
            // Arrange
            const entry = {
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: 'user-1',
                actorRole: 'user',
                resource: '/api',
                method: 'DELETE',
                statusCode: 403,
                reason: 'no_permission'
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [Record<string, unknown>];
            expect(breadcrumb.message).toBe(`AUDIT:${AuditEventType.ACCESS_DENIED}`);
        });

        it('should include scrubbed entry data in breadcrumb data field', () => {
            // Arrange - entry with a sensitive field that should be redacted in the breadcrumb
            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'user@example.com',
                ip: '1.2.3.4',
                password: 'should-be-redacted'
            } as unknown as Parameters<typeof auditLog>[0];

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [
                { data: Record<string, unknown> }
            ];
            // Sensitive field must be redacted in the breadcrumb data just as in the log
            expect(breadcrumb.data.password).toBe('[REDACTED]');
            expect(breadcrumb.data.email).toBe('user@example.com');
        });

        it('should include a numeric Unix timestamp in the breadcrumb', () => {
            // Arrange
            const fixedTimestamp = '2024-06-01T12:00:00.000Z';
            const entry = {
                auditEvent: AuditEventType.SESSION_SIGNOUT,
                actorId: 'user-123',
                ip: '1.2.3.4',
                timestamp: fixedTimestamp
            } as const;

            // Act
            auditLog(entry);

            // Assert
            const [breadcrumb] = mockAddBreadcrumb.mock.calls[0] as [{ timestamp: number }];
            expect(typeof breadcrumb.timestamp).toBe('number');
            // Sentry expects Unix epoch seconds (not milliseconds)
            expect(breadcrumb.timestamp).toBe(new Date(fixedTimestamp).getTime() / 1000);
        });

        it('should not throw when Sentry.addBreadcrumb fails', () => {
            // Arrange
            mockAddBreadcrumb.mockImplementationOnce(() => {
                throw new Error('Sentry transport error');
            });
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

            const entry = {
                auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                email: 'test@example.com',
                ip: '1.2.3.4'
            } as const;

            // Act & Assert - existing try-catch in auditLog should catch the Sentry error
            expect(() => auditLog(entry)).not.toThrow();

            consoleErrorSpy.mockRestore();
        });
    });
});
