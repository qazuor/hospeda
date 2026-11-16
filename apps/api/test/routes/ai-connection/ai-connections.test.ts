/**
 * Route tests for the connected-AI-assistants endpoints (HOS-2184 T-026).
 *
 * The service is mocked; what is under test is the HTTP contract: auth,
 * param handling (a URL-shaped client id included), status mapping, the 204,
 * and the audit record.
 */
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const revokeMock = vi.fn();
const auditLogMock = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        AiConnectionService: vi.fn().mockImplementation(function () {
            return { list: listMock, revoke: revokeMock };
        })
    };
});

vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const orig = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return { ...orig, auditLog: (entry: unknown) => auditLogMock(entry) };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../src/app.js');
const { ServiceError } = await import('@repo/service-core');

const BASE = '/api/v1/protected/ai-connections';
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

function anonymousHeaders(): Record<string, string> {
    return { 'user-agent': 'vitest', accept: 'application/json' };
}

describe('GET /api/v1/protected/ai-connections', () => {
    const app = initApp();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists the actor own connections', async () => {
        listMock.mockResolvedValue({
            data: {
                items: [
                    {
                        clientId: 'client-1',
                        name: 'Claude',
                        uri: null,
                        logoUri: null,
                        scopes: ['mcp'],
                        connectedAt: new Date('2026-11-01T10:00:00Z'),
                        lastUsedAt: null
                    }
                ]
            }
        });

        const res = await app.request(BASE, { headers: headers() });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([
            {
                clientId: 'client-1',
                name: 'Claude',
                uri: null,
                logoUri: null,
                scopes: ['mcp'],
                connectedAt: '2026-11-01T10:00:00.000Z',
                lastUsedAt: null
            }
        ]);
        expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ id: ACTOR_ID }));
    });

    it('answers an empty list when nothing is connected', async () => {
        listMock.mockResolvedValue({ data: { items: [] } });

        const res = await app.request(BASE, { headers: headers() });

        expect(res.status).toBe(200);
        expect((await res.json()).data.items).toEqual([]);
    });

    it('answers 401 without a session and never reads', async () => {
        const res = await app.request(BASE, { headers: anonymousHeaders() });

        expect(res.status).toBe(401);
        expect(listMock).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/v1/protected/ai-connections/{clientId}', () => {
    const app = initApp();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revokes the actor own connection: 204 and an audit record', async () => {
        const removed = { consents: 1, refreshTokens: 2, accessTokens: 0 };
        revokeMock.mockResolvedValue({ data: { clientId: 'client-1', removed } });

        const res = await app.request(`${BASE}/client-1`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(204);
        expect(revokeMock).toHaveBeenCalledWith(expect.objectContaining({ id: ACTOR_ID }), {
            clientId: 'client-1'
        });
        expect(auditLogMock).toHaveBeenCalledWith({
            auditEvent: 'mcp.connection.revoked',
            actorId: ACTOR_ID,
            resourceType: 'oauth_client',
            resourceId: 'client-1',
            removed
        });
    });

    it('accepts a percent-encoded URL client id', async () => {
        const clientId = 'https://claude.ai/oauth/metadata.json';
        revokeMock.mockResolvedValue({
            data: { clientId, removed: { consents: 1, refreshTokens: 0, accessTokens: 0 } }
        });

        const res = await app.request(`${BASE}/${encodeURIComponent(clientId)}`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(204);
        expect(revokeMock).toHaveBeenCalledWith(expect.anything(), { clientId });
    });

    it('answers 404 NOT_FOUND for a client the actor has not connected, without auditing', async () => {
        revokeMock.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'AI connection not found')
        });

        const res = await app.request(`${BASE}/foreign-client`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe('NOT_FOUND');
        expect(auditLogMock).not.toHaveBeenCalled();
    });

    it('answers 401 without a session and never revokes', async () => {
        const res = await app.request(`${BASE}/client-1`, {
            method: 'DELETE',
            headers: anonymousHeaders()
        });

        expect(res.status).toBe(401);
        expect(revokeMock).not.toHaveBeenCalled();
    });
});
