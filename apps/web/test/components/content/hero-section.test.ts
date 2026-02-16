/**
 * Tests for HeroSection component file content validation.
 * Validates props, structure, accessibility, and Tailwind classes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/HeroSection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('HeroSection - File content', () => {
    describe('Component documentation', () => {
        it('should have JSDoc documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe purpose as hero section', () => {
            expect(content).toContain('hero');
        });
    });

    describe('Props interface', () => {
        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept image prop', () => {
            expect(content).toContain('image: string');
        });

        it('should accept title prop', () => {
            expect(content).toContain('title: string');
        });

        it('should accept optional subtitle prop', () => {
            expect(content).toContain('subtitle?');
        });

        it('should accept optional cta prop with label and href', () => {
            expect(content).toContain('cta?');
            expect(content).toContain('label: string');
            expect(content).toContain('href: string');
        });
    });

    describe('Structure', () => {
        it('should use section element', () => {
            expect(content).toContain('<section');
            expect(content).toContain('</section>');
        });

        it('should render background image', () => {
            expect(content).toContain('<img');
            expect(content).toContain('{image}');
        });

        it('should render dark overlay', () => {
            expect(content).toContain('bg-black/50');
        });

        it('should render title as h1', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{title}');
        });

        it('should conditionally render subtitle', () => {
            expect(content).toContain('{subtitle');
        });

        it('should conditionally render CTA', () => {
            expect(content).toContain('{cta');
        });

        it('should import Button component for CTA', () => {
            expect(content).toContain('import Button from');
            expect(content).toContain('Button.astro');
        });
    });

    describe('Responsive design', () => {
        it('should have responsive min-height', () => {
            expect(content).toContain('min-h-[400px]');
            expect(content).toContain('md:min-h-[500px]');
        });

        it('should have responsive text sizing for title', () => {
            expect(content).toContain('text-4xl');
            expect(content).toContain('md:text-5xl');
            expect(content).toContain('lg:text-6xl');
        });

        it('should center content with max-width', () => {
            expect(content).toContain('max-w-4xl');
            expect(content).toContain('text-center');
        });
    });

    describe('Styling', () => {
        it('should use white text for title', () => {
            expect(content).toContain('text-white');
        });

        it('should use semi-transparent white for subtitle', () => {
            expect(content).toContain('text-white/80');
        });

        it('should have inline color styles for white text fallback', () => {
            expect(content).toContain('style="color: white;"');
        });

        it('should use full-cover image', () => {
            expect(content).toContain('object-cover');
        });

        it('should use eager loading for hero image', () => {
            expect(content).toContain('loading="eager"');
        });

        it('should use bold font for title', () => {
            expect(content).toContain('font-bold');
        });
    });

    describe('Accessibility', () => {
        it('should hide decorative background image from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use empty alt for decorative image', () => {
            expect(content).toContain('alt=""');
        });

        it('should use relative z-index for content above overlay', () => {
            expect(content).toContain('z-10');
        });
    });

    describe('Layout', () => {
        it('should use flexbox for vertical centering', () => {
            expect(content).toContain('flex');
            expect(content).toContain('items-center');
            expect(content).toContain('justify-center');
        });

        it('should use overflow hidden on section', () => {
            expect(content).toContain('overflow-hidden');
        });

        it('should use absolute positioning for image and overlay', () => {
            expect(content).toContain('absolute inset-0');
        });
    });
});
