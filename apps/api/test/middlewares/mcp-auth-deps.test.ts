/**
 * HOS-2184 T-008 — production seams of the MCP bearer middleware:
 * the resource-client verifier, the grant (revocation) check and the user
 * lookup. The Better Auth instance and the resource client are replaced at
 * their module boundary; `getDb` is the global `@repo/db` mock, pointed at a
 * per-test chain.
 */

import { getDb } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    authInstanceStub,
    getAuthMock,
    findOneMock,
    verifyAccessTokenRequestMock,
    resourceClientMock
} = vi.hoisted(() => {
    const findOne = vi.fn();
    const verify = vi.fn();
    const authInstance = {
        $context: Promise.resolve({
            baseURL: 'https://api.test/api/auth',
            adapter: { findOne }
        })
    };
    return {
        findOneMock: findOne,
        verifyAccessTokenRequestMock: verify,
        authInstanceStub: authInstance,
        getAuthMock: vi.fn(() => authInstance),
        resourceClientMock: vi.fn((_auth: unknown) => ({
            getActions: () => ({ verifyAccessTokenRequest: verify })
        }))
    };
});

vi.mock('../../src/lib/auth', () => ({ getAuth: getAuthMock }));
vi.mock('@better-auth/oauth-provider/resource-client', () => ({
    oauthProviderResourceClient: resourceClientMock
}));

import {
    createDefaultMcpAccessTokenVerifier,
    findActiveMcpGrant,
    findMcpUser
} from '../../src/middlewares/mcp-auth';

const USER_ID = '43a7b0fb-bde8-4109-a553-1134f2f917fd';
const CLIENT_ID = 'https://claude.ai/oauth/mcp-client-metadata';

/** An `APIError`-shaped 401, as the resource client throws for a bad token. */
function unauthorizedApiError(): Error {
    const error = new Error('invalid access token') as Error & {
        status: string;
        statusCode: number;
    };
    error.name = 'APIError';
    error.status = 'UNAUTHORIZED';
    error.statusCode = 401;
    return error;
}

describe('createDefaultMcpAccessTokenVerifier', () => {
    beforeEach(() => {
        verifyAccessTokenRequestMock.mockReset();
    });

    it('verifies in process with issuer, audience and at+jwt, and no jwksUrl', async () => {
        // Arrange
        verifyAccessTokenRequestMock.mockResolvedValueOnce({ sub: USER_ID });
        const request = new Request('https://api.test/mcp', { method: 'POST' });

        // Act
        const result = await createDefaultMcpAccessTokenVerifier()({
            request,
            audience: 'https://api.test/mcp'
        });

        // Assert
        expect(result).toEqual({ valid: true, claims: { sub: USER_ID } });
        expect(resourceClientMock).toHaveBeenCalledTimes(1);
        expect(resourceClientMock.mock.calls[0]?.[0]).toBe(authInstanceStub);
        expect(verifyAccessTokenRequestMock).toHaveBeenCalledWith(request, {
            verifyOptions: {
                issuer: 'https://api.test/api/auth',
                audience: 'https://api.test/mcp',
                typ: 'at+jwt'
            }
        });
    });

    it('maps a 401 APIError to an invalid token', async () => {
        // Arrange
        verifyAccessTokenRequestMock.mockRejectedValueOnce(unauthorizedApiError());

        // Act
        const result = await createDefaultMcpAccessTokenVerifier()({
            request: new Request('https://api.test/mcp'),
            audience: 'https://api.test/mcp'
        });

        // Assert
        expect(result).toEqual({ valid: false });
    });

    it('rethrows any other failure', async () => {
        // Arrange
        verifyAccessTokenRequestMock.mockRejectedValueOnce(new Error('JWKS fetch failed'));

        // Act
        const act = createDefaultMcpAccessTokenVerifier()({
            request: new Request('https://api.test/mcp'),
            audience: 'https://api.test/mcp'
        });

        // Assert
        await expect(act).rejects.toThrow('JWKS fetch failed');
    });
});

