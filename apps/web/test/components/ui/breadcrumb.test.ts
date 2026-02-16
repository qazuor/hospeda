import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Breadcrumb.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Breadcrumb.astro', () => {
    describe('Semantic HTML', () => {
        it('should use nav element', () => {
            expect(content).toContain('<nav');
        });

        it('should have aria-label="Breadcrumb"', () => {
            expect(content).toContain('aria-label="Breadcrumb"');
        });

        it('should use ordered list', () => {
            expect(content).toContain('<ol');
        });

        it('should use list items', () => {
            expect(content).toContain('<li');
        });
    });

    describe('Current page', () => {
        it('should mark last item with aria-current="page"', () => {
            expect(content).toContain('aria-current="page"');
        });

        it('should render last item as span (not link)', () => {
            expect(content).toContain('isLast');
        });
    });

    describe('Separator', () => {
        it('should have separator between items', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use forward slash as separator', () => {
            expect(content).toContain('>/</span>');
        });
    });

    describe('Structured data', () => {
        it('should include JSON-LD script', () => {
            expect(content).toContain('application/ld+json');
        });

        it('should use BreadcrumbList schema', () => {
            expect(content).toContain('BreadcrumbList');
        });

        it('should include ListItem type', () => {
            expect(content).toContain('ListItem');
        });

        it('should include position property', () => {
            expect(content).toContain('position');
        });

        it('should include name and item properties', () => {
            expect(content).toContain('name: item.label');
            expect(content).toContain('item: new URL');
        });
    });

    describe('Props', () => {
        it('should accept items array', () => {
            expect(content).toContain('items: BreadcrumbItem[]');
        });

        it('should define BreadcrumbItem interface', () => {
            expect(content).toContain('interface BreadcrumbItem');
            expect(content).toContain('label: string');
            expect(content).toContain('href: string');
        });
    });

    describe('Styling', () => {
        it('should have small text size', () => {
            expect(content).toContain('text-sm');
        });

        it('should have muted color for inactive items', () => {
            expect(content).toContain('text-text-tertiary');
        });

        it('should have secondary color for current page', () => {
            expect(content).toContain('text-text-secondary');
        });

        it('should have primary color on hover for links', () => {
            expect(content).toContain('hover:text-primary');
        });

        it('should have transition for smooth color change', () => {
            expect(content).toContain('transition-colors');
        });
    });

    describe('Layout', () => {
        it('should use flexbox layout', () => {
            expect(content).toContain('flex');
        });

        it('should allow wrapping on multiple lines', () => {
            expect(content).toContain('flex-wrap');
        });

        it('should have vertical spacing', () => {
            expect(content).toContain('py-3');
        });
    });
});
