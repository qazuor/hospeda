import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/blog/BlogPostCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('BlogPostCard.astro', () => {
    describe('Props', () => {
        it('should define BlogPostCardData interface', () => {
            expect(content).toContain('interface BlogPostCardData');
        });

        it('should accept post prop', () => {
            expect(content).toContain('post: BlogPostCardData');
        });

        it('should accept optional variant prop', () => {
            expect(content).toContain("variant?: 'default' | 'featured'");
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain('locale?: string');
        });
    });

    describe('Structure', () => {
        it('should use article element', () => {
            expect(content).toContain('<article');
        });

        it('should render image with alt text', () => {
            expect(content).toContain('<img');
            expect(content).toContain('alt=');
        });

        it('should use lazy loading for images', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should render title as h3', () => {
            expect(content).toContain('<h3');
        });

        it('should link to detail page via publicaciones route', () => {
            expect(content).toContain('/publicaciones/');
            expect(content).toContain('slug');
        });
    });

    describe('Content', () => {
        it('should import Badge component', () => {
            expect(content).toContain("import Badge from '../ui/Badge.astro'");
        });

        it('should display category badge', () => {
            expect(content).toContain('Badge');
            expect(content).toContain('category');
        });

        it('should display author name', () => {
            expect(content).toContain('authorName');
            expect(content).toContain('By');
        });

        it('should display reading time', () => {
            expect(content).toContain('readingTimeMinutes');
            expect(content).toContain('min read');
        });

        it('should display published date as time element', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime');
            expect(content).toContain('publishedAt');
        });

        it('should format date using toLocaleDateString', () => {
            expect(content).toContain('toLocaleDateString');
        });

        it('should display summary with line clamp', () => {
            expect(content).toContain('line-clamp');
            expect(content).toContain('summary');
        });
    });

    describe('Variant support', () => {
        it('should have different aspect ratios based on variant', () => {
            expect(content).toContain('aspect-[4/3]');
            expect(content).toContain('aspect-[16/9]');
        });

        it('should have different title sizes based on variant', () => {
            expect(content).toContain("variant === 'featured'");
        });

        it('should have different line clamp based on variant', () => {
            expect(content).toContain('line-clamp-2');
            expect(content).toContain('line-clamp-3');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic time element with datetime attribute', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime');
        });

        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h3');
        });
    });

    describe('Hover effects', () => {
        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale');
        });

        it('should change shadow on hover', () => {
            expect(content).toContain('hover:shadow-lg');
        });
    });

    describe('Data source agnostic', () => {
        it('should accept typed BlogPostCardData interface', () => {
            expect(content).toContain('interface BlogPostCardData');
        });

        it('should not import DB models', () => {
            expect(content).not.toContain('@repo/db');
        });
    });
});
