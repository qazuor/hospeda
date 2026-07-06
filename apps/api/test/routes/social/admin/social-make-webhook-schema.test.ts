/**
 * Tests for GET /api/v1/admin/social/make-webhook-schema — HOS-67 (SPEC-297d) G-6.
 *
 * Two test groups:
 *  1. Unit tests for the pure `buildMakeWebhookSchemaDoc()` helper: asserts the
 *     payload/response JSON Schemas are GENERATED from the canonical Zod schemas
 *     in `@repo/schemas` (AC-1) — the expected property set is derived from the
 *     Zod schema's own `.shape`, so a field added/removed there is reflected here
 *     automatically, proving the schema is not hand-written.
 *  2. Route-level tests: the handler exposes the vault-backed webhook URL + API
 *     key (owner-approved), returns null when a credential is unconfigured, and
 *     is gated by SOCIAL_SETTINGS_MANAGE.
 *
 * @module test/routes/social/admin/social-make-webhook-schema
 * @see HOS-67 (SPEC-297d) G-6, AC-1
 */

import { MakeWebhookResponseSchema, PermissionEnum, SocialMakePayloadSchema } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs (capture route config + stub the vault before any import runs)
// ---------------------------------------------------------------------------

const { capturedConfigs, mockGetDecrypted } = vi.hoisted(() => ({
    capturedConfigs: new Map<string, Record<string, unknown>>(),
    mockGetDecrypted: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: Record<string, unknown>) => {
        capturedConfigs.set(`${config.method}:${config.path}`, config);
        return { route: vi.fn(), use: vi.fn(), openapi: vi.fn() };
    })
}));

