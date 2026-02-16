/**
 * Integration test: verifies hreflang tags are properly implemented in SEOHead.
 * Ensures all three locales (es, en, pt) plus x-default are generated.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seoHeadPath = resolve(__dirname, '../../src/components/seo/SEOHead.astro');
const content = readFileSync(seoHeadPath, 'utf8');

describe('Hreflang implementation', () => {
    describe('SUPPORTED_LOCALES', () => {
        it('should define all three supported locales', () => {
            expect(content).toContain("'es', 'en', 'pt'");
        });

        it('should be declared as const', () => {
            expect(content).toContain('as const');
        });
    });

    describe('generateAlternateUrl function', () => {
        it('should exist as a function', () => {
            expect(content).toContain('const generateAlternateUrl');
        });

        it('should accept targetLocale parameter', () => {
            expect(content).toContain('targetLocale: string');
        });

        it('should create URL from canonical', () => {
            expect(content).toContain('new URL(canonical)');
        });

        it('should replace locale in path', () => {
            expect(content).toContain('pathParts[0] = targetLocale');
        });

        it('should handle paths without existing locale', () => {
            expect(content).toContain('pathParts.unshift(targetLocale)');
        });

        it('should add trailing slash to generated URLs', () => {
            expect(content).toContain("url.pathname = `/${pathParts.join('/')}/`");
        });
    });

    describe('Hreflang link tags', () => {
        it('should render hreflang for es', () => {
            expect(content).toContain('hreflang="es"');
        });

        it('should render hreflang for en', () => {
            expect(content).toContain('hreflang="en"');
        });

        it('should render hreflang for pt', () => {
            expect(content).toContain('hreflang="pt"');
        });

        it('should render hreflang for x-default', () => {
            expect(content).toContain('hreflang="x-default"');
        });

        it('should use Spanish URL for x-default', () => {
            expect(content).toContain('hreflang="x-default" href={esUrl}');
        });

        it('should generate URLs for all three locales', () => {
            expect(content).toContain("const esUrl = generateAlternateUrl('es')");
            expect(content).toContain("const enUrl = generateAlternateUrl('en')");
            expect(content).toContain("const ptUrl = generateAlternateUrl('pt')");
        });
    });

    describe('Open Graph locale mapping', () => {
        it('should map es to es_AR', () => {
            expect(content).toContain("'es_AR'");
        });

        it('should map en to en_US', () => {
            expect(content).toContain("'en_US'");
        });

        it('should map pt to pt_BR', () => {
            expect(content).toContain("'pt_BR'");
        });
    });
});
