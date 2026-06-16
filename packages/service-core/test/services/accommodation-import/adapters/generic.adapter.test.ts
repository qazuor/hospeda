/**
 * Unit tests for GenericAdapter (SPEC-222 T-014)
 *
 * AAA pattern throughout. `@repo/utils` `safeExternalFetch` is mocked via
 * `vi.mock` so no real network requests are issued.
 *
 * Covers:
 * - `supports()` — true for any https: URL.
 * - Blocked/failed fetch → `{ sourcePlatform: 'generic' }`, extractors not
 *   required to run, `ctx.aiExtract` not called.
 * - Rich JSON-LD body (≥ STRATEGY_B_THRESHOLD useful fields) → fields mapped
 *   and tagged `'jsonld'`; `ctx.aiExtract` NOT called.
 * - Sparse body (< threshold) WITH `ctx.aiExtract` → AI called with stripped
 *   text; AI fields merged into gaps only; a field already found by structured
 *   extraction is NOT overwritten by AI.
 * - Sparse body WITHOUT `ctx.aiExtract` → structured partial returned, no throw.
 * - `ctx.aiExtract` throws → structured partial returned, no throw.
 * - JSON-LD containing aggregateRating/review → no rating/review field in result.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    ImportContext,
    RawExtraction
} from '../../../../src/services/accommodation-import/adapter.types.js';
import {
    GenericAdapter,
    STRATEGY_B_THRESHOLD
} from '../../../../src/services/accommodation-import/adapters/generic.adapter.js';

// ---------------------------------------------------------------------------
// Module mock: @repo/utils safeExternalFetch
// ---------------------------------------------------------------------------

vi.mock('@repo/utils', () => ({
    safeExternalFetch: vi.fn()
}));

// Import after vi.mock so we get the mocked version.
import { safeExternalFetch } from '@repo/utils';

const mockFetch = vi.mocked(safeExternalFetch);

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal {@link ImportContext} for tests.
 * Pass `aiExtract` to enable Strategy B.
 */
function makeCtx(overrides?: Partial<ImportContext>): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 10_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {},
        ...overrides
    };
}

/** Minimal blocked SafeFetchResult (ok: false). */
const BLOCKED_RESULT = {
    ok: false as const,
    status: 0 as const,
    error: 'Blocked by SSRF policy',
    blocked: true as const
};

/** Builds a successful SafeFetchResult wrapping `html`. */
function successResult(html: string) {
    return {
        ok: true as const,
        status: 200,
        body: html,
        finalUrl: 'https://example.com/listing/1'
    };
}

/**
 * Rich HTML with a well-formed JSON-LD LodgingBusiness node.
 * Contains name + description + geo + address + telephone + url + image
 * (≥ STRATEGY_B_THRESHOLD useful fields after mapping).
 */
const RICH_JSONLD_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG Title (should lose to JSON-LD)">
  <meta property="og:description" content="OG Description">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "Cabaña del Río",
    "description": "Una cabaña acogedora junto al río.",
    "telephone": "+54 3442 123456",
    "url": "https://cabanas.example.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Av. Urquiza 100",
      "addressLocality": "Concepción del Uruguay",
      "addressCountry": "Argentina"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -32.4847,
      "longitude": -58.2376
    },
    "image": ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"]
  }
  </script>
</head>
<body>Cabaña del Río</body>
</html>`;

/**
 * Sparse HTML with no useful JSON-LD (non-lodging @type) and no OG fields
 * that map to draft fields — yields < STRATEGY_B_THRESHOLD useful fields.
 */
const SPARSE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Some Page</title>
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "WebSite", "name": "Ignored" }
  </script>
</head>
<body>Nothing useful here.</body>
</html>`;

/**
 * HTML with aggregateRating and review fields in the JSON-LD node to verify
 * the hard rule: those fields must never appear in the extraction result.
 */
const RATING_JSONLD_HTML = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "name": "Hotel Con Rating",
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "200" },
    "review": [{ "@type": "Review", "author": "Guest", "reviewBody": "Excellent!" }],
    "ratingValue": "4.8"
  }
  </script>
