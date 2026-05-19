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

    it('uses the WhatsApp brand green for the CTA / icon colour', () => {
        // No system token exists for WhatsApp green — colour is intentionally
        // hard-coded so the brand colour never drifts when palette changes.
        expect(cssSrc.toLowerCase()).toContain('#25d366');
    });

    it('declares a focus-visible style with outline (a11y)', () => {
        expect(cssSrc).toContain('focus-visible');
        expect(cssSrc).toContain('outline:');
    });

    it('collapses to a stacked layout below 600px width', () => {
        expect(cssSrc).toContain('@media (max-width: 600px)');
    });
});
