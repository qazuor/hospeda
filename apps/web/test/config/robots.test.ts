import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('robots.txt', () => {
    const robotsPath = join(process.cwd(), 'public/robots.txt');
    const robotsContent = readFileSync(robotsPath, 'utf-8');

    it('contains User-agent directive', () => {
        expect(robotsContent).toContain('User-agent: *');
    });

    it('allows crawling of root path', () => {
        expect(robotsContent).toContain('Allow: /');
    });

    it('disallows auth routes with locale prefix', () => {
        expect(robotsContent).toContain('Disallow: /*/auth/');
    });

    it('disallows mi-cuenta routes with locale prefix', () => {
        expect(robotsContent).toContain('Disallow: /*/mi-cuenta/');
    });

    it('contains sitemap directive', () => {
        expect(robotsContent).toContain('Sitemap:');
    });

    it('references sitemap XML URL', () => {
        expect(robotsContent).toContain('https://hospeda.com.ar/sitemap-index.xml');
    });

    it('does not disallow crawling of public pages', () => {
        // Should NOT contain Disallow: / without wildcards
        const lines = robotsContent.split('\n');
        const disallowRoot = lines.some(
            (line) =>
                line.trim() === 'Disallow: /' ||
                line.trim() === 'Disallow: /es/' ||
                line.trim() === 'Disallow: /en/'
        );
        expect(disallowRoot).toBe(false);
    });
});
