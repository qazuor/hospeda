/**
 * HOS-2184 T-006: OAuth discovery metadata with the MCP flag on.
 *
 * Better Auth is replaced by a fake whose `api` exposes the two oauth-provider
 * endpoints, so the package helpers (`oauthProviderAuthServerMetadata`,
 * `oauthProviderOpenIdConfigMetadata`) run for real without needing the OAuth
 * tables (HOS-2184 T-005).
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ISSUER = 'https://api.example.test/api/auth';
const RESOURCE_URL = 'https://api.example.test/mcp';

const getOAuthServerConfig = vi.fn(async () => ({ issuer: ISSUER, kind: 'oauth' }));
const getOpenIdConfig = vi.fn(async () => ({ issuer: ISSUER, kind: 'oidc' }));

vi.mock('../../../src/lib/auth', () => ({
    getAuth: () => ({
        api: { getOAuthServerConfig, getOpenIdConfig },
        $context: Promise.resolve({ baseURL: ISSUER })
    })
}));

const mutableEnv = vi.hoisted(() => ({
    HOSPEDA_MCP_ENABLED: true as boolean | undefined,
    HOSPEDA_MCP_RESOURCE_URL: 'https://api.example.test/mcp' as string | undefined
}));
vi.mock('../../../src/utils/env', () => ({ env: mutableEnv }));
vi.mock('../../../src/utils/create-app', () => ({ createRouter: () => new Hono() }));

import {
    AUTH_BASE_PATH,
    MCP_AUTH_SERVER_METADATA_ISSUER_PATH,
    MCP_OPENID_CONFIGURATION_ISSUER_PATH,
    MCP_OPENID_CONFIGURATION_UNDER_ISSUER_PATH
} from '../../../src/lib/mcp-well-known';
import { wellKnownRoutes } from '../../../src/routes/well-known';

const buildApp = () => new Hono().route('/', wellKnownRoutes);

describe('well-known routes with HOSPEDA_MCP_ENABLED on', () => {
    beforeEach(() => {
        mutableEnv.HOSPEDA_MCP_ENABLED = true;
        mutableEnv.HOSPEDA_MCP_RESOURCE_URL = RESOURCE_URL;
        getOAuthServerConfig.mockClear();
        getOpenIdConfig.mockClear();
    });

    afterEach(() => {
        mutableEnv.HOSPEDA_MCP_ENABLED = true;
    });

    it.each([
        '/.well-known/oauth-protected-resource',
        '/.well-known/oauth-protected-resource/mcp'
    ])('serves RFC 9728 metadata on %s', async (path) => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request(path);
        const body = (await res.json()) as Record<string, unknown>;

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(body.authorization_servers).toEqual([ISSUER]);
        expect(body.bearer_methods_supported).toEqual(['header']);
    });

    it('emits resource byte for byte as HOSPEDA_MCP_RESOURCE_URL', async () => {
        // Arrange
        mutableEnv.HOSPEDA_MCP_RESOURCE_URL = 'https://api.example.test/mcp?x=1';
        const app = buildApp();

        // Act
        const res = await app.request('/.well-known/oauth-protected-resource');
        const body = (await res.json()) as { resource: string };

        // Assert
        expect(body.resource).toBe('https://api.example.test/mcp?x=1');
    });

    it('delegates authorization-server metadata to Better Auth', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/.well-known/oauth-authorization-server');

        // Assert
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ issuer: ISSUER, kind: 'oauth' });
        expect(getOAuthServerConfig).toHaveBeenCalledTimes(1);
    });

    it('delegates OpenID configuration to Better Auth', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/.well-known/openid-configuration');

        // Assert
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ issuer: ISSUER, kind: 'oidc' });
        expect(getOpenIdConfig).toHaveBeenCalledTimes(1);
    });

    it.each([
        '/.well-known/oauth-authorization-server/api/auth',
        '/.well-known/openid-configuration/api/auth',
        '/api/auth/.well-known/openid-configuration'
    ])('serves the issuer-path alias %s', async (path) => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request(path);

        // Assert
        expect(res.status).toBe(200);
        expect(((await res.json()) as { issuer: string }).issuer).toBe(ISSUER);
    });

    it('derives the aliases from the issuer pathname', () => {
        // Arrange / Act
        const issuerPath = new URL(ISSUER).pathname;

        // Assert
        expect(AUTH_BASE_PATH).toBe(issuerPath);
        expect(MCP_AUTH_SERVER_METADATA_ISSUER_PATH).toBe(
            `/.well-known/oauth-authorization-server${issuerPath}`
        );
        expect(MCP_OPENID_CONFIGURATION_ISSUER_PATH).toBe(
            `/.well-known/openid-configuration${issuerPath}`
        );
        expect(MCP_OPENID_CONFIGURATION_UNDER_ISSUER_PATH).toBe(
            `${issuerPath}/.well-known/openid-configuration`
        );
    });

    it('answers 404 on every path once the flag is switched off', async () => {
        // Arrange
        mutableEnv.HOSPEDA_MCP_ENABLED = undefined;
        const app = buildApp();

        // Act
        const statuses = await Promise.all(
            [
                '/.well-known/oauth-protected-resource',
                '/.well-known/oauth-protected-resource/mcp',
                '/.well-known/oauth-authorization-server',
                '/.well-known/openid-configuration',
                '/.well-known/oauth-authorization-server/api/auth',
                '/.well-known/openid-configuration/api/auth',
                '/api/auth/.well-known/openid-configuration'
            ].map(async (path) => (await app.request(path)).status)
        );

        // Assert
        expect(statuses).toEqual([404, 404, 404, 404, 404, 404, 404]);
        expect(getOAuthServerConfig).not.toHaveBeenCalled();
    });
});
