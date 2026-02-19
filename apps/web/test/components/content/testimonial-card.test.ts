/**
 * Tests for TestimonialCard component file content validation.
 * Validates props, structure, accessibility, styling, rating, and location prop.
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

        it('should accept optional role prop for backward compatibility', () => {
            expect(content).toContain('role?: string');
        });

        it('should accept optional location prop', () => {
            expect(content).toContain('location?: string');
        });

        it('should accept optional rating prop', () => {
            expect(content).toContain('rating?: number');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Border radius and hover', () => {
        it('should use rounded-xl on root element', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should apply hover lift effect', () => {
            expect(content).toContain('hover:-translate-y-1');
        });

        it('should apply shadow-xl on hover', () => {
            expect(content).toContain('hover:shadow-xl');
        });

        it('should use shadow-sm as default shadow', () => {
            expect(content).toContain('shadow-sm');
        });

        it('should use transition with duration', () => {
            expect(content).toContain('duration-300');
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
            expect(content).toContain('image');
        });
    });

    describe('Avatar', () => {
        it('should render avatar at enlarged size (h-20 w-20)', () => {
            expect(content).toContain('h-20');
            expect(content).toContain('w-20');
        });

        it('should use rounded-full for circular avatar', () => {
            expect(content).toContain('rounded-full');
        });

        it('should add white ring border to avatar', () => {
            expect(content).toContain('ring-2');
            expect(content).toContain('ring-white');
        });

        it('should use object-cover for image', () => {
            expect(content).toContain('object-cover');
        });

        it('should use lazy loading for image', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should have descriptive alt text with author name', () => {
            expect(content).toContain('alt=');
            expect(content).toContain('author');
        });
    });

    describe('Star rating', () => {
        it('should conditionally render star rating when rating prop provided', () => {
            expect(content).toContain('rating');
        });

        it('should use amber-400 color for filled stars', () => {
            expect(content).toContain('text-amber-400');
        });

        it('should render 5 stars total', () => {
            expect(content).toContain('5');
        });

        it('should have accessible aria-label for star rating', () => {
            expect(content).toContain('aria-label');
            expect(content).toContain('estrellas');
        });
    });

    describe('Location and role props', () => {
        it('should support location prop as alias for role', () => {
            expect(content).toContain('location');
        });

        it('should display location or role', () => {
            // location takes priority, role is fallback
            expect(content).toContain('location');
            expect(content).toContain('role');
        });
    });

    describe('Quote mark decoration', () => {
        it('should have large quote mark decoration', () => {
            expect(content).toContain('&ldquo;');
        });

        it('should hide quote mark from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Styling', () => {
        it('should have surface background', () => {
            expect(content).toContain('bg-surface');
        });

        it('should have padding', () => {
            expect(content).toContain('p-6');
        });

        it('should use italic text for quote', () => {
            expect(content).toContain('italic');
        });

        it('should use semibold font for author name', () => {
            expect(content).toContain('font-semibold');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic footer for author section', () => {
            expect(content).toContain('<footer>');
        });

        it('should use semantic blockquote for quote', () => {
            expect(content).toContain('<blockquote');
        });

        it('should use semantic cite for author', () => {
            expect(content).toContain('<cite');
        });
    });
});
