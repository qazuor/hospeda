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

    describe('IntersectionObserver', () => {
        it('should use IntersectionObserver for viewport detection', () => {
            expect(counterContent).toContain('IntersectionObserver');
        });

        it('should use useEffect for setup', () => {
            expect(counterContent).toContain('useEffect');
        });

        it('should use useRef for element reference', () => {
            expect(counterContent).toContain('useRef');
        });

        it('should prevent re-triggering with hasAnimated ref', () => {
            expect(counterContent).toContain('hasAnimated');
        });
    });

    describe('Reduced motion', () => {
        it('should check prefers-reduced-motion', () => {
            expect(counterContent).toContain('prefers-reduced-motion');
        });
    });

    describe('Accessibility', () => {
        it('should use aria-live for screen reader updates', () => {
            expect(counterContent).toContain('aria-live');
        });
    });

    describe('Animation', () => {
        it('should use requestAnimationFrame for smooth animation', () => {
            expect(counterContent).toContain('requestAnimationFrame');
        });

        it('should use easeOutQuart easing function', () => {
            expect(counterContent).toContain('easeOutQuart');
        });

        it('should animate over 2 seconds', () => {
            expect(counterContent).toContain('2000');
        });

        it('should clean up with observer.disconnect', () => {
            expect(counterContent).toContain('observer.disconnect');
        });
    });

    describe('Display', () => {
        it('should display suffix after the number', () => {
            expect(counterContent).toContain('suffix');
        });

        it('should display label below the number', () => {
            expect(counterContent).toContain('label');
        });

        it('should use useState for current count value', () => {
            expect(counterContent).toContain('useState');
        });
    });
});
