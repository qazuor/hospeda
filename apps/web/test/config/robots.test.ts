/**
 * @file robots.test.ts
 * @description Validates the robots.txt file for correct crawler directives,
 * sitemap reference, and that critical locale paths are not disallowed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const robotsContent = readFileSync(resolve(__dirname, '../../public/robots.txt'), 'utf8');

describe('robots.txt', () => {
    // ---------------------------------------------------------------------------
    // Required directives
    // ---------------------------------------------------------------------------
    describe('required directives', () => {
        it('should declare a wildcard User-agent', () => {
            // Arrange: the content is loaded above
            // Act + Assert
            expect(robotsContent).toContain('User-agent: *');
        });

        it('should explicitly allow the root path', () => {
            expect(robotsContent).toContain('Allow: /');
        });
    });

    // ---------------------------------------------------------------------------
    // Sitemap reference
    // ---------------------------------------------------------------------------
    describe('sitemap reference', () => {
        it('should reference a Sitemap URL', () => {
            expect(robotsContent).toContain('Sitemap:');
        });

        it('should reference the hospeda.com.ar sitemap', () => {
            expect(robotsContent).toContain('hospeda.com.ar/sitemap');
        });

        it('should reference an XML sitemap file', () => {
            expect(robotsContent).toMatch(/Sitemap:.*\.xml/);
        });
    });

    // ---------------------------------------------------------------------------
    // Locale paths must not be disallowed
    // ---------------------------------------------------------------------------
    describe('locale paths are not blocked', () => {
        it('should not disallow the /es/ path', () => {
            // Arrange
            const disallowLines = robotsContent
                .split('\n')
                .filter((line) => line.trim().startsWith('Disallow:'));

            // Act + Assert: none of the Disallow lines should match /es/
            const blocksEs = disallowLines.some((line) => {
                const path = line.replace('Disallow:', '').trim();
                return path === '/es/' || path === '/es';
            });
            expect(blocksEs).toBe(false);
        });

        it('should not disallow the /en/ path', () => {
            const disallowLines = robotsContent
                .split('\n')
                .filter((line) => line.trim().startsWith('Disallow:'));

            const blocksEn = disallowLines.some((line) => {
                const path = line.replace('Disallow:', '').trim();
                return path === '/en/' || path === '/en';
            });
            expect(blocksEn).toBe(false);
        });

        it('should not disallow the /pt/ path', () => {
            const disallowLines = robotsContent
                .split('\n')
                .filter((line) => line.trim().startsWith('Disallow:'));

            const blocksPt = disallowLines.some((line) => {
                const path = line.replace('Disallow:', '').trim();
                return path === '/pt/' || path === '/pt';
            });
            expect(blocksPt).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // Auth and account paths are disallowed (privacy protection)
    // ---------------------------------------------------------------------------
    describe('sensitive paths are blocked', () => {
        it('should disallow auth routes', () => {
            expect(robotsContent).toMatch(/Disallow:.*\/auth\//);
        });

        it('should disallow account routes', () => {
            expect(robotsContent).toMatch(/Disallow:.*\/mi-cuenta\//);
        });
    });

    // ---------------------------------------------------------------------------
    // Format checks
    // ---------------------------------------------------------------------------
    describe('format', () => {
        it('should not be empty', () => {
            expect(robotsContent.trim().length).toBeGreaterThan(0);
        });

        it('should have exactly one User-agent block', () => {
            const userAgentLines = robotsContent
                .split('\n')
                .filter((line) => line.trim().startsWith('User-agent:'));
            expect(userAgentLines.length).toBeGreaterThanOrEqual(1);
        });

        it('should have the Sitemap directive at the end or on its own line', () => {
            // Sitemap must be on a line by itself (not inline with another directive)
            const sitemapLine = robotsContent
                .split('\n')
                .find((line) => line.trim().startsWith('Sitemap:'));
            expect(sitemapLine).toBeDefined();
            expect(sitemapLine?.trim()).toMatch(/^Sitemap:\s+https?:\/\//);
        });
    });
});
