import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/EmptyState.astro');
const content = readFileSync(componentPath, 'utf8');

describe('EmptyState.astro', () => {
    describe('Props', () => {
        it('should accept title prop as required string', () => {
            expect(content).toContain('title: string');
        });

        it('should accept message prop as required string', () => {
            expect(content).toContain('message: string');
        });

        it('should accept optional cta prop with label and href', () => {
            expect(content).toContain('cta?:');
            expect(content).toContain('label: string');
            expect(content).toContain('href: string');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Structure', () => {
        it('should render title as h3', () => {
            expect(content).toContain('<h3');
            expect(content).toContain('{title}');
        });

        it('should render message as p', () => {
            expect(content).toContain('<p');
            expect(content).toContain('{message}');
        });

        it('should render SVG illustration', () => {
            expect(content).toContain('<svg');
            expect(content).toContain('xmlns="http://www.w3.org/2000/svg"');
        });
    });

    describe('Layout', () => {
        it('should use centered flex column layout', () => {
            expect(content).toContain('flex flex-col');
            expect(content).toContain('items-center');
            expect(content).toContain('justify-center');
        });

        it('should have text-center alignment', () => {
            expect(content).toContain('text-center');
        });

        it('should have max-width for readable content', () => {
            expect(content).toContain('max-w-md');
        });

        it('should have padding for spacing', () => {
            expect(content).toContain('px-6');
            expect(content).toContain('py-12');
        });

        it('should center horizontally with mx-auto', () => {
            expect(content).toContain('mx-auto');
        });
    });

    describe('Styling', () => {
        it('should style title with text-text and font-semibold', () => {
            expect(content).toContain('text-text');
            expect(content).toContain('font-semibold');
        });

        it('should style message with text-text-secondary', () => {
            expect(content).toContain('text-text-secondary');
        });

        it('should style SVG with text-text-secondary', () => {
            expect(content).toContain('text-text-secondary');
        });

        it('should apply appropriate spacing between elements', () => {
            expect(content).toContain('mb-6');
            expect(content).toContain('mb-3');
        });
    });

    describe('SVG Illustration', () => {
        it('should have proper width and height', () => {
            expect(content).toContain('w-24');
            expect(content).toContain('h-24');
        });

        it('should be hidden from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use stroke for icon style', () => {
            expect(content).toContain('stroke="currentColor"');
        });
    });

    describe('CTA Button', () => {
        it('should conditionally render CTA when provided', () => {
            expect(content).toContain('{cta &&');
        });

        it('should import Button component', () => {
            expect(content).toContain("import Button from './Button.astro'");
        });

        it('should render Button with cta href', () => {
            expect(content).toContain('href={cta.href}');
        });

        it('should render Button with cta label', () => {
            expect(content).toContain('{cta.label}');
        });

        it('should use primary variant for CTA', () => {
            expect(content).toContain('variant="primary"');
        });

        it('should use md size for CTA', () => {
            expect(content).toContain('size="md"');
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h3');
        });

        it('should use semantic HTML elements', () => {
            expect(content).toContain('<h3');
            expect(content).toContain('<p');
        });
    });

    describe('Documentation', () => {
        it('should have JSDoc comment', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe component purpose', () => {
            expect(content.toLowerCase()).toContain('empty state');
        });
    });
});