describe('findActiveMcpGrant (revocation check)', () => {
    beforeEach(() => {
        findOneMock.mockReset();
    });

    it('returns the client name when client and consent exist', async () => {
        // Arrange
        findOneMock
            .mockResolvedValueOnce({ clientId: CLIENT_ID, name: 'Claude', disabled: false })
            .mockResolvedValueOnce({ id: 'consent-1' });

        // Act
        const grant = await findActiveMcpGrant({ clientId: CLIENT_ID, userId: USER_ID });

        // Assert
        expect(grant).toEqual({ clientName: 'Claude' });
        expect(findOneMock).toHaveBeenNthCalledWith(1, {
            model: 'oauthClient',
            where: [{ field: 'clientId', value: CLIENT_ID }]
        });
        expect(findOneMock).toHaveBeenNthCalledWith(2, {
            model: 'oauthConsent',
            where: [
                { field: 'clientId', value: CLIENT_ID },
                { field: 'userId', value: USER_ID }
            ]
        });
    });

    it('treats a revoked (deleted) consent as no grant', async () => {
        // Arrange
        findOneMock
            .mockResolvedValueOnce({ clientId: CLIENT_ID, name: 'Claude', disabled: false })
            .mockResolvedValueOnce(null);

        // Act
        const grant = await findActiveMcpGrant({ clientId: CLIENT_ID, userId: USER_ID });

        // Assert
        expect(grant).toBeNull();
    });

    it('treats a disabled client as no grant, without reading the consent', async () => {
        // Arrange
        findOneMock.mockResolvedValueOnce({ clientId: CLIENT_ID, name: 'Claude', disabled: true });

        // Act
        const grant = await findActiveMcpGrant({ clientId: CLIENT_ID, userId: USER_ID });

        // Assert
        expect(grant).toBeNull();
        expect(findOneMock).toHaveBeenCalledTimes(1);
    });

    it('treats an unknown client as no grant', async () => {
        // Arrange
        findOneMock.mockResolvedValueOnce(null);

        // Act
        const grant = await findActiveMcpGrant({ clientId: CLIENT_ID, userId: USER_ID });

        // Assert
        expect(grant).toBeNull();
    });

    it('returns a null name when the client has none', async () => {
        // Arrange
        findOneMock
            .mockResolvedValueOnce({ clientId: CLIENT_ID, disabled: null })
            .mockResolvedValueOnce({ id: 'consent-1' });

        // Act
        const grant = await findActiveMcpGrant({ clientId: CLIENT_ID, userId: USER_ID });

        // Assert
        expect(grant).toEqual({ clientName: null });
    });
});

describe('findMcpUser', () => {
    /** Points the global `getDb` mock at a chain resolving to `rows`. */
    function givenRows(rows: readonly Record<string, unknown>[]): void {
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        vi.mocked(getDb).mockReturnValueOnce({ select } as unknown as ReturnType<typeof getDb>);
    }

    const LIVE_ROW = {
        id: USER_ID,
        name: 'Ana',
        email: 'ana@test.dev',
        image: null,
        emailVerified: true,
        mustChangePassword: false,
        deletedAt: null,
        banned: false,
        banExpires: null
    };

    it('returns the actor source fields of a live account', async () => {
        // Arrange
        givenRows([LIVE_ROW]);

        // Act
        const user = await findMcpUser({ userId: USER_ID });

        // Assert
        expect(user).toEqual({
            id: USER_ID,
            name: 'Ana',
            email: 'ana@test.dev',
            image: null,
            emailVerified: true,
            mustChangePassword: false
        });
    });

    it('refuses a missing account', async () => {
        // Arrange
        givenRows([]);

        // Act + Assert
        expect(await findMcpUser({ userId: USER_ID })).toBeNull();
    });

    it('refuses a soft-deleted account', async () => {
        // Arrange
        givenRows([{ ...LIVE_ROW, deletedAt: new Date('2026-11-01T00:00:00Z') }]);

        // Act + Assert
        expect(await findMcpUser({ userId: USER_ID })).toBeNull();
    });

    it('refuses a banned account with no expiry', async () => {
        // Arrange
        givenRows([{ ...LIVE_ROW, banned: true, banExpires: null }]);

        // Act + Assert
        expect(await findMcpUser({ userId: USER_ID })).toBeNull();
    });

    it('refuses a banned account whose ban has not expired', async () => {
        // Arrange
        givenRows([{ ...LIVE_ROW, banned: true, banExpires: new Date(Date.now() + 60_000) }]);

        // Act + Assert
        expect(await findMcpUser({ userId: USER_ID })).toBeNull();
    });

    it('accepts an account whose ban has expired', async () => {
        // Arrange
        givenRows([{ ...LIVE_ROW, banned: true, banExpires: new Date(Date.now() - 60_000) }]);

        // Act + Assert
        expect(await findMcpUser({ userId: USER_ID })).not.toBeNull();
    });
});
