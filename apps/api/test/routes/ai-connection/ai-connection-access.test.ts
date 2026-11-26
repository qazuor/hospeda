/**
 * HOS-2184 phase B T-041 (API half) — `GET /api/v1/protected/ai-connections/access`:
 * the session user's `{ hasAccess, vertical? }`, decided by the same
 * `resolveAiAssistantAccess` the MCP tools run (mocked here; its own suite is
 * `test/mcp/access/ai-assistant-access.test.ts`).
 *
 * @module test/routes/ai-connection/ai-connection-access
 */
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));

vi.mock('../../../src/mcp/access/ai-assistant-access', () => ({
    resolveAiAssistantAccess: resolveMock
}));
// The real `ServiceError`: the global setup swaps it for a stand-in the route
// error handler does not recognise, which would turn every thrown error into a 500.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>())
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../src/app.js');

const URL = '/api/v1/protected/ai-connections/access';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function headers(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

describe('GET /api/v1/protected/ai-connections/access', () => {
    const app = initApp();

    beforeEach(() => {
        resolveMock.mockReset();
    });

    it('answers hasAccess true when a plan grants the assistant', async () => {
        // Arrange
        resolveMock.mockResolvedValue({ kind: 'GRANTED', hasAccess: true, vertical: 'venue' });

        // Act
        const res = await app.request(URL, { headers: headers() });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ hasAccess: true });
        expect(resolveMock).toHaveBeenCalledWith({ userId: ACTOR_ID });
    });

    it('answers hasAccess true for an account the gate does not apply to', async () => {
        // Arrange
        resolveMock.mockResolvedValue({ kind: 'NOT_GATED', hasAccess: true });

        // Act
        const res = await app.request(URL, { headers: headers() });

        // Assert
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ hasAccess: true });
    });

    it('answers hasAccess false and the plans vertical when the owner plans do not include it', async () => {
        // Arrange
        resolveMock.mockResolvedValue({ kind: 'REFUSED', hasAccess: false, vertical: 'venue' });

        // Act
        const res = await app.request(URL, { headers: headers() });

        // Assert
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ hasAccess: false, vertical: 'venue' });
    });

    it('answers 503 SERVICE_UNAVAILABLE, never a false, when it cannot be decided', async () => {
        // Arrange
        resolveMock.mockResolvedValue({ kind: 'UNAVAILABLE', hasAccess: false });

        // Act
        const res = await app.request(URL, { headers: headers() });

        // Assert
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
    });

    it('answers 401 without a session and decides nothing', async () => {
        // Act
        const res = await app.request(URL, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        // Assert
        expect(res.status).toBe(401);
        expect(resolveMock).not.toHaveBeenCalled();
    });
});
