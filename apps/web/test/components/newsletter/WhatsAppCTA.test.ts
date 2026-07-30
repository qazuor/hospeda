/**
 * @file WhatsAppCTA.test.ts
 * @description Source-reading unit tests for WhatsAppCTA.astro.
 *
 * Astro components cannot be rendered in Vitest/jsdom (no runtime for the
 * `---` frontmatter + `<Component />` JSX). We follow the project pattern
 * (see Footer.test.ts) and assert on the source text to verify:
 *   - The component renders nothing when PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL is unset (AC-101-13.4)
 *   - The block contains the i18n-resolved title / description / CTA
 *   - Anchor opens the URL in a new tab with rel=noopener noreferrer
 *   - aria-label is present (a11y)
 *   - The analytics tracking script is wired up
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findBareInkDeclarations } from '../../static-guards/ink-literals';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/newsletter/WhatsAppCTA.astro'),
    'utf8'
);

const cssSrc = readFileSync(
    resolve(__dirname, '../../../src/components/newsletter/WhatsAppCTA.module.css'),
    'utf8'
);

describe('WhatsAppCTA.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file WhatsAppCTA.astro');
        });

        it('defines a Props interface with readonly locale and source', () => {
            expect(src).toContain('interface Props');
            expect(src).toContain('readonly locale: SupportedLocale');
            expect(src).toContain('readonly source:');
        });

        it('declares the three valid source values', () => {
            expect(src).toContain("'verification_success'");
            expect(src).toContain("'account_preferences'");
            expect(src).toContain("'welcome_email_landing'");
        });

        it('imports the WhatsappIcon from @repo/icons (not phosphor-react directly)', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('WhatsappIcon');
            expect(src).not.toContain('phosphor-react');
        });

        it('imports createTranslations from the web app i18n lib', () => {
            expect(src).toContain('createTranslations');
            expect(src).toContain("from '@/lib/i18n'");
        });

        it('imports CSS Module styles', () => {
            expect(src).toContain("from './WhatsAppCTA.module.css'");
        });
    });

    describe('env gating (AC-101-13.4)', () => {
        it('reads PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL from import.meta.env', () => {
            expect(src).toContain('import.meta.env.PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL');
        });

        it('guards the whole render with a {channelUrl && ...} block', () => {
            // The render is wrapped so when channelUrl is falsy, nothing reaches the DOM.
            expect(src).toMatch(/\{channelUrl\s*&&/);
        });
    });

    describe('i18n', () => {
        it('reads the title via t("newsletter.whatsapp.title", ...)', () => {
            expect(src).toContain("t('newsletter.whatsapp.title'");
        });

        it('reads the description via t("newsletter.whatsapp.description", ...)', () => {
            // Tolerate line wrapping between t( and the namespace key.
            expect(src).toMatch(/t\(\s*'newsletter\.whatsapp\.description'/);
        });

        it('reads the CTA label via t("newsletter.whatsapp.ctaButton", ...)', () => {
            expect(src).toContain("t('newsletter.whatsapp.ctaButton'");
        });

        it('does not embed hardcoded Spanish copy outside the t() fallback', () => {
            // Hardcoded ES strings only appear as fallback args to t().
            const titleLine = src.match(/t\('newsletter\.whatsapp\.title'.*?\)/s);
            expect(titleLine).not.toBeNull();
        });
    });

    describe('rendering', () => {
        it('renders a semantic <aside> wrapper', () => {
            expect(src).toMatch(/<aside\b/);
        });

        it('renders an anchor with target="_blank" and rel="noopener noreferrer"', () => {
            expect(src).toContain('target="_blank"');
            expect(src).toContain('rel="noopener noreferrer"');
        });

        it('points the anchor at the channelUrl', () => {
            expect(src).toMatch(/href=\{channelUrl\}/);
        });

        it('renders the WhatsappIcon inside the block', () => {
            expect(src).toMatch(/<WhatsappIcon\b/);
        });
    });

    describe('accessibility', () => {
        it('sets aria-label on the wrapper aside', () => {
            expect(src).toMatch(/<aside[^>]*aria-label=/s);
        });

        it('sets aria-label on the CTA anchor', () => {
            expect(src).toMatch(/<a[^>]*aria-label=/s);
        });

        it('hides the decorative icon from assistive tech', () => {
            expect(src).toMatch(/aria-hidden="true"/);
        });
    });

    describe('analytics', () => {
        it('tags the wrapper with data-newsletter-wa-cta for the click handler', () => {
            expect(src).toContain('data-newsletter-wa-cta');
        });

        it('forwards the source prop on the data-source attribute', () => {
            expect(src).toContain('data-source={source}');
        });

        it('fires the newsletter_wa_channel_clicked event on dataLayer', () => {
            expect(src).toContain("event: 'newsletter_wa_channel_clicked'");
        });

        it('does not crash when dataLayer is undefined (uses optional chaining)', () => {
            expect(src).toContain('dataLayer?.push');
        });
    });
});

describe('WhatsAppCTA.module.css', () => {
    it('uses the --surface-warm CSS variable per UX §5.5', () => {
        expect(cssSrc).toContain('--surface-warm');
    });

    it('takes the WhatsApp brand colours from the channel tokens (HOS-314)', () => {
        // This assertion used to read `toContain('#25d366')`, justified by "no
        // system token exists for WhatsApp green". HOS-314 created one, so the
        // hard-code is no longer the way to keep the brand colour from
        // drifting — the token is, and it carries the AA-safe ink with it.
        expect(cssSrc).toContain('background-color: var(--channel-whatsapp)');
        expect(cssSrc).toContain('color: var(--channel-whatsapp-foreground)');
        expect(cssSrc).toContain('background-color: var(--channel-whatsapp-hover)');
    });

    it('inks the labelled CTA from the AA-safe token', () => {
        const cta = /\.cta\s*\{([^}]*)\}/.exec(cssSrc);
        expect(cta, 'no .cta rule found').not.toBeNull();
        expect(cta?.[1] ?? '').toContain('color: var(--channel-whatsapp-foreground)');
    });

    it('takes EVERY text colour from a token, wherever it is declared', () => {
        // Replaces a `not.toContain('color: #ffffff')` scoped to the FIRST .cta
        // body — which every other spelling satisfied (`#fff`, `white`,
        // `rgb(255 255 255)`, `-webkit-text-fill-color`) and which could not see
        // the second `.cta` rule this file already has inside
        // `@media (max-width: 600px)`, nor a descendant rule. Whole-file and
        // token-only, via the helper the other two WhatsApp surfaces share.
        expect(findBareInkDeclarations(cssSrc)).toEqual([]);
        expect(findBareInkDeclarations(src)).toEqual([]);
    });

    it('keeps the logo badge text-free, which is what its white ink depends on', () => {
        // The WCAG 1.4.3 exemption the white ink rests on applies to a LOGOTYPE.
        // Put a label inside this div and the same `color` becomes 1.98:1 text on
        // the brand green — a change no colour guard can see, since the CSS would
        // be untouched. So the invariant is asserted on the markup: the badge
        // holds the icon component and nothing else.
        const badge = /<div class=\{styles\.iconWrap\}[^>]*>([\s\S]*?)<\/div>/.exec(src);
        expect(badge, 'no iconWrap div found').not.toBeNull();
        const contents = (badge?.[1] ?? '').trim();
        // The invariant is "one self-closing icon element and no text node", NOT
        // a byte-exact string: pinning prop order, values and spacing would make a
        // `size={40}` or a Biome reflow fail a test named "text-free", with a diff
        // that says nothing about text.
        expect(contents).toMatch(/^<WhatsappIcon\b[^>]*\/>$/);
        expect(src).toMatch(/class=\{styles\.iconWrap\}[^>]*aria-hidden="true"/);
    });

    it('inks the logo-only badge with the logotype token (WCAG 1.4.3 exemption)', () => {
        // The badge holds only the WhatsApp mark, which WCAG exempts from
        // contrast, so it stays white — but via a NAMED token whose single
        // legitimate consumer the static guard enumerates, not a raw literal.
        const badge = /\.iconWrap\s*\{([^}]*)\}/.exec(cssSrc);
        expect(badge, 'no .iconWrap rule found').not.toBeNull();
        expect(badge?.[1] ?? '').toContain('color: var(--channel-whatsapp-logo)');
    });

    it('gives the CTA a 44px minimum tap target', () => {
        // 8px of block padding around a 14px line box left it at ~33px. Scoped to
        // the .cta body: file-scoped, it would also pass if the declaration were
        // moved to .iconWrap, which is already 48px.
        const cta = /\.cta\s*\{([^}]*)\}/.exec(cssSrc);
        expect(cta, 'no .cta rule found').not.toBeNull();
        expect(cta?.[1] ?? '').toContain('min-height: 44px');
    });

    it('declares a focus-visible style with outline (a11y)', () => {
        expect(cssSrc).toContain('focus-visible');
        expect(cssSrc).toContain('outline:');
    });

    it('collapses to a stacked layout below 600px width', () => {
        expect(cssSrc).toContain('@media (max-width: 600px)');
    });
});
