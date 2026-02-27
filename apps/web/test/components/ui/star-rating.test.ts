import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/StarRating.astro');
const content = readFileSync(componentPath, 'utf8');

describe('StarRating.astro', () => {
    describe('Props', () => {
        it('should accept rating prop', () => {
            expect(content).toContain('rating: number');
        });

        it('should accept optional reviewsCount', () => {
            expect(content).toContain('reviewsCount?: number');
        });

        it('should accept size prop with sm/md/lg options', () => {
            expect(content).toContain("size?: 'sm' | 'md' | 'lg'");
        });

        it('should default size to sm', () => {
            expect(content).toContain("size = 'sm'");
        });
    });

    describe('Star rendering', () => {
        it('should render 5 stars', () => {
            expect(content).toContain('length: 5');
        });

        it('should use SVG for stars', () => {
            expect(content).toContain('<svg');
        });

        it('should use clip-path for partial fill', () => {
            expect(content).toContain('clipPath');
            expect(content).toContain('fillPercent');
        });

        it('should calculate fill percentage correctly', () => {
            expect(content).toContain('Math.min(1, Math.max(0, rating - i)) * 100');
        });
    });

    describe('Conditional rendering', () => {
        it('should hide component when rating is 0', () => {
            expect(content).toContain('rating > 0');
        });

        it('should conditionally show review count', () => {
            expect(content).toContain('reviewsCount != null');
        });
    });

    describe('Design tokens', () => {
        it('should use --color-warning for filled stars', () => {
            expect(content).toContain('var(--color-warning)');
        });

        it('should use --color-border for empty stars', () => {
            expect(content).toContain('var(--color-border)');
        });
    });

    describe('Sizes', () => {
        it('should map sm to 14px', () => {
            expect(content).toContain('sm: 14');
        });

        it('should map md to 18px', () => {
            expect(content).toContain('md: 18');
        });

        it('should map lg to 22px', () => {
            expect(content).toContain('lg: 22');
        });
    });

    describe('Accessibility', () => {
        it('should have role=img on container', () => {
            expect(content).toContain('role="img"');
        });

        it('should have aria-label with rating value', () => {
            expect(content).toContain('aria-label=');
            expect(content).toContain('out of 5');
        });

        it('should hide individual stars from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Unique IDs', () => {
        it('should generate unique prefix for clip-paths', () => {
            expect(content).toContain('sr-');
            expect(content).toContain('__starRatingCounter');
            expect(content).toContain('`sr-${_starRatingCounter}`');
        });
    });
});
