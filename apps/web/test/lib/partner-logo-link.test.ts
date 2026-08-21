/**
 * HOS-294 D-1 / AC-5 / AC-6 — where a partner logo in the home carousel points.
 *
 * This one branch IS the product decision that separates the two paid plans, and
 * it is one `rel` attribute wide. Extracted from the marquee into a pure
 * function precisely so it can be asserted directly instead of by grepping
 * `.astro` source, which Vitest cannot render.
 *
 * @module test/lib/partner-logo-link
 */

import { describe, expect, it } from 'vitest';
import { resolvePartnerLogoLink } from '../../src/lib/partner-logo-link';

const gold = { name: 'Acme', logoPath: '/a.png', aspectRatio: 3.5, tier: 'gold', slug: 'acme' };
const silver = {
    name: 'Beta',
    logoPath: '/b.png',
    aspectRatio: 3.5,
    tier: 'silver',
    slug: 'beta',
    url: 'https://beta.example.com'
};

describe('resolvePartnerLogoLink', () => {
    it('sends a gold partner to its own page as an internal link', () => {
        // Arrange / Act
        const link = resolvePartnerLogoLink({ partner: gold, locale: 'es' });

        // Assert — internal: no rel, no target. Adding either would tell search
        // engines not to follow a link to our OWN page.
        expect(link.href).toBe('/es/partners/acme/');
        expect(link.rel).toBeUndefined();
        expect(link.target).toBeUndefined();
    });

    it('sends a gold partner to its page even when it also has a website', () => {
        // Arrange — the internal page always wins for gold. That page is what
        // the partner is paying for.
        const link = resolvePartnerLogoLink({
            partner: { ...gold, url: 'https://acme.example.com' },
            locale: 'es'
        });

        // Assert
        expect(link.href).toBe('/es/partners/acme/');
    });

    it('sends a silver partner to its own site, sponsored and nofollowed', () => {
        // Arrange / Act
        const link = resolvePartnerLogoLink({ partner: silver, locale: 'es' });

        // Assert — `sponsored nofollow` is what makes the outbound link cost
        // nothing in SEO terms; `noopener` is the usual safety for _blank.
        expect(link.href).toBe('https://beta.example.com');
        expect(link.rel).toBe('sponsored nofollow noopener');
        expect(link.target).toBe('_blank');
    });

    it('gives a silver partner with no website no link at all', () => {
        // Arrange — AC-6. Every newly provisioned partner starts with a null
        // websiteUrl (spec R-1), so this is the common case on day one, not an
        // edge case. An empty href would be a visibly broken logo.
        const link = resolvePartnerLogoLink({
            partner: { ...silver, url: undefined },
            locale: 'es'
        });

        // Assert
        expect(link.href).toBeUndefined();
    });

    it('gives a gold partner with no slug no link either', () => {
        // Arrange — fail closed: without a slug there is no page to point at,
        // and `/es/partners//` would be a 404 shipped to every home visitor.
        const link = resolvePartnerLogoLink({
            partner: { ...gold, slug: undefined },
            locale: 'es'
        });

        // Assert
        expect(link.href).toBeUndefined();
    });

    it('falls back to the external link for an unknown tier', () => {
        // Arrange — `bronze` is no longer a tier (HOS-294 retired it), which is
        // exactly what makes it a good stand-in for a value the enum does not
        // know: a stale row, or a tier added later. It must never be treated as
        // gold, because gold is the one that grants a public page.
        const link = resolvePartnerLogoLink({
            partner: { ...silver, tier: 'bronze' },
            locale: 'es'
        });

        // Assert
        expect(link.href).toBe('https://beta.example.com');
        expect(link.rel).toBe('sponsored nofollow noopener');
    });

    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        '\u0001javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)'
    ])('gives a partner NO link when the stored website is %j', (websiteUrl) => {
        // HOS-592 / F-02. `websiteUrl` is written through
        // `PATCH /protected/partners/mine` (session only) and validated with
        // `z.string().url()`, which accepts every one of these. The carousel
        // renders its track twice, so a raw value would have shipped the same
        // executable link twice on the home page.
        const link = resolvePartnerLogoLink({
            partner: { ...silver, url: websiteUrl },
            locale: 'es'
        });

        // No link at all — never the raw value, and never an href of undefined.
        expect(link.href).toBeUndefined();
        expect(link.rel).toBeUndefined();
        expect(link.target).toBeUndefined();
    });

    it('builds the internal href for the active locale', () => {
        // Arrange / Act
        const link = resolvePartnerLogoLink({ partner: gold, locale: 'en' });

        // Assert
        expect(link.href).toBe('/en/partners/acme/');
    });
});
