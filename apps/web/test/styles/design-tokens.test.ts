import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalCssPath = resolve(__dirname, '../../src/styles/global.css');
const globalCss = readFileSync(globalCssPath, 'utf8');

const tailwindCssPath = resolve(__dirname, '../../src/styles/tailwind.css');
const tailwindCss = readFileSync(tailwindCssPath, 'utf8');

describe('Design Tokens - global.css', () => {
    describe('Color tokens', () => {
        const colorTokens = [
            '--color-primary',
            '--color-primary-dark',
            '--color-primary-light',
            '--color-secondary',
            '--color-secondary-dark',
            '--color-accent',
            '--color-accent-dark',
            '--color-text',
            '--color-text-secondary',
            '--color-text-tertiary',
            '--color-border',
            '--color-bg',
            '--color-surface',
            '--color-success',
            '--color-warning',
            '--color-error',
            '--color-info'
        ];

        it.each(colorTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Spacing tokens', () => {
        const spacingTokens = [
            '--space-xs',
            '--space-sm',
            '--space-md',
            '--space-lg',
            '--space-xl',
            '--space-2xl',
            '--space-3xl',
            '--space-4xl'
        ];

        it.each(spacingTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Border radius tokens', () => {
        const radiusTokens = [
            '--radius-sm',
            '--radius-md',
            '--radius-lg',
            '--radius-xl',
            '--radius-full'
        ];

        it.each(radiusTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Shadow tokens', () => {
        const shadowTokens = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];

        it.each(shadowTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Typography tokens', () => {
        const typographyTokens = [
            '--font-serif',
            '--font-sans',
            '--font-size-xs',
            '--font-size-sm',
            '--font-size-base',
            '--font-size-lg',
            '--font-size-xl',
            '--font-size-2xl',
            '--font-size-3xl',
            '--font-size-4xl',
            '--font-size-5xl',
            '--line-height-tight',
            '--line-height-normal',
            '--line-height-relaxed'
        ];

        it.each(typographyTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });

        it('should include Inter Fallback font in sans stack', () => {
            expect(globalCss).toContain('Inter Fallback');
        });

        it('should include Playfair Display Fallback font in serif stack', () => {
            expect(globalCss).toContain('Playfair Display Fallback');
        });
    });

    describe('Font fallback metrics', () => {
        it('should define Inter Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Inter Fallback"');
        });

        it('should use Arial as Inter Fallback', () => {
            expect(globalCss).toContain('src: local("Arial")');
        });

        it('should define Playfair Display Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Playfair Display Fallback"');
        });

        it('should use Georgia as Playfair Display Fallback', () => {
            expect(globalCss).toContain('src: local("Georgia")');
        });

        it('should have ascent-override for Inter Fallback', () => {
            const interFallbackSection = globalCss
                .split('font-family: "Inter Fallback"')[1]
                ?.split('}')[0];
            expect(interFallbackSection).toBeDefined();
            expect(interFallbackSection).toContain('ascent-override:');
        });

        it('should have descent-override for Inter Fallback', () => {
            const interFallbackSection = globalCss
                .split('font-family: "Inter Fallback"')[1]
                ?.split('}')[0];
            expect(interFallbackSection).toBeDefined();
            expect(interFallbackSection).toContain('descent-override:');
        });

        it('should have size-adjust for Inter Fallback', () => {
            const interFallbackSection = globalCss
                .split('font-family: "Inter Fallback"')[1]
                ?.split('}')[0];
            expect(interFallbackSection).toBeDefined();
            expect(interFallbackSection).toContain('size-adjust:');
        });
    });

    describe('Transition tokens', () => {
        const transitionTokens = ['--transition-fast', '--transition-base', '--transition-slow'];

        it.each(transitionTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Z-index tokens', () => {
        const zIndexTokens = [
            '--z-base',
            '--z-dropdown',
            '--z-sticky',
            '--z-modal-backdrop',
            '--z-modal',
            '--z-toast'
        ];

        it.each(zIndexTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Dark mode', () => {
        it('should include dark mode skeleton with data-theme="dark"', () => {
            expect(globalCss).toContain('[data-theme="dark"]');
        });

        it('should override key color tokens in dark mode', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toContain('--color-text:');
            expect(darkSection).toContain('--color-bg:');
            expect(darkSection).toContain('--color-surface:');
        });
    });
});

describe('Tailwind Theme - tailwind.css', () => {
    it('should import tailwindcss', () => {
        expect(tailwindCss).toContain('@import "tailwindcss"');
    });

    it('should import global.css', () => {
        expect(tailwindCss).toContain('@import "./global.css"');
    });

    it('should define @theme inline block', () => {
        expect(tailwindCss).toContain('@theme inline');
    });

    describe('Theme color mappings', () => {
        const themeColors = [
            '--color-primary',
            '--color-secondary',
            '--color-accent',
            '--color-success',
            '--color-warning',
            '--color-error',
            '--color-info'
        ];

        it.each(themeColors)('should map %s to Tailwind theme', (token) => {
            // Check that it appears inside the @theme inline block
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain(token);
        });
    });

    describe('Base typography', () => {
        it('should set serif font for headings', () => {
            expect(tailwindCss).toContain('var(--font-serif)');
        });

        it('should set sans font for html', () => {
            expect(tailwindCss).toContain('var(--font-sans)');
        });

        it('should include focus-visible styles for accessibility', () => {
            expect(tailwindCss).toContain(':focus-visible');
        });
    });
});
