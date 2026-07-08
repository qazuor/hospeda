import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/suscriptores/plan1.astro'),
    'utf8'
);

describe('Hidden test-daily-plan page (suscriptores/plan1.astro)', () => {
    it('should have prerender = false (SSR)', () => {
        expect(src).toContain('prerender = false');
    });

    it('should set noindex, nofollow robots meta tag', () => {
        expect(src).toContain('name="robots"');
        expect(src).toContain('content="noindex, nofollow"');
    });

    it('should use MarketingLayout', () => {
        expect(src).toContain('MarketingLayout');
    });

    it('should render the TestDailyPlanButton island with client:load', () => {
        expect(src).toContain('TestDailyPlanButton');
        expect(src).toContain('client:load');
    });

    it('should use CSS custom properties (no hardcoded colors)', () => {
        expect(src).toContain('var(--');
    });
});