vi.mock('../../../../src/services/social-credential-vault.service', () => ({
    getDecryptedSocialCredential: mockGetDecrypted
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

// Trigger module execution so createAdminRoute is called and the config captured
await import('../../../../src/routes/social/admin/make-webhook-schema');

// Import the pure helper directly for unit testing
import { buildMakeWebhookSchemaDoc } from '../../../../src/routes/social/admin/make-webhook-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RouteHandler = (
    ctx: unknown,
    params: unknown,
    body: unknown,
    query?: unknown
) => Promise<unknown>;

function getConfig(method: string, path: string): Record<string, unknown> {
    const config = capturedConfigs.get(`${method}:${path}`);
    if (!config) throw new Error(`No route config captured for ${method}:${path}`);
    return config;
}

function getHandler(method: string, path: string): RouteHandler {
    return getConfig(method, path).handler as RouteHandler;
}

// ---------------------------------------------------------------------------
// 1. Unit tests: buildMakeWebhookSchemaDoc()
// ---------------------------------------------------------------------------

describe('buildMakeWebhookSchemaDoc() — unit', () => {
    it('returns the outbound header name x-make-apikey', () => {
        const doc = buildMakeWebhookSchemaDoc();
        expect(doc.headerName).toBe('x-make-apikey');
    });

    it('payloadSchema is a generated JSON Schema whose properties match SocialMakePayloadSchema (AC-1)', () => {
        // Act
        const doc = buildMakeWebhookSchemaDoc();

        // Assert — property set is derived from the Zod schema, not hand-written.
        // Deriving the expected keys from the schema's own shape means adding or
        // removing a field on SocialMakePayloadSchema changes this expectation
        // automatically — proving the endpoint output is generated.
        const props = (doc.payloadSchema as { properties?: Record<string, unknown> }).properties;
        expect(props).toBeDefined();
        const expectedKeys = Object.keys(SocialMakePayloadSchema.shape).sort();
        expect(Object.keys(props ?? {}).sort()).toEqual(expectedKeys);
    });

    it('payloadSchema carries a known field from the Zod source (makeChannelKey)', () => {
        const doc = buildMakeWebhookSchemaDoc();
        const props = (doc.payloadSchema as { properties?: Record<string, unknown> }).properties;
        // makeChannelKey exists in SocialMakePayloadSchema; if it were hand-written
        // and drifted, this would fail.
        expect(props).toHaveProperty('makeChannelKey');
        expect(props).toHaveProperty('targetId');
        expect(props).toHaveProperty('mediaUrls');
    });

    it('responseSchema is the generated SUCCESS/FAILED discriminated union', () => {
        const doc = buildMakeWebhookSchemaDoc();
        // discriminatedUnion → anyOf/oneOf of the two branches; both status
        // literals must be present in the generated document.
        const json = JSON.stringify(doc.responseSchema);
        expect(json).toContain('SUCCESS');
        expect(json).toContain('FAILED');
        const rs = doc.responseSchema as { anyOf?: unknown[]; oneOf?: unknown[] };
        const branches = rs.anyOf ?? rs.oneOf;
        expect(Array.isArray(branches)).toBe(true);
        expect((branches as unknown[]).length).toBe(MakeWebhookResponseSchema.options.length);
    });

    it('does not throw on the z.date() field (unrepresentable: any keeps generation safe)', () => {
        // scheduledAt is a z.date() — generation must not throw.
        expect(() => buildMakeWebhookSchemaDoc()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 2. Route config + handler
// ---------------------------------------------------------------------------

describe('adminGetMakeWebhookSchemaRoute — config + handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is gated by the SOCIAL_SETTINGS_MANAGE permission', () => {
        const config = getConfig('get', '/');
        const perms = config.requiredPermissions as unknown[];
        expect(Array.isArray(perms)).toBe(true);
        expect(perms).toContain(PermissionEnum.SOCIAL_SETTINGS_MANAGE);
    });

    it('exposes the vault webhook URL and API key when configured', async () => {
        // Arrange — vault returns plaintext for both keys
        mockGetDecrypted.mockImplementation(async ({ key }: { key: string }) => ({
            data: {
                key,
                plaintext:
                    key === 'make_webhook_url'
                        ? 'https://hook.eu1.make.test/abc123'
                        : 'make-secret-key-xyz'
            }
        }));
        const handler = getHandler('get', '/');

        // Act
        const result = (await handler({}, {}, {})) as Record<string, unknown>;

        // Assert
        expect(result.webhookUrl).toEqual({
            value: 'https://hook.eu1.make.test/abc123',
            status: 'ok'
        });
        expect(result.makeApiKey).toEqual({ value: 'make-secret-key-xyz', status: 'ok' });
        expect(result.headerName).toBe('x-make-apikey');
        expect(result.payloadSchema).toBeDefined();
        expect(result.responseSchema).toBeDefined();
        // The vault was consulted for exactly the two Make credentials
        expect(mockGetDecrypted).toHaveBeenCalledWith({ key: 'make_webhook_url' });
        expect(mockGetDecrypted).toHaveBeenCalledWith({ key: 'make_api_key' });
    });

    it('marks credentials as "missing" when the vault has no credential (NOT_FOUND)', async () => {
        // Arrange — vault returns NOT_FOUND (never configured) for every key
        mockGetDecrypted.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'no credential' }
        });
        const handler = getHandler('get', '/');

        // Act
        const result = (await handler({}, {}, {})) as Record<string, unknown>;

        // Assert — a genuinely-unconfigured credential is 'missing', value null
        expect(result.webhookUrl).toEqual({ value: null, status: 'missing' });
        expect(result.makeApiKey).toEqual({ value: null, status: 'missing' });
        // The generated schemas are still present even without credentials
        expect(result.payloadSchema).toBeDefined();
        expect(result.responseSchema).toBeDefined();
    });

    it('marks credentials as "error" (not "missing") when the vault read fails', async () => {
        // Arrange — decrypt/DB failure (e.g. misconfigured vault master key)
        mockGetDecrypted.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'decrypt failed' }
        });
        const handler = getHandler('get', '/');

        // Act
        const result = (await handler({}, {}, {})) as Record<string, unknown>;

        // Assert — a read failure must NOT be conflated with "not configured"
        expect(result.webhookUrl).toEqual({ value: null, status: 'error' });
        expect(result.makeApiKey).toEqual({ value: null, status: 'error' });
    });
});
