/**
 * Tests for redesigned HeroSection component.
 * Validates carousel shell, gradient overlay, React islands, and WaveDivider integration.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/HeroSection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('HeroSection.astro (Redesigned)', () => {
    describe('Props interface', () => {
        it('should define HeroSectionProps export', () => {
            expect(content).toContain('HeroSectionProps');
        });

        it('should accept slides array prop', () => {
            expect(content).toContain('slides:');
        });

        it('should accept accentSubtitle prop', () => {
            expect(content).toContain('accentSubtitle: string');
        });

        it('should accept headline prop', () => {
            expect(content).toContain('headline: string');
        });

        it('should accept subheadline prop', () => {
            expect(content).toContain('subheadline: string');
        });

        it('should accept searchLabels prop', () => {
            expect(content).toContain('searchLabels:');
        });

        it('should accept carouselLabels prop', () => {
            expect(content).toContain('carouselLabels:');
        });

        it('should accept locale prop', () => {
            expect(content).toContain('locale:');
        });

        it('should accept apiBaseUrl prop', () => {
            expect(content).toContain('apiBaseUrl: string');
        });

        it('should accept optional firstSectionFill prop', () => {
            expect(content).toContain('firstSectionFill?');
        });
    });

    describe('Full-viewport height', () => {
        it('should have min-h with 100vh or screen height', () => {
            expect(content).toMatch(/min-h-\[max\(100vh,600px\)\]|min-h-screen/);
        });
    });

    describe('Gradient overlay', () => {
        it('should have gradient overlay classes', () => {
            expect(content).toContain('bg-gradient-to-b');
        });

        it('should have aria-hidden on gradient overlay', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have absolute inset-0 on overlay', () => {
            expect(content).toContain('absolute inset-0');
        });
    });

    describe('React islands', () => {
        it('should import HeroCarousel', () => {
            expect(content).toContain('HeroCarousel');
        });

        it('should use client:load for HeroCarousel', () => {
            expect(content).toContain('client:load');
        });

        it('should import HeroSearchBar', () => {
            expect(content).toContain('HeroSearchBar');
        });
    });

    describe('WaveDivider', () => {
        it('should import WaveDivider', () => {
            expect(content).toContain('WaveDivider');
        });

        it('should position WaveDivider at bottom', () => {
            expect(content).toContain('absolute');
            expect(content).toContain('bottom-0');
        });
    });

    describe('Typography', () => {
        it('should render H1 with font-serif', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('font-serif');
        });

        it('should use display-hero font size token', () => {
            expect(content).toContain('fs-display-hero');
        });

        it('should use font-accent for accent subtitle', () => {
            expect(content).toContain('font-accent');
        });

        it('should use accent-subtitle font size token', () => {
            expect(content).toContain('fs-accent-subtitle');
        });
    });

    describe('Layout', () => {
        it('should use section element', () => {
            expect(content).toContain('<section');
        });

        it('should use overflow-hidden', () => {
            expect(content).toContain('overflow-hidden');
        });

        it('should have bg-gray-900 fallback', () => {
            expect(content).toContain('bg-gray-900');
        });
    });

    describe('Accessibility', () => {
        it('should render headline as h1 (not inside React island)', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{headline}');
        });

        it('should render text content as static Astro markup', () => {
            expect(content).toContain('{accentSubtitle}');
            expect(content).toContain('{subheadline}');
        });
    });
});
