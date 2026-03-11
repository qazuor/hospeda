/**
 * @file breadcrumb.test.ts
 * @description Tests for Breadcrumb.astro component.
 *
 * Verifies semantic HTML structure, link rendering, current page marking,
 * separator icons, JSON-LD structured data output, styling, and layout.
 * Astro components are tested by reading source content directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/Breadcrumb.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Breadcrumb.astro', () => {
    describe('Props interface', () => {
        it('should define BreadcrumbItem interface with label and href', () => {
            expect(content).toContain('interface BreadcrumbItem');
            expect(content).toContain('readonly label: string');
            expect(content).toContain('readonly href: string');
        });

        it('should accept items as a readonly array', () => {
            expect(content).toContain('readonly items: readonly BreadcrumbItem[]');
        });
    });

    describe('Semantic HTML structure', () => {
        it('should use a <nav> element as the root', () => {
            expect(content).toContain('<nav');
        });

        it('should have aria-label="Breadcrumb" on the nav element', () => {
            expect(content).toContain('aria-label="Breadcrumb"');
        });

        it('should use an ordered list <ol> for items', () => {
            expect(content).toContain('<ol');
        });

        it('should wrap each item in a <li> element', () => {
            expect(content).toContain('<li');
        });
    });

    describe('Link rendering', () => {
        it('should render non-last items as anchor links', () => {
            expect(content).toContain('<a');
            expect(content).toContain('href={item.href}');
        });

        it('should render the last item as a <span> (not a link)', () => {
            expect(content).toContain('isLast');
            expect(content).toContain('<span');
        });
    });

    describe('Current page marking', () => {
        it('should mark the last item with aria-current="page"', () => {
            expect(content).toContain('aria-current="page"');
        });

        it('should not apply aria-current to non-last items', () => {
            // aria-current should only be on the last item span, not on links
            expect(content).not.toContain('aria-current={true}');
        });
    });

    describe('Separator', () => {
        it('should use a ChevronRightIcon from @repo/icons as separator', () => {
            expect(content).toContain("import { ChevronRightIcon } from '@repo/icons'");
            expect(content).toContain('<ChevronRightIcon');
        });

        it('should only render the separator for items after the first (index > 0)', () => {
            expect(content).toContain('index > 0');
        });

        it('should hide the separator from screen readers with aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('JSON-LD structured data', () => {
        it('should include a JSON-LD script tag', () => {
            expect(content).toContain('application/ld+json');
        });

        it('should use BreadcrumbList schema type', () => {
            expect(content).toContain("'@type': 'BreadcrumbList'");
        });

        it('should use schema.org context', () => {
            expect(content).toContain("'@context': 'https://schema.org'");
        });

        it('should include ListItem type for each entry', () => {
            expect(content).toContain("'@type': 'ListItem'");
        });

        it('should include position (1-based index)', () => {
            expect(content).toContain('position: index + 1');
        });

        it('should include name and item properties from BreadcrumbItem', () => {
            expect(content).toContain('name: item.label');
            expect(content).toContain('item: Astro.site');
        });

        it('should resolve absolute URLs via Astro.site', () => {
            expect(content).toContain('new URL(item.href, Astro.site)');
        });

        it('should fall back to item.href when Astro.site is undefined', () => {
            expect(content).toContain(': item.href');
        });

        it('should serialize JSON-LD with JSON.stringify and set:html', () => {
            // .replace() sanitizes '<' chars for XSS protection (\\u003c)
            expect(content).toContain('set:html={JSON.stringify(jsonLd)');
            expect(content).toContain("replace(/</g, '\\\\u003c')");
        });
    });

    describe('Styling', () => {
        it('should use text-sm for the list text size', () => {
            expect(content).toContain('text-sm');
        });

        it('should use text-muted-foreground for non-active links', () => {
            expect(content).toContain('text-muted-foreground');
        });

        it('should use text-foreground for the current page item', () => {
            expect(content).toContain('text-foreground');
        });

        it('should apply hover:text-primary transition on links', () => {
            expect(content).toContain('hover:text-primary');
        });

        it('should use transition-colors for smooth hover transitions', () => {
            expect(content).toContain('transition-colors');
        });

        it('should use muted-foreground/60 for separator icon color', () => {
            expect(content).toContain('text-muted-foreground/60');
        });
    });

    describe('Layout', () => {
        it('should use flexbox on the list', () => {
            expect(content).toContain('flex');
        });

        it('should allow wrapping to multiple lines', () => {
            expect(content).toContain('flex-wrap');
        });

        it('should have vertical padding on the nav', () => {
            expect(content).toContain('py-3');
        });

        it('should align items to center', () => {
            expect(content).toContain('items-center');
        });
    });
});
