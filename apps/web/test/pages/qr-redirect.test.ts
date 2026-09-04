/**
 * @file qr-redirect.test.ts
 * @description HOS-981 — `/qr/{slug}/`, the landing a printed QR code points at.
 *
 * Two halves, because the two properties live in different places:
 *
 *   - `qrApi.resolve` is ordinary TypeScript and is asserted behaviourally. The
 *     property that matters there is a NEGATIVE one — no `cacheTtlMs` — because
 *     opting this call into the SSR cache would silently stop counting scans and
 *     keep serving a target the operator has already changed. A positive
 *     assertion ("it calls the right path") cannot see that.
 *   - The `.astro` frontmatter cannot render under Vitest, so its cache and
 *     status decisions are asserted against the source. That is the established
 *     pattern here (see `alojamiento-detail-cache.test.ts`), and its known
 *     weakness is matching somewhere other than the intended call — so every
 *     assertion below is anchored on the specific call's argument text rather
 *     than run against the whole file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// qrApi.resolve
// ---------------------------------------------------------------------------

const { getMock } = vi.hoisted(() => ({
    getMock: vi.fn(async () => ({ ok: true as const, data: {} }))
}));

vi.mock('../../src/lib/api/client', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        apiClient: { ...(actual.apiClient as object), get: getMock }
    };
});

describe('qrApi.resolve', () => {
    beforeEach(() => {
        getMock.mockClear();
    });

    it('calls the public resolution endpoint for the slug', async () => {
        const { qrApi } = await import('../../src/lib/api/endpoints');

        await qrApi.resolve({ slug: 'Live2345' });

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock.mock.calls[0]?.[0]).toEqual({
            path: '/api/v1/public/qr/Live2345',
            headers: {},
            cookieHeader: undefined
        });
    });

    it('never opts the call into the SSR cache', async () => {
        // The whole-object equality above already forbids a `cacheTtlMs` key,
        // but this states the reason on its own so it is not deleted as
        // redundant: a cached resolution is a scan that was never counted and a
        // target that cannot be changed until the TTL expires.
        const { qrApi } = await import('../../src/lib/api/endpoints');

        await qrApi.resolve({ slug: 'Live2345' });

        const args = getMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.keys(args).sort()).toEqual(['cookieHeader', 'headers', 'path']);
        expect(args.cacheTtlMs).toBeUndefined();
    });

    it('forwards the scanner headers so the scan row is not about the web server', async () => {
        // HOS-1141. This call is server-to-server: without forwarding, the only
        // user agent the API can ever see is this process's own `fetch`, and
        // every row in `qr_code_scans` would describe the same machine — a
        // column that is present, populated and wrong, which is worse than an
        // absent one.
        const { qrApi } = await import('../../src/lib/api/endpoints');

        await qrApi.resolve({
            slug: 'Live2345',
            userAgent: 'Mozilla/5.0 (iPhone)',
            acceptLanguage: 'pt-BR,pt;q=0.9',
            cookieHeader: 'session=abc'
        });

        const args = getMock.mock.calls[0]?.[0] as {
            headers: Record<string, string>;
            cookieHeader?: string;
        };
        expect(args.headers).toEqual({
            'user-agent': 'Mozilla/5.0 (iPhone)',
            'accept-language': 'pt-BR,pt;q=0.9'
        });
        // The cookie is what lets the API resolve `user_id` itself, rather than
        // this page asserting an identity it never validated.
        expect(args.cookieHeader).toBe('session=abc');
    });

    it('omits a header it does not have rather than sending an empty one', async () => {
        // An absent `User-Agent` and an empty one are the same fact, and the
        // API's deriver already treats them alike — but sending `''` would put
        // a header on the wire that the original request never carried, which
        // is a small lie this layer has no reason to tell.
        const { qrApi } = await import('../../src/lib/api/endpoints');

        await qrApi.resolve({ slug: 'Live2345', userAgent: null, acceptLanguage: '' });

        const args = getMock.mock.calls[0]?.[0] as { headers: Record<string, string> };
        expect(args.headers).toEqual({});
    });

    it('percent-encodes a slug so it cannot escape its path segment', async () => {
        const { qrApi } = await import('../../src/lib/api/endpoints');

        await qrApi.resolve({ slug: '../../etc/passwd' });

        const args = getMock.mock.calls[0]?.[0] as { path: string };
        expect(args.path).toBe('/api/v1/public/qr/..%2F..%2Fetc%2Fpasswd');
        expect(args.path.startsWith('/api/v1/public/qr/')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The page source
// ---------------------------------------------------------------------------

const QR_PAGE = resolve(__dirname, '../../src/pages/qr/[slug].astro');

/**
 * Extracts the argument text of a call, anchored on the call itself so it can
 * never match an import statement or a comment mentioning the same name.
 */
