/**
 * Tests for GET /api/v1/admin/social/gpt-action-schema — SPEC-254 T-030.
 *
 * Two test groups:
 *  1. Unit tests for the pure `buildGptActionSchema()` helper: asserts the
 *     returned document is a valid OpenAPI 3.1 structure with exactly the two
 *     required operations, the x-hospeda-ai-key security scheme, and enum
 *     values that match the canonical Zod schemas from `@repo/schemas`.
 *  2. Route-level tests: handler returns an OpenAPI 3.1 document that uses the
 *     env.HOSPEDA_API_URL as the server URL (handler-capture pattern used by
 *     sibling tests).
 *
 * @module test/routes/social/admin/social-gpt-action-schema
 * @see SPEC-254 T-030
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs (capture handlers before any import runs)
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >()
}));

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(`${config.method}:${config.path}`, config.handler);
            // Return a minimal Hono-like app stub so callers that do app.route() don't throw
            return { route: vi.fn(), use: vi.fn(), openapi: vi.fn() };
        }
    )
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// Stub env so the route module can be imported without real dotenv parsing
vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_URL: 'https://api.hospeda.test'
    }
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

// Trigger module execution so createAdminRoute is called and handler captured
await import('../../../../src/routes/social/admin/gpt-action-schema');

// Import the pure helper directly for unit testing
import { buildGptActionSchema } from '../../../../src/routes/social/admin/gpt-action-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHandler(
    method: string,
    path: string
): (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown> {
    const key = `${method}:${path}`;
    const h = capturedHandlers.get(key);
    if (!h) throw new Error(`No handler captured for key: ${key}`);
    return h;
}

function buildMockCtx(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

/**
 * Recursively walks an OpenAPI 3.1 document object looking for a property
 * named `enum` whose value is an array. Collects all such arrays found at
 * ANY depth, optionally filtering to those containing a given sentinel value.
 */
function collectEnumArrays(
    node: unknown,
    sentinel?: string,
    visited = new Set<unknown>()
): unknown[][] {
    if (visited.has(node)) return [];
    if (node === null || typeof node !== 'object') return [];
    visited.add(node);

    const results: unknown[][] = [];

    if (Array.isArray(node)) {
        for (const item of node) {
            results.push(...collectEnumArrays(item, sentinel, visited));
        }
        return results;
    }

    const record = node as Record<string, unknown>;

    if ('enum' in record && Array.isArray(record.enum)) {
        if (sentinel === undefined || (record.enum as unknown[]).includes(sentinel)) {
            results.push(record.enum as unknown[]);
        }
    }

    for (const value of Object.values(record)) {
        results.push(...collectEnumArrays(value, sentinel, visited));
    }

    return results;
}

// ---------------------------------------------------------------------------
// 1. Unit tests: buildGptActionSchema()
// ---------------------------------------------------------------------------

