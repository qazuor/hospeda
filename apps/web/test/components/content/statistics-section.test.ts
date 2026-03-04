/**
 * Tests for StatisticsSection.astro and CounterAnimation.client.tsx.
 * Validates structure, grid layout, SectionWrapper usage, counter animation import,
 * accessibility, and default statistics data.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionPath = resolve(__dirname, '../../../src/components/content/StatisticsSection.astro');
const sectionContent = readFileSync(sectionPath, 'utf8');

const counterPath = resolve(
    __dirname,
    '../../../src/components/content/CounterAnimation.client.tsx'
);
const counterContent = readFileSync(counterPath, 'utf8');

describe('StatisticsSection.astro', () => {
    describe('Props', () => {
        it('should accept optional backgroundImage prop', () => {
            expect(sectionContent).toContain('backgroundImage');
        });

        it('should accept optional stats array prop', () => {
            expect(sectionContent).toContain('stats');
        });

        it('should define StatItem type', () => {
            expect(sectionContent).toContain('StatItem');
        });
    });

    describe('SectionWrapper usage', () => {
        it('should import SectionWrapper', () => {
            expect(sectionContent).toContain('SectionWrapper');
        });

        it('should use image variant for background overlay', () => {
            expect(sectionContent).toContain('variant="image"');
        });
    });

    describe('SectionHeader usage', () => {
        it('should import SectionHeader', () => {
            expect(sectionContent).toContain('SectionHeader');
        });
    });

    describe('Grid layout', () => {
        it('should use 2-column grid on mobile', () => {
            expect(sectionContent).toContain('grid-cols-2');
        });

        it('should use 4-column grid on desktop', () => {
            expect(sectionContent).toContain('md:grid-cols-4');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(sectionContent).toContain("from '../../lib/i18n'");
        });

        it('should accept locale prop', () => {
            expect(sectionContent).toContain('locale');
        });

        it('should use t() for section header title', () => {
            expect(sectionContent).toMatch(
                /t\(\{[^}]*namespace:\s*'home'[^}]*key:\s*'statistics\.title'/s
            );
        });

        it('should use t() for stat labels', () => {
            expect(sectionContent).toContain("key: 'statistics.");
        });
    });

    describe('Default statistics', () => {
        it('should have default stat for accommodations (500)', () => {
            expect(sectionContent).toContain('500');
        });

        it('should have default stat for destinations (50)', () => {
            expect(sectionContent).toContain('50');
        });

        it('should have default stat for reviews (1000)', () => {
            expect(sectionContent).toContain('1000');
        });

        it('should have default stat for experience (10)', () => {
            expect(sectionContent).toContain('value: 10');
        });
    });

    describe('CounterAnimation integration', () => {
        it('should import CounterAnimation', () => {
            expect(sectionContent).toContain('CounterAnimation');
        });

        it('should use client:visible directive', () => {
            expect(sectionContent).toContain('client:visible');
        });
    });

    describe('Background fallback', () => {
        it('should have dark background fallback class', () => {
            expect(sectionContent).toContain('bg-primary-900');
        });
    });
});

describe('CounterAnimation.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export', () => {
            expect(counterContent).toContain('export const CounterAnimation');
        });

        it('should NOT have default export', () => {
            expect(counterContent).not.toContain('export default');
        });
    });

    describe('Props', () => {
        it('should accept targetValue prop', () => {
            expect(counterContent).toContain('targetValue');
        });

        it('should accept suffix prop', () => {
            expect(counterContent).toContain('suffix');
        });

        it('should accept label prop', () => {
            expect(counterContent).toContain('label');
        });
    });

    describe('Shared hook usage', () => {
        it('should import useViewportTrigger from shared hook', () => {
            expect(counterContent).toContain('useViewportTrigger');
        });

        it('should import useCountUp from shared hook', () => {
            expect(counterContent).toContain('useCountUp');
        });

        it('should import from hooks/useCountUp', () => {
            expect(counterContent).toContain("from '../../hooks/useCountUp'");
        });
    });

    describe('Accessibility', () => {
        it('should use aria-live for screen reader updates', () => {
            expect(counterContent).toContain('aria-live');
        });
    });

    describe('Animation config', () => {
        it('should use quart easing preset', () => {
            expect(counterContent).toContain("easing: 'quart'");
        });

        it('should animate over 2 seconds', () => {
            expect(counterContent).toContain('duration: 2000');
        });
    });

    describe('Display', () => {
        it('should display suffix after the number', () => {
            expect(counterContent).toContain('suffix');
        });

        it('should display prefix before the number', () => {
            expect(counterContent).toContain('prefix');
        });

        it('should display label below the number', () => {
            expect(counterContent).toContain('label');
        });

        it('should format number with es-AR locale using formatNumber from @repo/i18n', () => {
            expect(counterContent).toContain('formatNumber');
            expect(counterContent).toContain("from '@repo/i18n'");
            expect(counterContent).toContain('locale: bcp47');
        });
    });
});
