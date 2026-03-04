import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/blog/BlogPostCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('BlogPostCard.astro', () => {
    describe('Props', () => {
        it('should import BlogPostCardData from transforms', () => {
            expect(content).toContain('import type { BlogPostCardData } from');
            expect(content).toContain('lib/api/transforms');
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

        it('should use BlogPostCardData type for post prop', () => {
            expect(content).toContain('post: BlogPostCardData');
        });
    });

    describe('Border radius and shadow', () => {
        it('should use rounded-xl on root element', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should use shadow-md as default shadow', () => {
            expect(content).toContain('shadow-md');
        });

        it('should use overflow-hidden on root element', () => {
            expect(content).toContain('overflow-hidden');
        });
    });

    describe('Hover effects', () => {
        it('should apply translateY hover lift on card', () => {
            expect(content).toContain('hover:-translate-y-1');
        });

        it('should apply shadow-xl on hover', () => {
            expect(content).toContain('hover:shadow-xl');
        });

        it('should use transition with 300ms duration', () => {
            expect(content).toContain('duration-300');
        });

        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale-105');
        });
    });

    describe('Per-category color badge', () => {
        it('should use category variant for badge', () => {
            expect(content).toContain('variant="category"');
        });

        it('should have category color mapping', () => {
            expect(content).toContain('categoryColorMap');
        });

        it('should map TIPS to theme green token', () => {
            expect(content).toContain("TIPS: 'bg-green");
        });

        it('should map FOOD/GASTRONOMY to theme secondary token', () => {
            expect(content).toContain("GASTRONOMY: 'bg-secondary");
        });

        it('should map CARNIVAL to theme terracotta token', () => {
            expect(content).toContain("CARNIVAL: 'bg-terracotta");
        });

        it('should map CULTURE to theme info token', () => {
            expect(content).toContain("CULTURE: 'bg-info");
        });

        it('should map BEACH to theme primary token', () => {
            expect(content).toContain("BEACH: 'bg-primary");
        });

        it('should fallback to bg-primary for unknown categories', () => {
            expect(content).toContain("'bg-primary'");
        });
    });

    describe('Tag pills', () => {
        it('should conditionally render tag pills when tags provided', () => {
            expect(content).toContain('tags');
            expect(content).toContain('variant="tag"');
        });

        it('should limit tags to 3 items', () => {
            expect(content).toContain('slice(0, 3)');
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

        it('should preserve transition:name on image', () => {
            expect(content).toContain('transition:name=');
            expect(content).toContain('entity-');
        });
    });

    describe('Content', () => {
        it('should import Badge component', () => {
            expect(content).toContain("import Badge from '../ui/Badge.astro'");
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

    describe('Data source agnostic', () => {
        it('should not import DB models', () => {
            expect(content).not.toContain('@repo/db');
        });
    });

    describe('T-037: Source file integrity', () => {
        it('should be a non-empty readable file', () => {
            expect(content.length).toBeGreaterThan(0);
        });

        it('should contain a valid Astro component frontmatter block', () => {
            expect(content).toMatch(/^---/);
            expect(content).toContain('---');
        });

        it('should not have any broken import statements', () => {
            const imports = content.match(/^import .+from .+;?$/gm) ?? [];
            expect(imports.length).toBeGreaterThan(0);
        });

        it('should still export a valid Props interface', () => {
            expect(content).toContain('interface Props');
        });
    });
});
