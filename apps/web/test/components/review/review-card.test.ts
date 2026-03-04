import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/review/ReviewCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('ReviewCard.astro', () => {
    describe('Props', () => {
        it('should define ReviewCardData interface', () => {
            expect(content).toContain('interface ReviewCardData');
        });

        it('should accept review prop', () => {
            expect(content).toContain('review: ReviewCardData');
        });

        it('should accept optional showEntity prop', () => {
            expect(content).toContain('showEntity?: boolean');
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain('locale?: string');
        });

        it('should include rating field in interface (1-5)', () => {
            expect(content).toContain('rating: number');
            expect(content).toContain('1-5');
        });

        it('should include optional entity fields', () => {
            expect(content).toContain('entityName?: string');
            expect(content).toContain('entitySlug?: string');
            expect(content).toContain('entityType?: string');
        });
    });

    describe('Structure', () => {
        it('should use article element', () => {
            expect(content).toContain('<article');
        });

        it('should have border and bg-surface styling', () => {
            expect(content).toContain('border');
            expect(content).toContain('bg-surface');
        });

        it('should have rounded corners and padding', () => {
            expect(content).toContain('rounded-lg');
            expect(content).toContain('p-4');
        });

        it('should render review title as h3', () => {
            expect(content).toContain('<h3');
            expect(content).toContain('review.title');
        });

        it('should render review content', () => {
            expect(content).toContain('review.content');
        });
    });

    describe('User info', () => {
        it('should display user name', () => {
            expect(content).toContain('review.userName');
        });

        it('should have avatar fallback with initials', () => {
            expect(content).toContain('review.userAvatar');
            expect(content).toContain('charAt(0)');
            expect(content).toContain('toUpperCase()');
        });

        it('should render avatar as rounded-full', () => {
            expect(content).toContain('rounded-full');
        });
    });

    describe('Star rating', () => {
        it('should render 5 stars', () => {
            expect(content).toContain('Array.from({ length: 5 }');
            expect(content).toContain('★');
        });

        it('should compare rating with index for filled stars', () => {
            expect(content).toContain('review.rating');
            expect(content).toContain('Math.round(review.rating)');
        });

        it('should use text-warning for filled stars', () => {
            expect(content).toContain('text-warning');
        });

        it('should use text-border for empty stars', () => {
            expect(content).toContain('text-border');
        });

        it('should have aria-label for accessibility', () => {
            expect(content).toContain('aria-label');
            expect(content).toContain('Rating:');
            expect(content).toContain('out of 5');
        });
    });

    describe('Date display', () => {
        it('should format createdAt date using formatDate from @repo/i18n', () => {
            expect(content).toContain('review.createdAt');
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
            expect(content).toContain('formatDate({');
        });

        it('should use time element with datetime attribute', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime=');
        });
    });

    describe('Content styling', () => {
        it('should use line-clamp-4 for content truncation', () => {
            expect(content).toContain('line-clamp-4');
        });

        it('should use font-semibold for title', () => {
            expect(content).toContain('font-semibold');
        });
    });

    describe('Entity reference', () => {
        it('should conditionally render entity based on showEntity', () => {
            expect(content).toContain('showEntity');
            expect(content).toContain('review.entityName');
        });

        it('should render entity link when slug is provided', () => {
            expect(content).toContain('review.entitySlug');
            expect(content).toContain('review.entityType');
        });

        it('should handle accommodation and destination entity types', () => {
            expect(content).toContain('alojamientos');
            expect(content).toContain('destinos');
        });

        it('should prefix entity reference with "Re:"', () => {
            expect(content).toContain('Re:');
        });
    });

    describe('Accessibility', () => {
        it('should use role="img" for star rating container', () => {
            expect(content).toContain('role="img"');
        });

        it('should use aria-hidden for individual stars', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should provide empty alt for avatar image', () => {
            expect(content).toContain('alt=""');
        });
    });

    describe('No hover effects', () => {
        it('should NOT have hover shadow effect (reviews are not clickable)', () => {
            expect(content).not.toContain('hover:shadow');
        });
    });
});
