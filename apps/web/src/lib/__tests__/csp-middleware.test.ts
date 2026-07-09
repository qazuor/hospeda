/**
 * @file csp-middleware.test.ts
 * @description Unit tests for CSP header emission in the web middleware.
 *
 * SPEC-142 T-004 fixed a bug where prerendered pages did not receive the
 * Content-Security-Policy-Report-Only header. Root cause: the @astrojs/node
 * adapter with `staticHeaders: true` does NOT set content-type on the
 * Response object returned from `next()` for prerendered pages (the MIME
 * type is set by the file server after the middleware pipeline). The fix
 * introduced `context.isPrerendered` as a fallback signal so the CSP header
 * reaches static pages even when content-type is absent.
 *
 * HOS-74 (2026-07-04) superseded that approach: `context.isPrerendered` never
 * actually delivered the header for a SERVED response — @astrojs/node standalone
 * serves prerendered files off-disk without re-running middleware, so the header
 * set at build time is discarded. The real fix was to move every content route
 * OFF `prerender` onto the SSR path (nosotros, legal/*, faq, contacto, colaborar,
 * beneficios, etc.). No route is currently prerendered — the allowlist below
 * exists for any future documented exception. The `context.isPrerendered`
 * branch in middleware.ts is now a vestigial defensive guard; the guard tests
 * below only assert it wasn't deleted.
 *
 * Tests:
 * - Regression guard: middleware source contains the isPrerendered fallback.
 * - buildCspHeader is invokable without body context (prerendered case).
 * - The generated header satisfies minimum Phase-1 policy invariants.
 *
 * HOS-30 2.C (2026-07-02, see
 * .specs/HOS-30-csp-phase-2-and-coverage/docs/2026-07-02-premise-corrections.md
 * item 1): the "prerendered CSP emission guard" tests above only assert that
 * specific strings appear in middleware.ts's SOURCE — they cannot prove a
 * given route's response actually carries the header over the wire (that
 * gap is exactly what let the home-page bug ship as "completed" originally).
 * For `/es/` specifically, this is no longer a gap: home was moved OFF the
 * prerendered path entirely (removed `export const prerender = true` from
 * `pages/[lang]/index.astro`), so it now goes through the identical SSR code
 * path as `/es/alojamientos/` and every other already-covered route — no
 * `isPrerendered` fallback involved. Verified with a local production build
 * + standalone Node server: `/es/` returns `content-security-policy-report-only`
 * with no `Last-Modified`/`ETag` (the static-file fingerprints that used to
 * appear instead). The regression guard below locks in that home stays off
 * the prerendered path.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCspHeader, generateCspNonce } from '../middleware-helpers';

const MIDDLEWARE_SRC = readFileSync(resolve(__dirname, '../../middleware.ts'), 'utf8');
const PAGES_DIR = resolve(__dirname, '../../pages');

/**
 * Routes intentionally kept prerendered despite HOS-74. These ship WITHOUT
 * the middleware CSP header by design — see each file's JSDoc. Paths are
 * relative to `src/pages`, forward-slash normalized. Currently empty — no
 * route opts into `prerender`.
 */
const PRERENDER_ALLOWLIST = new Set<string>([]);

/** Recursively collect every `.astro` page file under `src/pages`. */
const collectAstroPages = (dir: string): readonly string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectAstroPages(full));
        } else if (entry.name.endsWith('.astro')) {
            out.push(full);
        }
    }
    return out;
};

// ---------------------------------------------------------------------------
// Regression guard — SPEC-142 T-004 fix must stay in the middleware source
// ---------------------------------------------------------------------------

describe('middleware.ts — prerendered CSP emission guard (SPEC-142 T-004)', () => {
    it('uses context.isPrerendered as fallback when content-type header is absent', () => {
        expect(MIDDLEWARE_SRC).toContain('context.isPrerendered');
    });

    it('computes isHtmlPage = contentType.includes("text/html") || context.isPrerendered', () => {
        expect(MIDDLEWARE_SRC).toContain(
            "contentType.includes('text/html') || context.isPrerendered"
        );
    });

    it('skips body rewrite for prerendered pages to avoid consuming the static response body', () => {
        expect(MIDDLEWARE_SRC).toContain('!context.isPrerendered');
    });

    it('sets CSP header outside the body-rewrite block so both SSR and prerendered pages receive it', () => {
        // The CSP_HEADER_NAME set() call must appear AFTER the body-rewrite block,
        // not inside the `if (!context.isPrerendered)` branch.
        const bodyRewriteIdx = MIDDLEWARE_SRC.indexOf('!context.isPrerendered');
        const cspSetIdx = MIDDLEWARE_SRC.indexOf('response.headers.set(CSP_HEADER_NAME');
        expect(bodyRewriteIdx).toBeGreaterThan(0);
        expect(cspSetIdx).toBeGreaterThan(bodyRewriteIdx);
    });
});

// ---------------------------------------------------------------------------
// CSP_HEADER_NAME — Phase 2 enforce mode (HOS-30 T-020)
// ---------------------------------------------------------------------------

