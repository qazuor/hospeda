import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource({ file }: { readonly file: string }): string {
    return readFileSync(resolve(__dirname, '../../src', file), 'utf8');
}

describe('wordmark caller integration', () => {
    it.each([
        'layouts/Header.astro',
        'layouts/Footer.astro',
        'layouts/AccountHeader.astro',
        'layouts/FocusShell.astro',
        'components/shared/navigation/MobileMenu.client.tsx',
        'components/account/ui/AccountFooter.tsx',
        'pages/[lang]/funcionalidades/index.astro'
    ])('%s renders exactly one shared brand inside the existing link', (file) => {
        const source = readSource({ file });
        expect(source.match(/<BrandWordmark\b/g)).toHaveLength(1);
        expect(source).toMatch(/<a\b[^>]*aria-label=[\s\S]*?<BrandWordmark\b[^>]*\/>\s*<\/a>/);
        expect(source).not.toMatch(/<BrandWordmark\b[^>]*client:/);
    });

    it('retains server-side optimization and asset fallbacks in Astro callers', () => {
        for (const file of [
            'layouts/Header.astro',
            'layouts/Footer.astro',
            'layouts/AccountHeader.astro',
            'layouts/FocusShell.astro'
        ]) {
            const source = readSource({ file });
            expect(source).toContain('= logoSrc.src');
            expect(source).toContain('await getImage(');
            expect(source).toContain('catch {');
        }
    });

    it('feeds funcionalidades the bundled asset URL without awaiting image optimization', () => {
        const features = readSource({ file: 'pages/[lang]/funcionalidades/index.astro' });
        expect(features).toContain('const brandLogoSrc = logoSrc.src;');
        expect(features).not.toContain('await getImage(');
    });

    it('keeps the funcionalidades hero image separate and the marketing footer inverse', () => {
        const features = readSource({ file: 'pages/[lang]/funcionalidades/index.astro' });
        expect(features).toMatch(/<Image\s+src=\{logoSrc\}[\s\S]*?class="fx-hero__logo"/);
        const footer = readSource({ file: 'layouts/Footer.astro' });
        expect(footer).toContain('tone="inverse"');
        // HOS-2655: the footer styles live in footer-base.css, imported by Footer.astro.
        expect(footer).toContain('import "./footer-base.css";');
        const footerCss = readSource({ file: 'layouts/footer-base.css' });
        expect(footerCss).toContain('background-color: var(--footer-bg)');
    });

    it('owns the account-header type tokens and compact responsive geometry', () => {
        const css = readSource({ file: 'components/shared/brand/BrandWordmark.module.css' });
        expect(css).toContain('font: var(--app-card-title)');
        expect(css).toContain('font-family: var(--font-heading)');
        expect(css).toContain('white-space: nowrap');
        expect(css).toContain('color: var(--footer-fg)');
        expect(css).toContain('--brand-mark-width: 34px');
        expect(css).toContain('--brand-mark-height: 36px');
        expect(css).toContain('@media (max-width: 1025px)');
        expect(css).not.toContain('font-decorative');
    });
});
