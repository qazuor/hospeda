import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalCssPath = resolve(__dirname, '../../src/styles/global.css');
const globalCss = readFileSync(globalCssPath, 'utf8');

const tailwindCssPath = resolve(__dirname, '../../src/styles/tailwind.css');
const tailwindCss = readFileSync(tailwindCssPath, 'utf8');

describe('Design Tokens - global.css', () => {
    describe('Regional color palette', () => {
        const colorTokens = [
            '--color-primary',
            '--color-primary-dark',
            '--color-primary-light',
            '--color-secondary',
            '--color-secondary-dark',
            '--color-accent',
            '--color-accent-dark',
            '--color-accent-warm',
            '--color-bg-warm',
            '--color-text',
            '--color-text-secondary',
            '--color-text-tertiary',
            '--color-border',
            '--color-bg',
            '--color-surface',
            '--color-surface-alt',
            '--color-surface-warm',
            '--color-header-bg',
            '--color-success',
            '--color-warning',
            '--color-error',
            '--color-info'
        ];

        it.each(colorTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });

        it('should have --color-primary value of #0D7377 (Rio Uruguay teal)', () => {
            expect(globalCss).toMatch(/--color-primary:\s*#0D7377/i);
        });

        it('should have --color-primary-dark value of #0A5C5F', () => {
            expect(globalCss).toMatch(/--color-primary-dark:\s*#0A5C5F/i);
        });

        it('should have --color-primary-light value of #3D9B9E', () => {
            expect(globalCss).toMatch(/--color-primary-light:\s*#3D9B9E/i);
        });

        it('should have --color-secondary value of #D4870E (amber gold)', () => {
            expect(globalCss).toMatch(/--color-secondary:\s*#D4870E/i);
        });

        it('should have --color-accent value of #F0E6D6 (warm sand)', () => {
            expect(globalCss).toMatch(/--color-accent:\s*#F0E6D6/i);
        });

        it('should have --color-accent-dark value of #C25B3A (terracotta)', () => {
            expect(globalCss).toMatch(/--color-accent-dark:\s*#C25B3A/i);
        });

        it('should have --color-accent-warm value of #D4870E (amber)', () => {
            expect(globalCss).toMatch(/--color-accent-warm:\s*#D4870E/i);
        });

        it('should have --color-bg value of #FDFAF5 (river sand)', () => {
            expect(globalCss).toMatch(/--color-bg:\s*#FDFAF5/i);
        });

        it('should have warm brown text color #2C1810', () => {
            expect(globalCss).toMatch(/--color-text:\s*#2C1810/i);
        });

        it('should have --color-bg-warm value of #F0E6D6', () => {
            const rootSection = globalCss.split('[data-theme="dark"]')[0];
            expect(rootSection).toMatch(/--color-bg-warm:\s*#F0E6D6/i);
        });
    });

    describe('Primary color scale (50-950)', () => {
        const primaryScale = [
            '--color-primary-50',
            '--color-primary-100',
            '--color-primary-200',
            '--color-primary-300',
            '--color-primary-400',
            '--color-primary-500',
            '--color-primary-600',
            '--color-primary-700',
            '--color-primary-800',
            '--color-primary-900',
            '--color-primary-950'
        ];

        it.each(primaryScale)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Green color tokens', () => {
        it('should define --color-green', () => {
            expect(globalCss).toMatch(/--color-green:\s*#2D6A4F/i);
        });

        it('should define --color-green-dark', () => {
            expect(globalCss).toMatch(/--color-green-dark:\s*#1B4332/i);
        });

        it('should define --color-green-light', () => {
            expect(globalCss).toMatch(/--color-green-light:\s*#52B788/i);
        });
    });

    describe('Terracotta color tokens', () => {
        it('should define --color-terracotta', () => {
            expect(globalCss).toMatch(/--color-terracotta:\s*#C25B3A/i);
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
            '--radius-2xl',
            '--radius-full'
        ];

        it.each(radiusTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });
    });

    describe('Shadow tokens (warm-tinted)', () => {
        const shadowTokens = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];

        it.each(shadowTokens)('should define %s', (token) => {
            expect(globalCss).toContain(`${token}:`);
        });

        it('should use warm-tinted shadows with rgba(44, 24, 16, ...)', () => {
            expect(globalCss).toContain('rgba(44, 24, 16,');
        });
    });

    describe('Typography - Fraunces font', () => {
        it('should define --font-serif with Fraunces', () => {
            expect(globalCss).toContain('"Fraunces"');
        });

        it('should include Fraunces Fallback in serif stack', () => {
            expect(globalCss).toContain('"Fraunces Fallback"');
        });

        it('should define Fraunces Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Fraunces Fallback"');
        });

        it('should use Georgia as Fraunces Fallback source', () => {
            expect(globalCss).toContain('src: local("Georgia")');
        });

        it('should define --fraunces-hero variation settings', () => {
            expect(globalCss).toContain('--fraunces-hero:');
            expect(globalCss).toContain('"SOFT" 100');
            expect(globalCss).toContain('"WONK" 1');
        });

        it('should define --fraunces-section variation settings', () => {
            expect(globalCss).toContain('--fraunces-section:');
            expect(globalCss).toContain('"SOFT" 50');
        });

        it('should define --fraunces-default variation settings', () => {
            expect(globalCss).toContain('--fraunces-default:');
            expect(globalCss).toContain('"opsz" auto');
        });

        it('should NOT reference Playfair Display', () => {
            expect(globalCss).not.toContain('Playfair Display');
        });
    });

    describe('Typography scale tokens', () => {
        it('should define --fs-display-hero', () => {
            expect(globalCss).toContain('--fs-display-hero:');
        });

        it('should define --fs-display-section', () => {
            expect(globalCss).toContain('--fs-display-section:');
        });

        it('should define --fs-accent-subtitle with fluid clamp value', () => {
            expect(globalCss).toContain('--fs-accent-subtitle:');
            /* Uses clamp() for fluid scaling: min 1.375rem, max 1.625rem */
            expect(globalCss).toContain('--fs-accent-subtitle: clamp(');
        });

        it('should define --max-w-site with 1200px value', () => {
            expect(globalCss).toMatch(/--max-w-site:\s*1200px/);
        });
    });

    describe('Typography base tokens', () => {
        const typographyTokens = [
            '--font-serif',
            '--font-sans',
            '--font-accent',
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
    });

    describe('Accent font (Caveat)', () => {
        it('should define --font-accent CSS variable', () => {
            expect(globalCss).toContain('--font-accent:');
        });

        it('should include Caveat in --font-accent value', () => {
            const fontAccentMatch = globalCss.match(/--font-accent:\s*([^;]+);/);
            expect(fontAccentMatch).toBeTruthy();
            expect(fontAccentMatch![1]).toContain('Caveat');
        });

        it('should include cursive fallback in --font-accent', () => {
            const fontAccentMatch = globalCss.match(/--font-accent:\s*([^;]+);/);
            expect(fontAccentMatch).toBeTruthy();
            expect(fontAccentMatch![1]).toContain('cursive');
        });

        it('should define Caveat Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Caveat Fallback"');
        });

        it('should use font-display: swap for Caveat Fallback', () => {
            const caveatFallbackSection = globalCss
                .split('font-family: "Caveat Fallback"')[1]
                ?.split('}')[0];
            expect(caveatFallbackSection).toBeDefined();
            expect(caveatFallbackSection).toContain('font-display: swap');
        });
    });

    describe('Font fallback metrics', () => {
        it('should define Inter Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Inter Fallback"');
        });

        it('should use Arial as Inter Fallback', () => {
            expect(globalCss).toContain('src: local("Arial")');
        });

        it('should have ascent-override for Inter Fallback', () => {
            const interFallbackSection = globalCss
                .split('font-family: "Inter Fallback"')[1]
                ?.split('}')[0];
            expect(interFallbackSection).toBeDefined();
            expect(interFallbackSection).toContain('ascent-override:');
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

    describe('Dark mode - "Noche Estrellada"', () => {
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

        it('should use night blue background (#0F1A2E) not gray', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-bg:\s*#0F1A2E/i);
        });

        it('should have deep night surface (#1A2740)', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-surface:\s*#1A2740/i);
        });

        it('should have warm white text (#F0EDE8)', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-text:\s*#F0EDE8/i);
        });

        it('should have luminous teal primary (#3DBDC0) in dark mode', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-primary:\s*#3DBDC0/i);
        });

        it('should have night blue header (#0F1A2E)', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-header-bg:\s*#0F1A2E/i);
        });

        it('should have --color-bg-warm dark mode override of #1C1A15', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-bg-warm:\s*#1C1A15/i);
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

    it('should import textures.css', () => {
        expect(tailwindCss).toContain('@import "./textures.css"');
    });

    it('should define @theme inline block', () => {
        expect(tailwindCss).toContain('@theme inline');
    });

    describe('Theme color mappings', () => {
        const themeColors = [
            '--color-primary',
            '--color-secondary',
            '--color-accent',
            '--color-accent-warm',
            '--color-bg-warm',
            '--color-success',
            '--color-warning',
            '--color-error',
            '--color-info',
            '--color-green',
            '--color-green-dark',
            '--color-green-light',
            '--color-terracotta',
            '--color-terracotta-dark',
            '--color-terracotta-light'
        ];

        it.each(themeColors)('should map %s to Tailwind theme', (token) => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain(token);
        });
    });

    describe('Primary scale in theme', () => {
        const primaryScaleTokens = [
            '--color-primary-50',
            '--color-primary-100',
            '--color-primary-200',
            '--color-primary-500',
            '--color-primary-900',
            '--color-primary-950'
        ];

        it.each(primaryScaleTokens)('should map %s to Tailwind theme', (token) => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain(token);
        });
    });

    describe('Theme typography scale mappings', () => {
        const themeTypographyTokens = [
            '--fs-display-hero',
            '--fs-display-section',
            '--fs-accent-subtitle',
            '--font-accent'
        ];

        it.each(themeTypographyTokens)('should map %s to Tailwind theme', (token) => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain(token);
        });

        it('should map --max-w-site to Tailwind theme', () => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain('--max-w-site');
        });

        it('should map --radius-2xl to Tailwind theme', () => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toContain('--radius-2xl');
        });
    });

    describe('Base typography', () => {
        it('should set serif font for headings', () => {
            expect(tailwindCss).toContain('var(--font-serif)');
        });

        it('should set sans font for html', () => {
            expect(tailwindCss).toContain('var(--font-sans)');
        });

        it('should include font-variation-settings for headings', () => {
            expect(tailwindCss).toContain('font-variation-settings');
            expect(tailwindCss).toContain('var(--fraunces-default)');
        });

        it('should have h1 letter-spacing of -0.04em', () => {
            expect(tailwindCss).toContain('-0.04em');
        });

        it('should have h2 letter-spacing of -0.03em', () => {
            expect(tailwindCss).toContain('-0.03em');
        });

        it('should include focus-visible styles for accessibility', () => {
            expect(tailwindCss).toContain(':focus-visible');
        });
    });
});