</head>
<body>Hotel Con Rating</body>
</html>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenericAdapter', () => {
    let adapter: GenericAdapter;

    beforeEach(() => {
        adapter = new GenericAdapter();
        mockFetch.mockReset();
    });

    // -------------------------------------------------------------------------
    // source identifier
    // -------------------------------------------------------------------------

    it('should have source = "generic"', () => {
        // Arrange / Act / Assert
        expect(adapter.source).toBe('generic');
    });

    // -------------------------------------------------------------------------
    // supports()
    // -------------------------------------------------------------------------

    describe('supports()', () => {
        it('should return true for an https URL', () => {
            // Arrange
            const url = new URL('https://example.com/listing/123');
            // Act
            const result = adapter.supports(url);
            // Assert
            expect(result).toBe(true);
        });

        it('should return true for any https URL regardless of hostname', () => {
            // Arrange
            const urls = [
                new URL('https://airbnb.com/rooms/1'),
                new URL('https://some-unknown-site.ar/cabana'),
                new URL('https://sub.domain.example.org/path?q=1')
            ];
            // Act / Assert
            for (const url of urls) {
                expect(adapter.supports(url)).toBe(true);
            }
        });

        it('should return true for an http URL (catch-all; blocked later by safeExternalFetch)', () => {
            // Arrange
            const url = new URL('http://example.com/listing/123');
            // Act
            const result = adapter.supports(url);
            // Assert
            expect(result).toBe(true);
        });

        it('should return false for a non-web scheme', () => {
            // Arrange
            const url = new URL('ftp://example.com/listing/123');
            // Act
            const result = adapter.supports(url);
            // Assert
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // extract() — fetch blocked / failed
    // -------------------------------------------------------------------------

    describe('extract() — fetch blocked or failed', () => {
        it('should return { sourcePlatform: "generic" } when fetch is blocked', async () => {
            // Arrange
            mockFetch.mockResolvedValue(BLOCKED_RESULT);
            const aiExtract = vi.fn();
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — minimal degrade result
            expect(result).toStrictEqual({ sourcePlatform: 'generic' });
            // AI must NOT be called when fetch failed
            expect(aiExtract).not.toHaveBeenCalled();
        });

        it('should not throw when fetch is blocked', async () => {
            // Arrange
            mockFetch.mockResolvedValue(BLOCKED_RESULT);
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act / Assert — no throw
            await expect(adapter.extract(url, ctx)).resolves.toBeDefined();
        });

        it('should pass url.href, timeoutMs, and maxBytes to safeExternalFetch', async () => {
            // Arrange
            mockFetch.mockResolvedValue(BLOCKED_RESULT);
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/42');

            // Act
            await adapter.extract(url, ctx);

            // Assert
            expect(mockFetch).toHaveBeenCalledWith({
                url: 'https://example.com/listing/42',
                timeoutMs: ctx.timeoutMs,
                maxBytes: ctx.maxBytes
            });
        });
    });

    // -------------------------------------------------------------------------
    // extract() — rich JSON-LD body (Strategy A sufficient)
    // -------------------------------------------------------------------------

    describe('extract() — rich JSON-LD body (Strategy A sufficient)', () => {
        it('should map JSON-LD name tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.name).toStrictEqual({ value: 'Cabaña del Río', source: 'jsonld' });
        });

        it('should map JSON-LD description tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.description).toStrictEqual({
                value: 'Una cabaña acogedora junto al río.',
                source: 'jsonld'
            });
        });

        it('should map JSON-LD geo coordinates tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.location?.coordinates?.source).toBe('jsonld');
            expect(result.location?.coordinates?.value).toStrictEqual({
                lat: '-32.4847',
                long: '-58.2376'
            });
        });

        it('should map JSON-LD street address tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.location?.street).toStrictEqual({
                value: 'Av. Urquiza 100',
                source: 'jsonld'
            });
        });

        it('should map JSON-LD telephone to contactInfo.mobilePhone tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.contactInfo?.mobilePhone).toStrictEqual({
                value: '+54 3442 123456',
                source: 'jsonld'
            });
        });

        it('should map JSON-LD url to contactInfo.website tagged jsonld', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.contactInfo?.website).toStrictEqual({
                value: 'https://cabanas.example.com',
                source: 'jsonld'
            });
        });

        it('should populate imageUrls from JSON-LD', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.imageUrls).toStrictEqual([
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg'
            ]);
        });

        it('should populate scrapedLocality and scrapedCountry from JSON-LD address', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.scrapedCountry).toBe('Argentina');
        });

        it('should NOT call ctx.aiExtract when useful field count >= STRATEGY_B_THRESHOLD', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const aiExtract = vi.fn<() => Promise<RawExtraction | null>>();
            const ctx = makeCtx({
                aiExtract: aiExtract as NonNullable<ImportContext['aiExtract']>
            });
            const url = new URL('https://example.com/listing/1');

            // Act
            await adapter.extract(url, ctx);

            // Assert — threshold met, AI must not be invoked
            expect(aiExtract).not.toHaveBeenCalled();
        });

        it('should set sourcePlatform to "generic"', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RICH_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.sourcePlatform).toBe('generic');
        });
    });

    // -------------------------------------------------------------------------
    // extract() — OG fallback when JSON-LD is absent / non-lodging
    // -------------------------------------------------------------------------

    describe('extract() — Open Graph fallback', () => {
        const OG_ONLY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Cabaña OG">
  <meta property="og:description" content="Descripción OG de la cabaña.">
  <meta property="og:image" content="https://cdn.example.com/og-img.jpg">
  <meta property="og:url" content="https://example.com/og-listing">
</head>
<body>Cabaña OG</body>
</html>`;

        it('should use og:title as name tagged opengraph when JSON-LD has no name', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(OG_ONLY_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.name).toStrictEqual({ value: 'Cabaña OG', source: 'opengraph' });
        });

        it('should use og:image as imageUrls fallback tagged opengraph', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(OG_ONLY_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.imageUrls).toStrictEqual(['https://cdn.example.com/og-img.jpg']);
        });
    });

    // -------------------------------------------------------------------------
    // extract() — meta description fallback
    // -------------------------------------------------------------------------

    describe('extract() — meta description fallback', () => {
        const META_DESC_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="Descripción estándar de la página.">
</head>
<body>Página</body>
</html>`;

        it('should use meta description tagged "meta" as description fallback', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(META_DESC_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.description).toStrictEqual({
                value: 'Descripción estándar de la página.',
                source: 'meta'
            });
        });
    });

    // -------------------------------------------------------------------------
    // extract() — Strategy B triggered (sparse body, aiExtract provided)
    // -------------------------------------------------------------------------

    describe('extract() — Strategy B (sparse body, aiExtract provided)', () => {
        it('should call ctx.aiExtract when useful field count < STRATEGY_B_THRESHOLD', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiResult: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'AI Name', source: 'ai' }
            };
            const aiExtract = vi.fn().mockResolvedValue(aiResult);
            const ctx = makeCtx({ aiExtract, aiMaxChars: 4_000 });
            const url = new URL('https://example.com/listing/1');

            // Act
            await adapter.extract(url, ctx);

            // Assert
            expect(aiExtract).toHaveBeenCalledOnce();
        });

        it('should pass stripped text and locale to ctx.aiExtract', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiExtract = vi.fn().mockResolvedValue(null);
            const ctx = makeCtx({ aiExtract, locale: 'es', aiMaxChars: 4_000 });
            const url = new URL('https://example.com/listing/1');

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const callArg = aiExtract.mock.calls[0]?.[0];
            expect(callArg).toBeDefined();
            expect(typeof callArg?.text).toBe('string');
            expect(callArg?.text.length).toBeGreaterThan(0);
            expect(callArg?.locale).toBe('es');
        });

        it('should merge AI fields into gaps (AI name fills empty name)', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiResult: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'AI Name', source: 'ai' },
                description: { value: 'AI Description', source: 'ai' }
            };
            const aiExtract = vi.fn().mockResolvedValue(aiResult);
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — AI filled the gaps
            expect(result.name).toStrictEqual({ value: 'AI Name', source: 'ai' });
            expect(result.description).toStrictEqual({ value: 'AI Description', source: 'ai' });
        });

        it('should NOT overwrite a structured field with an AI field (structured wins)', async () => {
            // Arrange: use HTML that gives exactly one useful structured field
            // (og:title → name) to stay below threshold while keeping a known
            // structured value so we can verify the AI cannot overwrite it.
            const ONE_FIELD_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Structured Name">
</head>
<body>One field body text.</body>
</html>`;
            // Verify this fixture yields < STRATEGY_B_THRESHOLD useful fields.
            // (1 field: name from og:title — below threshold of 2)
            mockFetch.mockResolvedValue(successResult(ONE_FIELD_HTML));
            const aiResult: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'AI Should Not Win', source: 'ai' },
                description: { value: 'AI Description', source: 'ai' }
            };
            const aiExtract = vi.fn().mockResolvedValue(aiResult);
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — structured name preserved; AI fills description gap
            expect(result.name).toStrictEqual({ value: 'Structured Name', source: 'opengraph' });
            expect(result.description).toStrictEqual({ value: 'AI Description', source: 'ai' });
        });

        it('should return structured partial when AI returns null', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiExtract = vi.fn().mockResolvedValue(null);
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — minimal structured result, no throw
            expect(result.sourcePlatform).toBe('generic');
        });
    });

    // -------------------------------------------------------------------------
    // extract() — Strategy B skipped when ctx.aiExtract is absent
    // -------------------------------------------------------------------------

    describe('extract() — Strategy B skipped when aiExtract absent', () => {
        it('should return structured partial without throw when aiExtract is absent', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const ctx = makeCtx({ aiExtract: undefined });
            const url = new URL('https://example.com/listing/1');

            // Act / Assert
            await expect(adapter.extract(url, ctx)).resolves.toMatchObject({
                sourcePlatform: 'generic'
            });
        });
    });

    // -------------------------------------------------------------------------
    // extract() — ctx.aiExtract throws
    // -------------------------------------------------------------------------

    describe('extract() — ctx.aiExtract throws', () => {
        it('should return structured partial without throw when aiExtract throws', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiExtract = vi.fn().mockRejectedValue(new Error('AI service unavailable'));
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — swallowed the AI error, returned structured partial
            expect(result.sourcePlatform).toBe('generic');
        });

        it('should not propagate the AI error to the caller', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(SPARSE_HTML));
            const aiExtract = vi.fn().mockRejectedValue(new TypeError('unexpected'));
            const ctx = makeCtx({ aiExtract });
            const url = new URL('https://example.com/listing/1');

            // Act / Assert
            await expect(adapter.extract(url, ctx)).resolves.toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // Hard rule: no rating / review fields in result
    // -------------------------------------------------------------------------

    describe('SPEC-222 hard rule — no rating or review fields', () => {
        it('should not include aggregateRating in result (stripped by extractor)', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RATING_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — cast to unknown first to inspect dynamic keys (RawExtraction has no index sig)
            const raw = result as unknown as Record<string, unknown>;
            expect(raw.aggregateRating).toBeUndefined();
            expect(raw.ratingValue).toBeUndefined();
            expect(raw.review).toBeUndefined();
            expect(raw.reviews).toBeUndefined();
        });

        it('should still extract the name from a lodging node that had rating fields', async () => {
            // Arrange
            mockFetch.mockResolvedValue(successResult(RATING_JSONLD_HTML));
            const ctx = makeCtx();
            const url = new URL('https://example.com/listing/1');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — name was extracted correctly despite rating stripping
            expect(result.name).toStrictEqual({ value: 'Hotel Con Rating', source: 'jsonld' });
        });
    });

    // -------------------------------------------------------------------------
    // STRATEGY_B_THRESHOLD constant
    // -------------------------------------------------------------------------

    describe('STRATEGY_B_THRESHOLD', () => {
        it('should be 2', () => {
            expect(STRATEGY_B_THRESHOLD).toBe(2);
        });
    });
});