describe('CSP_HEADER_NAME — enforce mode, not Report-Only (HOS-30 T-020)', () => {
    it('declares the enforce header name, not the Report-Only variant', () => {
        expect(MIDDLEWARE_SRC).toContain("const CSP_HEADER_NAME = 'Content-Security-Policy';");
    });

    it('never sets the Report-Only header name anywhere in the middleware', () => {
        expect(MIDDLEWARE_SRC).not.toContain("headers.set('Content-Security-Policy-Report-Only'");
    });

    it('uses the shared CSP_HEADER_NAME constant exactly once, so the header can never drift', () => {
        const occurrences = MIDDLEWARE_SRC.split('headers.set(CSP_HEADER_NAME').length - 1;
        expect(occurrences).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// index.astro (home) — HOS-30 2.C regression guard
// ---------------------------------------------------------------------------

describe('apps/web pages — no route re-introduces prerender except the allowlist (HOS-74)', () => {
    const pages = collectAstroPages(PAGES_DIR);

    it('walks a non-trivial number of page files (walker sanity)', () => {
        expect(pages.length).toBeGreaterThan(20);
    });

    it('no page declares `export const prerender = true` except the documented exceptions', () => {
        const offenders = pages
            .filter((file) =>
                /export\s+const\s+prerender\s*=\s*true/.test(readFileSync(file, 'utf8'))
            )
            .map((file) => relative(PAGES_DIR, file).split(/[/\\]/).join('/'))
            .filter((rel) => !PRERENDER_ALLOWLIST.has(rel));
        // A non-empty list means a route shipped without the middleware CSP header
        // (prerendered files bypass middleware at runtime — the exact HOS-74 bug).
        expect(offenders).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// buildCspHeader — Phase-1 invariants (header-only path, no body context)
// ---------------------------------------------------------------------------

describe('buildCspHeader — prerendered-page header-only invocation', () => {
    it('produces a non-empty CSP header string for a prerendered page request', () => {
        const nonce = generateCspNonce();
        const header = buildCspHeader({ nonce });
        expect(typeof header).toBe('string');
        expect(header.length).toBeGreaterThan(0);
    });

    it('includes the per-request nonce in script-src and style-src', () => {
        const nonce = 'prerendered-page-nonce-xyz';
        const header = buildCspHeader({ nonce });
        expect(header).toContain(`'nonce-${nonce}'`);
    });

    it('includes default-src self and upgrade-insecure-requests', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain("default-src 'self'");
        expect(header).toContain('upgrade-insecure-requests');
    });

    it('does NOT include unsafe-inline in script-src (nonce-based policy)', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('frame-src allowlists only the Cloudflare Turnstile host (SPEC-301 feedback widget iframe; MercadoPago checkout is a redirect, not an embedded Brick — HOS-30 2.B)', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const frameSrc = header.split('; ').find((d) => d.startsWith('frame-src '));
        expect(frameSrc).toBe('frame-src https://challenges.cloudflare.com');
    });
});

// ---------------------------------------------------------------------------
// buildCspHeader — HOS-91 dev-only style-src relaxation
// ---------------------------------------------------------------------------

/**
 * Isolates the `style-src` directive from `style-src-attr` by matching the
 * exact directive name followed by a space (`style-src-attr` also starts
 * with `style-src` but not `style-src `, so the trailing space disambiguates).
 */
const findStyleSrcDirective = (header: string): string =>
    header.split('; ').find((d) => /^style-src /.test(d)) ?? '';

describe('buildCspHeader — HOS-91 dev-only style-src relaxation', () => {
    it('keeps the strict nonce-based style-src in prod (isDev: false)', () => {
        const nonce = 'prod-nonce-abc';

        const header = buildCspHeader({ nonce, isDev: false });

        const styleSrc = findStyleSrcDirective(header);
        expect(styleSrc).toContain(`'nonce-${nonce}'`);
        expect(styleSrc).not.toContain("'unsafe-inline'");
    });

    it('keeps the strict nonce-based style-src by default (isDev omitted)', () => {
        const nonce = 'default-nonce-abc';

        const header = buildCspHeader({ nonce });

        const styleSrc = findStyleSrcDirective(header);
        expect(styleSrc).toContain(`'nonce-${nonce}'`);
        expect(styleSrc).not.toContain("'unsafe-inline'");
    });

    it('relaxes style-src to unsafe-inline with no nonce/hash in dev (isDev: true)', () => {
        const nonce = 'dev-nonce-abc';

        const header = buildCspHeader({ nonce, isDev: true });

        const styleSrc = findStyleSrcDirective(header);
        expect(styleSrc).toContain("'unsafe-inline'");
        expect(styleSrc).not.toContain("'nonce-");
        expect(styleSrc).not.toContain("'sha256-");
    });
});

// ---------------------------------------------------------------------------
// generateCspNonce — per-request randomness
// ---------------------------------------------------------------------------

describe('generateCspNonce', () => {
    it('returns a non-empty base64 string', () => {
        const nonce = generateCspNonce();
        expect(nonce.length).toBeGreaterThan(0);
        expect(/^[A-Za-z0-9+/]+=*$/.test(nonce)).toBe(true);
    });

    it('generates a unique nonce for each request', () => {
        const n1 = generateCspNonce();
        const n2 = generateCspNonce();
        expect(n1).not.toBe(n2);
    });
});
