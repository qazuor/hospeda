/**
 * Unit tests for the MCP OAuth authorization-server builder (HOS-2184 T-004).
 *
 * Covers the pure pieces of `src/lib/auth-mcp-oauth.ts`: the redirect-URI
 * allowlist, the `oauthProvider()` options (audience, PKCE, DCR, pages) and
 * the flag gate that keeps Better Auth's options unchanged when the MCP
 * server is off.
 */

import { describe, expect, it } from 'vitest';
import {
    buildMcpOAuthConfig,
    buildMcpOAuthProviderOptions,
    isAllowedMcpRedirectUri,
    MCP_ALLOWED_REDIRECT_URIS,
    MCP_OAUTH_CONSENT_PATH,
    MCP_OAUTH_LOGIN_PATH
} from '../../src/lib/auth-mcp-oauth';

const RESOURCE_URL = 'https://staging-api.hospeda.com.ar/mcp';
const SITE_URL = 'https://staging.hospeda.com.ar';
/** Every user is a real client unless a test says otherwise (HOS-2562). */
const IS_CLIENT = async () => true;

describe('isAllowedMcpRedirectUri', () => {
    it.each([
        'https://claude.ai/api/mcp/auth_callback',
        'https://claude.com/api/mcp/auth_callback',
        'https://chatgpt.com/connector_platform_oauth_redirect'
    ])('accepts the hosted-client callback %s', (redirectUri) => {
        // Arrange / Act
        const allowed = isAllowedMcpRedirectUri({ redirectUri });

        // Assert
        expect(allowed).toBe(true);
    });

    it('lists exactly the Claude and ChatGPT callbacks', () => {
        // Arrange / Act / Assert
        expect([...MCP_ALLOWED_REDIRECT_URIS]).toEqual([
            'https://claude.ai/api/mcp/auth_callback',
            'https://claude.com/api/mcp/auth_callback',
            'https://chatgpt.com/connector_platform_oauth_redirect'
        ]);
    });

    it("accepts ChatGPT's callback-ID redirect", () => {
        // Arrange / Act
        const allowed = isAllowedMcpRedirectUri({
            redirectUri: 'https://chatgpt.com/connector/oauth/abc_DEF-123'
        });

        // Assert
        expect(allowed).toBe(true);
    });

    it.each([
        'http://127.0.0.1:53682/callback',
        'http://127.0.0.1:1/oauth/callback',
        'http://localhost:33418/callback',
        'http://localhost:65535/',
        'http://localhost/callback'
    ])('accepts loopback on any port: %s', (redirectUri) => {
        // Arrange / Act
        const allowed = isAllowedMcpRedirectUri({ redirectUri });

        // Assert
        expect(allowed).toBe(true);
    });

    it.each([
        ['an arbitrary host', 'https://evil.example/api/mcp/auth_callback'],
        ['a lookalike Claude host', 'https://claude.ai.evil.example/api/mcp/auth_callback'],
        ['a different Claude path', 'https://claude.ai/api/mcp/other'],
        ['http on a hosted callback', 'http://claude.ai/api/mcp/auth_callback'],
        ['a Claude callback with a query', 'https://claude.ai/api/mcp/auth_callback?x=1'],
        ['a nested ChatGPT callback-ID path', 'https://chatgpt.com/connector/oauth/a/b'],
        ['an empty ChatGPT callback ID', 'https://chatgpt.com/connector/oauth/'],
        ['https on loopback', 'https://localhost:3000/callback'],
        ['a private LAN address', 'http://192.168.1.10:8080/callback'],
        ['IPv6 loopback', 'http://[::1]:8080/callback'],
        ['loopback with credentials', 'http://user:pass@127.0.0.1:8080/callback'],
        ['loopback with a fragment', 'http://127.0.0.1:8080/callback#frag'],
        ['loopback with an empty fragment', 'http://127.0.0.1:8080/callback#'],
        ['a custom scheme', 'hospeda://oauth/callback'],
        ['a malformed URI', 'not a url']
    ])('rejects %s', (_label, redirectUri) => {
        // Arrange / Act
        const allowed = isAllowedMcpRedirectUri({ redirectUri });

        // Assert
        expect(allowed).toBe(false);
    });
});