describe('buildGptActionSchema() — unit', () => {
    it('returns a document with openapi starting with "3.1"', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        expect(typeof doc.openapi).toBe('string');
        expect(String(doc.openapi)).toMatch(/^3\.1/);
    });

    it('contains exactly 2 paths', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const paths = doc.paths as Record<string, unknown>;
        expect(Object.keys(paths)).toHaveLength(2);
    });

    it('includes the getSocialCatalog operationId on the catalog path', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
        const catalogOp = paths['/api/v1/ai/social/catalog']?.get;
        expect(catalogOp).toBeDefined();
        expect(catalogOp?.operationId).toBe('getSocialCatalog');
    });

    it('includes the saveSocialDraft operationId on the drafts path', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
        const draftOp = paths['/api/v1/ai/social/drafts']?.post;
        expect(draftOp).toBeDefined();
        expect(draftOp?.operationId).toBe('saveSocialDraft');
    });

    it('has a securitySchemes component named HospedaAiKey of type apiKey in header', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const components = doc.components as Record<string, unknown>;
        const schemes = components?.securitySchemes as Record<
            string,
            { type: string; in: string; name: string } | undefined
        >;
        const scheme = schemes?.HospedaAiKey;
        expect(scheme).toBeDefined();
        expect(scheme?.type).toBe('apiKey');
        expect(scheme?.in).toBe('header');
        expect(scheme?.name).toBe('x-hospeda-ai-key');
    });

    it('references HospedaAiKey security on the catalog operation', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
        const security = paths['/api/v1/ai/social/catalog']?.get?.security as unknown[];
        expect(Array.isArray(security)).toBe(true);
        expect(security.length).toBeGreaterThan(0);
        // Each security entry is { schemeName: [] }; HospedaAiKey must appear
        const hasScheme = security.some(
            (s) =>
                typeof s === 'object' &&
                s !== null &&
                'HospedaAiKey' in (s as Record<string, unknown>)
        );
        expect(hasScheme).toBe(true);
    });

    it('references HospedaAiKey security on the drafts operation', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Assert
        const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>>;
        const security = paths['/api/v1/ai/social/drafts']?.post?.security as unknown[];
        expect(Array.isArray(security)).toBe(true);
        const hasScheme = security.some(
            (s) =>
                typeof s === 'object' &&
                s !== null &&
                'HospedaAiKey' in (s as Record<string, unknown>)
        );
        expect(hasScheme).toBe(true);
    });

    it('uses the provided apiBaseUrl in the servers block', () => {
        // Arrange
        const base = 'https://custom.api.example.com';

        // Act
        const doc = buildGptActionSchema(base);

        // Assert
        const servers = doc.servers as Array<{ url: string }>;
        expect(Array.isArray(servers)).toBe(true);
        expect(servers[0]?.url).toBe(base);
    });

    it('falls back to the default server URL when apiBaseUrl is undefined', () => {
        // Arrange / Act
        const doc = buildGptActionSchema(undefined);

        // Assert
        const servers = doc.servers as Array<{ url: string }>;
        expect(servers[0]?.url).toBe('https://api.hospeda.com.ar');
    });

    // -----------------------------------------------------------------------
    // Enum correctness — these assertions catch the hand-transcription bug
    // where invented platform/format/mediaType values slipped into the doc.
    // -----------------------------------------------------------------------

    it('platform enum is EXACTLY [INSTAGRAM, FACEBOOK, X] — no invented values', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Find all enum arrays in the full document that contain 'INSTAGRAM'
        const platformEnums = collectEnumArrays(doc, 'INSTAGRAM');

        // Assert — at least one enum array found
        expect(platformEnums.length).toBeGreaterThan(0);

        // Every platform enum array must be exactly these 3 values (order-independent).
        // Catalog response schemas expose `platform` as nullable (a global hashtag,
        // hashtag-set or footer has no specific platform), so the generated enum may
        // include a trailing `null` marker. That is the nullability signal, not an
        // invented platform value — strip it before asserting the real values.
        const expected = ['INSTAGRAM', 'FACEBOOK', 'X'];
        for (const enumArray of platformEnums) {
            const realValues = enumArray.filter((value) => value !== null);
            expect(realValues.slice().sort()).toEqual(expected.slice().sort());
        }
    });

    it('platform enum does NOT contain TWITTER, TIKTOK, or LINKEDIN', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        const platformEnums = collectEnumArrays(doc, 'INSTAGRAM');
        for (const enumArray of platformEnums) {
            expect(enumArray).not.toContain('TWITTER');
            expect(enumArray).not.toContain('TIKTOK');
            expect(enumArray).not.toContain('LINKEDIN');
        }
    });

    it('publishFormat enum contains FEED_POST (real value)', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Find enum arrays containing a known-real publish format value
        const formatEnums = collectEnumArrays(doc, 'FEED_POST');
        expect(formatEnums.length).toBeGreaterThan(0);

        for (const enumArray of formatEnums) {
            expect(enumArray).toContain('FEED_POST');
        }
    });

    it('publishFormat enum does NOT contain invented value POST', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Collect all enum arrays that contain 'REEL' (real value present in both old and new)
        // and verify none of them contain the invented 'POST' value.
        const formatEnums = collectEnumArrays(doc, 'REEL');
        for (const enumArray of formatEnums) {
            // 'POST' was an invented value; only 'FEED_POST', 'PHOTO_POST', etc. are real
            expect(enumArray).not.toContain('POST');
        }
    });

    it('mediaType enum contains NONE (real value)', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Collect all enum arrays that contain 'NONE'
        const mediaTypeEnums = collectEnumArrays(doc, 'NONE');
        expect(mediaTypeEnums.length).toBeGreaterThan(0);

        for (const enumArray of mediaTypeEnums) {
            expect(enumArray).toContain('NONE');
        }
    });

    it('mediaType enum does NOT contain invented values CAROUSEL or TEXT', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');

        // Find enum arrays that contain 'IMAGE' (present in both mediaType and possibly others)
        // and limit to those whose length matches the real mediaType enum (3 values)
        const mediaTypeEnums = collectEnumArrays(doc, 'IMAGE').filter(
            (arr) => arr.length === 3 && arr.includes('VIDEO') && arr.includes('NONE')
        );
        expect(mediaTypeEnums.length).toBeGreaterThan(0);

        for (const enumArray of mediaTypeEnums) {
            expect(enumArray).not.toContain('CAROUSEL');
            expect(enumArray).not.toContain('TEXT');
        }
    });

    // -----------------------------------------------------------------------
    // Flat image schema assertions — verifies the oneOf/anyOf removal required
    // for OpenAI Custom GPT Actions to auto-populate openaiFileIdRefs.
    // -----------------------------------------------------------------------

    /**
     * Recursively walks the document to locate the `image` property schema
     * in the saveSocialDraft request body. Returns the raw schema node.
     */
    function findImageSchema(doc: Record<string, unknown>): Record<string, unknown> | null {
        const paths = doc.paths as Record<string, Record<string, unknown>> | undefined;
        const draftPost = paths?.['/api/v1/ai/social/drafts']?.post as
            | Record<string, unknown>
            | undefined;
        if (!draftPost) return null;

        // Walk requestBody -> content -> application/json -> schema -> properties -> image
        const requestBody = draftPost.requestBody as Record<string, unknown> | undefined;
        const content = requestBody?.content as Record<string, unknown> | undefined;
        const jsonContent = content?.['application/json'] as Record<string, unknown> | undefined;
        const schema = jsonContent?.schema as Record<string, unknown> | undefined;

        // The schema may be a $ref — resolve one level if needed
        const resolveRef = (node: Record<string, unknown>): Record<string, unknown> | null => {
            if ('$ref' in node && typeof node.$ref === 'string') {
                const refPath = (node.$ref as string).replace('#/', '').split('/');
                let current: unknown = doc;
                for (const segment of refPath) {
                    if (typeof current !== 'object' || current === null) return null;
                    current = (current as Record<string, unknown>)[segment];
                }
                return (current as Record<string, unknown>) ?? null;
            }
            return node;
        };

        const resolved = schema ? resolveRef(schema) : null;
        const props = resolved?.properties as Record<string, unknown> | undefined;
        const imageProp = props?.image as Record<string, unknown> | undefined;

        if (!imageProp) return null;
        // image may itself be a ref or wrapped in allOf/anyOf/oneOf — resolve the top level
        if ('$ref' in imageProp) return resolveRef(imageProp);
        return imageProp;
    }

    it('image schema has NO oneOf and NO anyOf (flat object required for OpenAI injection)', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');
        const imageSchema = findImageSchema(doc);

        // Assert — image property must exist
        expect(imageSchema).not.toBeNull();

        // The generated schema must not contain oneOf or anyOf at any level of the
        // image object, since that breaks OpenAI Custom GPT Actions file injection.
        const json = JSON.stringify(imageSchema);
        expect(json).not.toContain('"oneOf"');
        expect(json).not.toContain('"anyOf"');
    });

    it('image schema has openaiFileIdRefs as a direct array property with items.type === "string"', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');
        const imageSchema = findImageSchema(doc);

        expect(imageSchema).not.toBeNull();

        // Navigate to properties.openaiFileIdRefs
        const props = imageSchema?.properties as Record<string, unknown> | undefined;
        const refsSchema = props?.openaiFileIdRefs as Record<string, unknown> | undefined;

        // Must exist as a direct property (not inside a union branch)
        expect(refsSchema).toBeDefined();

        // Must be typed as array with string items per OpenAI convention
        expect(refsSchema?.type).toBe('array');
        const items = refsSchema?.items as Record<string, unknown> | undefined;
        expect(items?.type).toBe('string');
    });

    it('image schema has mode as a required field', () => {
        // Arrange / Act
        const doc = buildGptActionSchema('https://api.example.com');
        const imageSchema = findImageSchema(doc);

        expect(imageSchema).not.toBeNull();

        // mode must be in required
        const required = imageSchema?.required as string[] | undefined;
        expect(Array.isArray(required)).toBe(true);
        expect(required).toContain('mode');
    });
});

