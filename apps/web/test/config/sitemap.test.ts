import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const configPath = resolve(__dirname, '../../astro.config.mjs');
const configContent = readFileSync(configPath, 'utf8');

describe('Sitemap Configuration', () => {
    it('should import sitemap integration', () => {
        expect(configContent).toContain("import sitemap from '@astrojs/sitemap'");
    });

    it('should configure sitemap in integrations array', () => {
        expect(configContent).toContain('sitemap({');
    });

    it('should have filter function', () => {
        expect(configContent).toContain('filter: (page) =>');
    });

    it('should exclude /auth/ paths from sitemap', () => {
        expect(configContent).toContain("'/auth/'");
    });

    it('should exclude /mi-cuenta/ paths from sitemap', () => {
        expect(configContent).toContain("'/mi-cuenta/'");
    });

    it('should use excludePatterns array', () => {
        expect(configContent).toContain('const excludePatterns = [');
        expect(configContent).toContain('/auth/');
        expect(configContent).toContain('/mi-cuenta/');
    });

    it('should filter pages using pattern matching', () => {
        expect(configContent).toContain('excludePatterns.some');
        expect(configContent).toContain('page.includes(pattern)');
    });

    it('should have explanatory comment', () => {
        expect(configContent).toContain('// Exclude auth and account pages from sitemap');
    });
});