describe('buildMcpOAuthProviderOptions', () => {
    it('binds tokens to the MCP resource URL and nothing else', () => {
        // Arrange / Act
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });

        // Assert
        expect(options.resources).toEqual([RESOURCE_URL]);
    });

    it('requires PKCE for dynamically registered clients', () => {
        // Arrange / Act
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });

        // Assert
        expect(options.clientRegistrationRequirePKCE).toBe(true);
    });

    it('enables open dynamic client registration as the CIMD fallback', () => {
        // Arrange / Act
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });

        // Assert
        expect(options.allowDynamicClientRegistration).toBe(true);
        expect(options.allowUnauthenticatedClientRegistration).toBe(true);
        expect(options.enforcePerClientResources).toBe(false);
        expect(options.clientRegistrationDefaultApplicationType).toBe('infer');
    });

    it('serves only user grants, with offline_access for refresh tokens', () => {
        // Arrange / Act
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });

        // Assert
        expect(options.grantTypes).toEqual(['authorization_code', 'refresh_token']);
        expect(options.scopes).toContain('offline_access');
    });

    it('points login and consent at the web app, trimming a trailing slash', () => {
        // Arrange / Act
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: `${SITE_URL}/`,
            isRealClientForUser: IS_CLIENT
        });

        // Assert
        expect(options.loginPage).toBe(`${SITE_URL}${MCP_OAUTH_LOGIN_PATH}`);
        expect(options.consentPage).toBe(`${SITE_URL}${MCP_OAUTH_CONSENT_PATH}`);
        expect(options.loginPage).toBe('https://staging.hospeda.com.ar/es/auth/signin/');
    });

    it('accepts a redirect only when it is registered AND allowlisted', async () => {
        // Arrange
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });
        const validate = options.validateRedirectUri;
        const claude = 'https://claude.ai/api/mcp/auth_callback';
        const foreign = 'https://evil.example/cb';

        // Act
        const results = await Promise.all([
            validate?.(claude, [claude], true),
            validate?.(claude, [], false),
            validate?.(foreign, [foreign], true)
        ]);

        // Assert
        expect(results).toEqual([true, false, false]);
    });
});

describe('buildMcpOAuthConfig', () => {
    it.each([
        ['false', false],
        ['undefined (env mocked without the flag)', undefined]
    ])('registers nothing when the flag is %s', (_label, enabled) => {
        // Arrange / Act
        const config = buildMcpOAuthConfig({
            enabled,
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL
        });

        // Assert
        expect(config).toEqual({
            enabled: false,
            plugins: [],
            disabledPaths: [],
            oauthProviderOptions: null
        });
    });

    it('does not require the resource URL when the flag is off', () => {
        // Arrange / Act
        const build = () =>
            buildMcpOAuthConfig({ enabled: false, resourceUrl: undefined, siteUrl: SITE_URL });

        // Assert
        expect(build).not.toThrow();
    });

    it('registers jwt, oauth-provider, cimd, the registration guard and the real-client guard, in that order, when on', () => {
        // Arrange / Act
        const config = buildMcpOAuthConfig({
            enabled: true,
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL
        });

        // Assert
        expect(config.enabled).toBe(true);
        expect(config.plugins.map((plugin) => plugin.id)).toEqual([
            'jwt',
            'oauth-provider',
            'cimd',
            'hospeda-mcp-registration-redirect-guard',
            'hospeda-mcp-real-client-guard'
        ]);
        expect(config.oauthProviderOptions?.resources).toEqual([RESOURCE_URL]);
    });

    it("disables the JWT plugin's /token and the user-facing client management endpoints when on", () => {
        // Arrange / Act
        const config = buildMcpOAuthConfig({
            enabled: true,
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL
        });

        // Assert
        expect(config.disabledPaths).toEqual([
            '/token',
            '/oauth2/create-client',
            '/oauth2/update-client',
            '/oauth2/delete-client',
            '/oauth2/client/rotate-secret',
            '/oauth2/client/rotate-keys'
        ]);
        expect(config.disabledPaths).not.toContain('/oauth2/register');
    });

    it('throws when the flag is on without a resource URL', () => {
        // Arrange / Act
        const build = () =>
            buildMcpOAuthConfig({ enabled: true, resourceUrl: undefined, siteUrl: SITE_URL });

        // Assert
        expect(build).toThrow(/HOSPEDA_MCP_RESOURCE_URL is required/);
    });
});

describe('customAccessTokenClaims (HOS-2562 token-issuance gate)', () => {
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'a@example.com' };

    it('issues the token, with no extra claim, for a real client', async () => {
        // Arrange
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: IS_CLIENT
        });

        // Act
        const claims = await options.customAccessTokenClaims?.({
            user,
            scopes: ['openid'],
            resources: [RESOURCE_URL]
        } as unknown as Parameters<NonNullable<typeof options.customAccessTokenClaims>>[0]);

        // Assert
        expect(claims).toEqual({});
    });

    it.each([
        ['a pure tourist', user],
        ['no user (a machine grant)', null]
    ])('refuses to issue a token for %s with 403 access_denied', async (_label, subject) => {
        // Arrange
        const options = buildMcpOAuthProviderOptions({
            resourceUrl: RESOURCE_URL,
            siteUrl: SITE_URL,
            isRealClientForUser: async () => false
        });

        // Act
        const issue = options.customAccessTokenClaims?.({
            user: subject,
            scopes: ['openid'],
            resources: [RESOURCE_URL]
        } as unknown as Parameters<NonNullable<typeof options.customAccessTokenClaims>>[0]);

        // Assert
        await expect(issue).rejects.toMatchObject({
            statusCode: 403,
            body: { error: 'access_denied' }
        });
    });
});
