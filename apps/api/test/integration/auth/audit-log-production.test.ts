/**
 * Integration tests for audit log event emission during real API operations.
 *
 * Validates that the auditLog() function is correctly invoked with the
 * expected AuditEventType for authentication, session, and authorization flows.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 *
 * @module audit-log-production-test
 * @see SPEC-026 T-012
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Mock the audit-logger module to capture calls while preserving behavior
// ---------------------------------------------------------------------------

const auditLogSpy = vi.fn();

vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return {
        ...original,
        auditLog: (...args: Parameters<typeof original.auditLog>) => {
            auditLogSpy(...args);
            return original.auditLog(...args);
        }
    };
});

// Re-import AuditEventType after mock setup so references are correct
const { AuditEventType } = await import('../../../src/utils/audit-logger');

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let app: AppOpenAPI;
const uniqueSuffix = Date.now();
const testEmail = `audit-test-${uniqueSuffix}@example.com`;
const testPassword = 'AuditTestPass123!';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
    validateApiEnv();
    app = initApp();
    await testDb.setup();
});

afterAll(async () => {
    await testDb.teardown();
    vi.restoreAllMocks();
});

beforeEach(() => {
    auditLogSpy.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a test user via Better Auth signup endpoint.
 * Returns the session cookie from the signup response.
 */
async function signUpUser(params: {
    email: string;
    password: string;
    name: string;
}): Promise<string> {
    const res = await app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        },
        body: JSON.stringify({
            email: params.email,
            password: params.password,
            name: params.name
        })
    });

    const setCookie = res.headers.get('set-cookie');
    return setCookie?.split(';')[0] ?? '';
}

/**
 * Signs in with the given credentials via Better Auth.
 * Returns the session cookie value.
 */
async function signIn(params: {
    email: string;
    password: string;
}): Promise<{ cookie: string; status: number }> {
    const res = await app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        },
        body: JSON.stringify({
            email: params.email,
            password: params.password
        })
    });

    const setCookie = res.headers.get('set-cookie');
    return {
        cookie: setCookie?.split(';')[0] ?? '',
        status: res.status
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Audit log production integration tests [SPEC-026 T-012]', () => {
    it('should emit AUTH_LOGIN_FAILED audit event on bad credentials', async () => {
        // Arrange: create a user so the email exists
        await signUpUser({
            email: testEmail,
            password: testPassword,
            name: 'Audit Test User'
        });
        auditLogSpy.mockClear();

        // Act: attempt sign-in with wrong password
        const { status } = await signIn({
            email: testEmail,
            password: 'WrongPassword999!'
        });

        // Assert: login should fail (non-200 or Better Auth error)
        expect(status).not.toBe(200);

        // Assert: auditLog was called with AUTH_LOGIN_FAILED
        const failedCall = auditLogSpy.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as { auditEvent: string }).auditEvent === AuditEventType.AUTH_LOGIN_FAILED
        );
        expect(failedCall).toBeDefined();
        expect(failedCall?.[0]).toMatchObject({
            auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
            email: testEmail,
            reason: 'invalid_credentials'
        });
        expect(failedCall?.[0]).toHaveProperty('ip');
        expect(failedCall?.[0]).toHaveProperty('attemptNumber');
        expect(failedCall?.[0]).toHaveProperty('locked');
    });

    it('should emit AUTH_LOGIN_SUCCESS audit event on successful login', async () => {
        // Arrange: user already exists from previous test
        auditLogSpy.mockClear();

        // Act: sign in with correct credentials
        const { status } = await signIn({
            email: testEmail,
            password: testPassword
        });

        // Assert: login should succeed
        expect(status).toBe(200);

        // Assert: auditLog was called with AUTH_LOGIN_SUCCESS
        const successCall = auditLogSpy.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as { auditEvent: string }).auditEvent === AuditEventType.AUTH_LOGIN_SUCCESS
        );
        expect(successCall).toBeDefined();
        expect(successCall?.[0]).toMatchObject({
            auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
            email: testEmail
        });
        expect(successCall?.[0]).toHaveProperty('ip');
    });

    it('should emit SESSION_SIGNOUT audit event on signout', async () => {
        // Arrange: sign in to get a valid session
        const { cookie } = await signIn({
            email: testEmail,
            password: testPassword
        });
        auditLogSpy.mockClear();

        // Act: call Hospeda signout endpoint (emits SESSION_SIGNOUT if user is resolved)
        const signoutRes = await app.request('/api/v1/auth/signout', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest'
            }
        });

        // Assert: signout responded successfully
        expect(signoutRes.status).toBe(200);

        // Assert: auditLog was called with SESSION_SIGNOUT
        const signoutCall = auditLogSpy.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as { auditEvent: string }).auditEvent === AuditEventType.SESSION_SIGNOUT
        );
        expect(signoutCall).toBeDefined();
        expect(signoutCall?.[0]).toMatchObject({
            auditEvent: AuditEventType.SESSION_SIGNOUT
        });
        expect(signoutCall?.[0]).toHaveProperty('actorId');
        expect(signoutCall?.[0]).toHaveProperty('ip');
    });

    it('should emit ACCESS_DENIED audit event when accessing admin route without permissions', async () => {
        // Arrange: sign in as a regular user (no admin permissions)
        const { cookie } = await signIn({
            email: testEmail,
            password: testPassword
        });
        auditLogSpy.mockClear();

        // Act: try to access an admin-only route
        const adminRes = await app.request('/api/v1/admin/users', {
            method: 'GET',
            headers: {
                cookie,
                'user-agent': 'vitest',
                accept: 'application/json'
            }
        });

        // Assert: should be forbidden (401 for unresolved auth or 403 for insufficient permissions)
        expect([401, 403]).toContain(adminRes.status);

        // Assert: auditLog was called with ACCESS_DENIED
        const deniedCall = auditLogSpy.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as { auditEvent: string }).auditEvent === AuditEventType.ACCESS_DENIED
        );
        expect(deniedCall).toBeDefined();
        expect(deniedCall?.[0]).toMatchObject({
            auditEvent: AuditEventType.ACCESS_DENIED
        });
        expect(deniedCall?.[0]).toHaveProperty('resource');
        expect(deniedCall?.[0]).toHaveProperty('method');
        expect(deniedCall?.[0]).toHaveProperty('statusCode');
        expect(deniedCall?.[0]).toHaveProperty('reason');
    });
});
