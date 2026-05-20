/**
 * @file publicar.test.ts
 * @description Source-reading tests for the host-onboarding landing page. The
 * Astro page cannot be rendered in Vitest, so we assert on the source text to
 * lock in the conditional eyebrow rendered when a tourist arrives from the
 * admin (`?from=admin`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/publicar/index.astro'), 'utf8');

describe('publicar/index.astro — from-admin eyebrow', () => {
    describe('SSR detection', () => {
        it('reads ?from=admin from Astro.url server-side', () => {
            expect(src).toContain("Astro.url.searchParams.get('from') === 'admin'");
            expect(src).toContain('const cameFromAdmin');
        });

        it('has no prerender = true (SSR is required to read query params)', () => {
            expect(src).not.toMatch(/export\s+const\s+prerender\s*=\s*true/);
        });
    });

    describe('eyebrow placement and structure', () => {
        it('renders the eyebrow inline inside the hero text block (not as a separate banner)', () => {
            // The eyebrow must appear before the hero tagline inside the same
            // .publicar-hero__text container. We assert ordering by index.
            const heroTextOpenIdx = src.indexOf('class="publicar-hero__text"');
            const eyebrowIdx = src.indexOf('publicar-hero__from-admin');
            const taglineIdx = src.indexOf('publicar-hero__tagline');

            expect(heroTextOpenIdx).toBeGreaterThan(-1);
            expect(eyebrowIdx).toBeGreaterThan(heroTextOpenIdx);
            expect(eyebrowIdx).toBeLessThan(taglineIdx);
        });

        it('only renders when cameFromAdmin is true', () => {
            expect(src).toMatch(/\{cameFromAdmin\s*&&\s*\(/);
        });

        it('exposes a data-testid hook for integration tests', () => {
            expect(src).toContain('data-testid="from-admin-eyebrow"');
        });
    });

    describe('accessibility', () => {
        it('uses role="status" so screen readers announce the contextual hint', () => {
            const eyebrowBlock = src.slice(src.indexOf('publicar-hero__from-admin'));
            expect(eyebrowBlock).toContain('role="status"');
        });

        it('sets aria-live="polite" to avoid interrupting screen readers', () => {
            const eyebrowBlock = src.slice(src.indexOf('publicar-hero__from-admin'));
            expect(eyebrowBlock).toContain('aria-live="polite"');
        });

        it('marks the icon as decorative with aria-hidden="true"', () => {
            const eyebrowBlock = src.slice(src.indexOf('publicar-hero__from-admin'));
            const iconBlock = eyebrowBlock.slice(0, eyebrowBlock.indexOf('</p>'));
            expect(iconBlock).toContain('aria-hidden="true"');
        });
    });

    describe('icon usage — Phosphor via @repo/icons, no emoji', () => {
        it('imports InfoIcon from @repo/icons', () => {
            expect(src).toContain("import { InfoIcon } from '@repo/icons'");
        });

        it('uses InfoIcon inside the eyebrow (not an inline emoji)', () => {
            const eyebrowBlock = src.slice(src.indexOf('publicar-hero__from-admin'));
            const block = eyebrowBlock.slice(0, eyebrowBlock.indexOf('</p>'));
            expect(block).toContain('<InfoIcon');
            // Earlier banner used the ℹ️ emoji — assert it is gone.
            expect(block).not.toContain('ℹ');
        });
    });

    describe('i18n wiring', () => {
        it('renders the host.fromAdminBanner.eyebrow translation key with a fallback', () => {
            expect(src).toContain("t('host.fromAdminBanner.eyebrow'");
        });
    });

    describe('styling — tokens, no hardcoded values', () => {
        it('does not bring back the deprecated banner border-left + warm surface combo', () => {
            expect(src).not.toContain('border-left: 4px solid var(--brand-accent)');
            expect(src).not.toContain('publicar-from-admin-wrap');
        });

        it('uses --core-muted-foreground for the eyebrow color', () => {
            const cssBlock = src.slice(src.indexOf('.publicar-hero__from-admin {'));
            expect(cssBlock).toContain('var(--core-muted-foreground)');
        });

        it('uses --brand-primary for the icon tint', () => {
            const cssBlock = src.slice(src.indexOf('.publicar-hero__from-admin svg {'));
            expect(cssBlock).toContain('var(--brand-primary)');
        });
    });
});