// ---------------------------------------------------------------------------
// 2. Route-level tests: handler invocation
// ---------------------------------------------------------------------------

describe('GET / — adminGetGptActionSchemaRoute handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns an OpenAPI 3.1 document with 2 paths on success', async () => {
        // Arrange
        const handler = getHandler('get', '/');
        const ctx = buildMockCtx();

        // Act
        const result = (await handler(ctx, {}, {})) as Record<string, unknown>;

        // Assert
        expect(String(result.openapi)).toMatch(/^3\.1/);
        const paths = result.paths as Record<string, unknown>;
        expect(Object.keys(paths)).toHaveLength(2);
    });

    it('returns a document whose servers[0].url matches env.HOSPEDA_API_URL', async () => {
        // Arrange
        const handler = getHandler('get', '/');
        const ctx = buildMockCtx();

        // Act
        const result = (await handler(ctx, {}, {})) as Record<string, unknown>;

        // Assert — env is mocked to 'https://api.hospeda.test'
        const servers = result.servers as Array<{ url: string }>;
        expect(servers[0]?.url).toBe('https://api.hospeda.test');
    });

    it('handler capture succeeds (guards test setup)', () => {
        // Verify handler capture worked
        expect(() => getHandler('get', '/')).not.toThrow();
    });
});
