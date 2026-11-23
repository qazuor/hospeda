/**
 * @file go-short-link.test.ts
 * @description HOS-2359 §6.D.2 (AC-17): `/go/{slug}/`, the presentation short
 * links. The redirect logic is TypeScript and asserted behaviourally in
 * `test/lib/attribution/presentation-links.test.ts`; this file asserts the
 * `.astro` page wires it the way `/qr/{slug}/` does, against its source (Astro
 * frontmatter cannot render under Vitest).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_NEUTRAL_PREFIXES } from '../../src/lib/routes';

const PAGE = resolve(__dirname, '../../src/pages/go/[slug].astro');

describe('/go/[slug].astro', () => {
    const src = readFileSync(PAGE, 'utf8');
    const cacheCall = src.match(/applyCacheHeaders\(\{[\s\S]*?\}\);/)?.[0] ?? '';

    it('is never cacheable', () => {
        expect(cacheCall).toMatch(/\bcacheable:\s*false\b/);
    });

    it('answers through buildPresentationShortLinkResponse, copying the page headers', () => {
        expect(src).toMatch(
            /return buildPresentationShortLinkResponse\(\{\s*slug,\s*baseHeaders:\s*Astro\.response\.headers\s*\}\)/
        );
    });

    it('makes no API call and reads no session or cookie (stays session-blind)', () => {
        // Comments are stripped first: the docblock explains, in words, why the
        // page reads no cookie, and that prose must not satisfy or trip this.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/Astro\.locals\.user|cookie|Api\.|apiClient/i);
    });

    it('is exempt from the locale redirect, like /qr/', () => {
        expect(LANGUAGE_NEUTRAL_PREFIXES).toContain('/go/');
        expect(LANGUAGE_NEUTRAL_PREFIXES).toContain('/qr/');
    });
});
