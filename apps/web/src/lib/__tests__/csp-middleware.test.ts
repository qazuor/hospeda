/**
 * @file csp-middleware.test.ts
 * @description Unit tests for CSP header emission in the web middleware.
 *
 * SPEC-142 T-004 fixed a bug where prerendered pages did not receive the
 * Content-Security-Policy-Report-Only header. Root cause: the @astrojs/node
 * adapter with `staticHeaders: true` does NOT set content-type on the
 * Response object returned from `next()` for prerendered pages (the MIME
 * type is set by the file server after the middleware pipeline). The fix
 * introduces `context.isPrerendered` as a fallback signal so the CSP header
 * reaches static pages even when content-type is absent. This fallback is
 * still exercised by the app's other prerendered routes (nosotros, legal/*,
 * faq, contacto, etc.) — see the "index.astro (home)" describe block below
 * for the home-specific fix.
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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCspHeader, generateCspNonce } from '../middleware-helpers';

const MIDDLEWARE_SRC = readFileSync(resolve(__dirname, '../../middleware.ts'), 'utf8');
const HOME_PAGE_SRC = readFileSync(resolve(__dirname, '../../pages/[lang]/index.astro'), 'utf8');

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
// index.astro (home) — HOS-30 2.C regression guard
// ---------------------------------------------------------------------------

describe('pages/[lang]/index.astro (home) — stays off the prerendered path (HOS-30 2.C)', () => {
    it('does not declare prerender = true', () => {
        expect(HOME_PAGE_SRC).not.toContain('prerender = true');
    });

    it('does not declare getStaticPaths (only meaningful for prerendered routes)', () => {
        expect(HOME_PAGE_SRC).not.toContain('getStaticPaths');
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

    it('frame-src is none (MercadoPago checkout is a redirect, not an embedded Brick — no allowlist needed, see HOS-30 2.B)', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const frameSrc = header.split('; ').find((d) => d.startsWith('frame-src '));
        expect(frameSrc).toBe("frame-src 'none'");
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
