/**
 * @file ContributionBanner.test.ts
 * @description Source-reading unit tests for ContributionBanner.astro (SPEC-191 FR-6).
 *
 * Astro components cannot be rendered in Vitest/jsdom, so we follow the
 * project pattern (see WhatsAppCTA.test.ts) and assert on the source text:
 *   - Locked Props contract: title, description, ctaLabel, ctaHref, source, variant
 *   - Variant-driven icon (photos → ImageIcon, editors → EditIcon)
 *   - Internal CTA anchor pointing at ctaHref (no target=_blank)
 *   - Accessibility: aria-label on wrapper + CTA, decorative icon hidden
 *   - Analytics: hoisted script fires contribution_banner_clicked via
 *     trackEvent with the banner's source and variant
 *   - CSS module: design tokens only, focus-visible style, responsive stack
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/contributions/ContributionBanner.astro'),
    'utf8'
);

const cssSrc = readFileSync(
    resolve(__dirname, '../../../src/components/contributions/ContributionBanner.module.css'),
    'utf8'
);

describe('ContributionBanner.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file ContributionBanner.astro');
        });

        it('defines the locked Props contract (FR-6)', () => {
            expect(src).toContain('interface Props');
            expect(src).toContain('readonly title: string');
            expect(src).toContain('readonly description: string');
            expect(src).toContain('readonly ctaLabel: string');
            expect(src).toContain('readonly ctaHref: string');
            expect(src).toContain('readonly source: string');
            expect(src).toMatch(/readonly variant\?: 'photos' \| 'editors'/);
        });

        it('imports the variant icons from @repo/icons (not phosphor directly)', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('ImageIcon');
            expect(src).toContain('EditIcon');
            expect(src).not.toContain('@phosphor-icons/react');
        });

        it('imports CSS Module styles', () => {
            expect(src).toContain("from './ContributionBanner.module.css'");
        });
    });

    describe('variant handling', () => {
        it('selects the icon per variant (editors → EditIcon, photos → ImageIcon)', () => {
            expect(src).toMatch(/variant === 'editors'\s*\?\s*EditIcon\s*:\s*ImageIcon/);
        });

        it('applies a variant-specific style class', () => {
            expect(src).toContain('styles.editors');
            expect(src).toContain('styles.photos');
        });

        it('defaults the variant to photos', () => {
            expect(src).toMatch(/variant = 'photos'/);
        });
    });

    describe('rendering', () => {
        it('renders a semantic <aside> wrapper', () => {
            expect(src).toMatch(/<aside\b/);
        });

        it('points the CTA anchor at ctaHref', () => {
            expect(src).toMatch(/href=\{ctaHref\}/);
        });

        it('does NOT open in a new tab (internal navigation)', () => {
            expect(src).not.toContain('target="_blank"');
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

    describe('analytics (FR-9)', () => {
        it('tags the wrapper with data attributes for the click handler', () => {
            expect(src).toContain('data-contribution-banner');
            expect(src).toContain('data-source={source}');
            expect(src).toContain('data-variant={variant}');
        });

        it('fires the typed contribution_banner_clicked event via trackEvent', () => {
            expect(src).toContain("from '@/lib/analytics/posthog-client'");
            expect(src).toContain("from '@/lib/analytics/events'");
            expect(src).toContain('WebEvents.ContributionBannerClicked');
        });

        it('forwards the banner source and variant in the event props', () => {
            expect(src).toMatch(/source:\s*banner\?\.dataset\.source/);
            expect(src).toMatch(/variant:\s*banner\?\.dataset\.variant/);
        });

        it('re-binds on every view-transitions navigation (astro:page-load)', () => {
            // Hoisted module scripts run ONCE per session; after a VT swap
            // the banner elements are new and would otherwise lose tracking.
            expect(src).toContain('astro:page-load');
        });
    });
});

describe('ContributionBanner.module.css', () => {
    it('uses design tokens (CSS custom properties), no hardcoded hex colors', () => {
        expect(cssSrc).toContain('var(--');
        // No raw hex colours — variant accents come from brand tokens.
        expect(cssSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    it('styles the two variant accents from brand tokens', () => {
        expect(cssSrc).toContain('.photos');
        expect(cssSrc).toContain('.editors');
        expect(cssSrc).toContain('--brand-accent');
        expect(cssSrc).toContain('--brand-primary');
    });

    it('declares a focus-visible style with outline (a11y)', () => {
        expect(cssSrc).toContain('focus-visible');
        expect(cssSrc).toContain('outline:');
    });

    it('collapses to a stacked layout on narrow viewports (no horizontal overflow)', () => {
        expect(cssSrc).toContain('@media (max-width: 600px)');
        expect(cssSrc).toContain('flex-direction: column');
    });
});
