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
const resolveResetReviewMock = vi.fn();
const auditLogMock = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        AiConnectionService: vi.fn().mockImplementation(function () {
            return {
                list: listMock,
                revoke: revokeMock,
                resolveResetReview: resolveResetReviewMock
            };
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
                pendingResetReview: null,
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
        listMock.mockResolvedValue({ data: { items: [], pendingResetReview: null } });

        const res = await app.request(BASE, { headers: headers() });

        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(data.items).toEqual([]);
        expect(data.pendingResetReview).toBeNull();
    });

    it('carries the pending post-reset review with the pre-reset connections', async () => {
        const connection = {
            clientId: 'old-client',
            name: 'Claude',
            uri: null,
            logoUri: null,
            scopes: ['mcp'],
            connectedAt: new Date('2026-11-01T10:00:00Z'),
            lastUsedAt: null
        };
        listMock.mockResolvedValue({
            data: {
                items: [connection],
                pendingResetReview: {
                    resetAt: new Date('2026-11-10T12:00:00Z'),
                    connectionsBeforeReset: [connection]
                }
            }
        });

        const res = await app.request(BASE, { headers: headers() });

        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(data.pendingResetReview.resetAt).toBe('2026-11-10T12:00:00.000Z');
        expect(
            data.pendingResetReview.connectionsBeforeReset.map(
                (c: { clientId: string }) => c.clientId
            )
        ).toEqual(['old-client']);
    });

    it('answers 401 without a session and never reads', async () => {
        const res = await app.request(BASE, { headers: anonymousHeaders() });

        expect(res.status).toBe(401);
        expect(listMock).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/v1/protected/ai-connections?clientId=', () => {
    const app = initApp();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revokes the actor own connection: 204 and an audit record', async () => {
        const removed = { consents: 1, refreshTokens: 2, accessTokens: 0 };
        revokeMock.mockResolvedValue({ data: { clientId: 'client-1', removed } });

        const res = await app.request(`${BASE}?clientId=client-1`, {
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

        const res = await app.request(`${BASE}?clientId=${encodeURIComponent(clientId)}`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(204);
        expect(revokeMock).toHaveBeenCalledWith(expect.anything(), { clientId });
    });

    it('answers 400 when the clientId query parameter is missing, without revoking', async () => {
        const res = await app.request(BASE, { method: 'DELETE', headers: headers() });

        expect(res.status).toBe(400);
        expect(revokeMock).not.toHaveBeenCalled();
    });

    it('no longer serves the path-param form', async () => {
        const res = await app.request(`${BASE}/client-1`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(404);
        expect(revokeMock).not.toHaveBeenCalled();
    });

    it('answers 404 NOT_FOUND for a client the actor has not connected, without auditing', async () => {
        revokeMock.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'AI connection not found')
        });

        const res = await app.request(`${BASE}?clientId=foreign-client`, {
            method: 'DELETE',
            headers: headers()
        });

        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe('NOT_FOUND');
        expect(auditLogMock).not.toHaveBeenCalled();
    });

    it('answers 401 without a session and never revokes', async () => {
        const res = await app.request(`${BASE}?clientId=client-1`, {
            method: 'DELETE',
            headers: anonymousHeaders()
        });

        expect(res.status).toBe(401);
        expect(revokeMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/v1/protected/ai-connections/reset-review', () => {
    const app = initApp();
    const post = (body: unknown, h: Record<string, string> = headers()) =>
        app.request(`${BASE}/reset-review`, {
            method: 'POST',
            headers: { ...h, 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revoke_previous: answers the revoked ids and audits each with the reset reason', async () => {
        const removed = { consents: 1, refreshTokens: 1, accessTokens: 0 };
        resolveResetReviewMock.mockResolvedValue({
            data: {
                action: 'revoke_previous',
                revokedClientIds: ['old-1', 'old-2'],
                removedByClient: [
                    { clientId: 'old-1', removed },
                    { clientId: 'old-2', removed }
                ]
            }
        });

        const res = await post({ action: 'revoke_previous' });

        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({
            action: 'revoke_previous',
            revokedClientIds: ['old-1', 'old-2']
        });
        expect(resolveResetReviewMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { action: 'revoke_previous' }
        );
        expect(auditLogMock).toHaveBeenCalledTimes(2);
        expect(auditLogMock).toHaveBeenCalledWith({
            auditEvent: 'mcp.connection.revoked',
            actorId: ACTOR_ID,
            resourceType: 'oauth_client',
            resourceId: 'old-1',
            removed,
            reason: 'PASSWORD_RESET_REVIEW'
        });
    });

    it('keep: answers an empty list and audits nothing', async () => {
        resolveResetReviewMock.mockResolvedValue({
            data: { action: 'keep', revokedClientIds: [], removedByClient: [] }
        });

        const res = await post({ action: 'keep' });

        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ action: 'keep', revokedClientIds: [] });
        expect(auditLogMock).not.toHaveBeenCalled();
    });

    it('answers 409 ALREADY_EXISTS with the reason when nothing is pending', async () => {
        resolveResetReviewMock.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'There is no password reset review to answer',
                undefined,
                'NO_PENDING_RESET_REVIEW'
            )
        });

        const res = await post({ action: 'keep' });

        expect(res.status).toBe(409);
        const { error } = await res.json();
        expect(error.code).toBe('ALREADY_EXISTS');
        expect(error.reason).toBe('NO_PENDING_RESET_REVIEW');
        expect(auditLogMock).not.toHaveBeenCalled();
    });

    it.each([
        [{ action: 'nuke' }],
        [{}],
        [{ action: 'keep', clientId: 'x' }]
    ])('answers 400 for the body %j without calling the service', async (body) => {
        const res = await post(body);

        expect(res.status).toBe(400);
        expect(resolveResetReviewMock).not.toHaveBeenCalled();
    });

    it('answers 401 without a session and never resolves', async () => {
        const res = await post({ action: 'keep' }, anonymousHeaders());

        expect(res.status).toBe(401);
        expect(resolveResetReviewMock).not.toHaveBeenCalled();
    });
});