function callArgsOf(source: string, call: string): string {
    const start = source.indexOf(`${call}(`);
    expect(start, `${call}( not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + call.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced parentheses after ${call}(`);
}

/** Strips block and line comments so prose cannot satisfy a source assertion. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('/qr/{slug}/ page — cacheability and failure mode', () => {
    const raw = readFileSync(QR_PAGE, 'utf8');
    const source = stripComments(raw);

    it('declares itself non-cacheable through applyCacheHeaders', () => {
        const args = callArgsOf(source, 'applyCacheHeaders');

        // Read the value out rather than asserting a negative lookahead. A
        // `not.toMatch(/cacheable:\s*(?!false)/)` looks equivalent and is
        // vacuous: `\s*` backtracks to zero width, the lookahead then evaluates
        // at the space, and the pattern matches even on `cacheable: false`.
        // Extracting the value states the same rule and can actually fail —
        // this file caught exactly that mistake in itself.
        const declared = [...args.matchAll(/cacheable:\s*([A-Za-z0-9_.]+)/g)].map((m) => m[1]);

        // Exactly one declaration, and it is the literal `false`. Nothing
        // conditional: there is no state in which this response may be shared
        // from the edge.
        expect(declared).toEqual(['false']);
    });

    it('never writes a shareable Cache-Control of its own', () => {
        // The static guard already forbids a cacheable header without tags; this
        // is narrower — this page may not set the header AT ALL, because the
        // demotion has to come from the fail-closed helper.
        expect(source).not.toMatch(/['"]Cache-Control['"]\s*[,:]\s*['"][^'"]*(public|s-maxage)/i);
    });

    it('answers a bare 404 so the middleware renders the real site 404 page', () => {
        expect(source).toMatch(/new Response\(null,\s*\{\s*status:\s*404\s*\}\)/);
    });

    it('guards on targetUrl, not merely on data, before building the redirect', () => {
        // `apiClient.get` unwraps the API envelope WITHOUT validating it against
        // a schema, so a 200 whose body lacks `targetUrl` yields a truthy `data`
        // and an undefined target. `Headers.set` stringifies that to the literal
        // "undefined" and the scanner gets a 302 to `/qr/undefined`.
        //
        // Asserted as the guard's exact text rather than "mentions targetUrl":
        // the page names that field twice, so a looser pattern would be
        // satisfied by the line that READS it, which is the line the bug is in.
        const guard = source.match(/if\s*\(![^)]*result[^)]*\)\s*\{/);
        expect(guard, 'no `if (!result...)` guard found').not.toBeNull();
        expect(guard?.[0]).toContain('targetUrl');
    });

    it('never sends an unresolved slug to the home page instead of a 404', () => {
        // The failure mode this page exists to avoid: somebody who scanned a
        // dead sticker silently landing on the home page with no explanation.
        const redirectTargets = [...source.matchAll(/status:\s*30[12]/g)];
        expect(redirectTargets.length).toBe(1);
        expect(source).not.toMatch(/redirect\(\s*['"]\//);
    });

    it.each([
        ['user-agent', 'user-agent'],
        ['accept-language', 'accept-language'],
        ['cookie', 'cookie']
    ])('forwards the scanner %s header to the API (HOS-1141)', (_label, header) => {
        // Anchored on the `qrApi.resolve(` call's own argument text, not run
        // against the whole file: the page's prose mentions all three header
        // names, and a whole-file `toContain` would stay green with the
        // forwarding deleted and only the comment left behind.
        const args = callArgsOf(source, 'qrApi.resolve');

        expect(args).toContain(`Astro.request.headers.get('${header}')`);
    });

    it('carries the cache headers onto the redirect instead of using Astro.redirect', () => {
        // `Astro.redirect` builds its own Response carrying only `Location`, so
        // the non-cacheable `Cache-Control` written above would not survive it.
        expect(source).not.toContain('Astro.redirect');
        expect(source).toMatch(/new Headers\(Astro\.response\.headers\)/);
    });
});
