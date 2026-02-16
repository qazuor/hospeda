/**
 * Tests for TestimonialCard component file content validation.
 * Validates props, structure, accessibility, and semantic markup.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/TestimonialCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('TestimonialCard - File content', () => {
    describe('Component documentation', () => {
        it('should have JSDoc documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe purpose as testimonial card', () => {
            expect(content).toContain('Testimonial');
            expect(content).toContain('quote');
        });
    });

    describe('Props interface', () => {
        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept quote prop as string', () => {
            expect(content).toContain('quote: string');
        });

        it('should accept author prop as string', () => {
            expect(content).toContain('author: string');
        });

        it('should accept optional image prop', () => {
            expect(content).toContain('image?: string');
        });

        it('should accept optional role prop', () => {
            expect(content).toContain('role?: string');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Structure', () => {
        it('should use article element for semantic markup', () => {
            expect(content).toContain('<article');
            expect(content).toContain('</article>');
        });

        it('should use blockquote element for quote', () => {
            expect(content).toContain('<blockquote');
            expect(content).toContain('</blockquote>');
        });

        it('should use cite element for author', () => {
            expect(content).toContain('<cite');
            expect(content).toContain('</cite>');
        });

        it('should render quote content', () => {
            expect(content).toContain('{quote}');
        });

        it('should render author name', () => {
            expect(content).toContain('{author}');
        });

        it('should conditionally render image', () => {
            expect(content).toContain('{image &&');
        });

        it('should conditionally render role', () => {
            expect(content).toContain('{role &&');
        });
    });

    describe('Quote mark decoration', () => {
        it('should have large quote mark decoration', () => {
            expect(content).toContain('&ldquo;');
        });

        it('should use large text size for quote mark', () => {
            expect(content).toContain('text-5xl');
        });

        it('should use primary color with opacity for quote mark', () => {
            expect(content).toContain('text-primary/20');
        });

        it('should hide quote mark from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Styling', () => {
        it('should have rounded corners', () => {
            expect(content).toContain('rounded-lg');
        });

        it('should have border', () => {
            expect(content).toContain('border-border');
        });

        it('should have surface background', () => {
            expect(content).toContain('bg-surface');
        });

        it('should have padding', () => {
            expect(content).toContain('p-6');
        });

        it('should have shadow', () => {
            expect(content).toContain('shadow');
        });

        it('should use italic text for quote', () => {
            expect(content).toContain('italic');
        });

        it('should use text color for quote', () => {
            expect(content).toContain('text-text');
        });

        it('should use inline style for text color fallback', () => {
            expect(content).toContain('style="color: var(--color-text)');
        });

        it('should use tertiary text color for role', () => {
            expect(content).toContain('text-text-tertiary');
        });

        it('should use semibold font for author name', () => {
            expect(content).toContain('font-semibold');
        });

        it('should use small text size for role', () => {
            expect(content).toContain('text-sm');
        });
    });

    describe('Image handling', () => {
        it('should render avatar image with rounded full', () => {
            expect(content).toContain('rounded-full');
        });

        it('should have 48px image dimensions', () => {
            expect(content).toContain('h-12');
            expect(content).toContain('w-12');
        });

        it('should use object-cover for image', () => {
            expect(content).toContain('object-cover');
        });

        it('should use lazy loading for image', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should have explicit width and height attributes', () => {
            expect(content).toContain('width="48"');
            expect(content).toContain('height="48"');
        });

        it('should have descriptive alt text with author name', () => {
            expect(content).toContain('alt={`${author} avatar`}');
        });
    });

    describe('Layout', () => {
        it('should use flex layout for author section', () => {
            expect(content).toContain('flex');
            expect(content).toContain('items-center');
        });

        it('should have gap between avatar and text', () => {
            expect(content).toContain('gap-3');
        });

        it('should have margin bottom for quote mark', () => {
            expect(content).toContain('mb-4');
        });

        it('should have margin bottom for blockquote', () => {
            expect(content).toContain('mb-6');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic footer for author section', () => {
            expect(content).toContain('<footer>');
        });

        it('should remove italic style from cite element', () => {
            expect(content).toContain('not-italic');
        });

        it('should use semantic blockquote for quote', () => {
            expect(content).toContain('<blockquote');
        });

        it('should use semantic cite for author', () => {
            expect(content).toContain('<cite');
        });
    });
});
