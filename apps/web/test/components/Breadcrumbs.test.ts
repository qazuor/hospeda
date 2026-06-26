/**
 * @file Breadcrumbs.test.ts
 * @description Source-reading unit tests for Breadcrumbs.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify structure, semantics, JSON-LD, and mobile behaviour.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/Breadcrumbs.astro'), 'utf8');

describe('Breadcrumbs.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file Breadcrumbs.astro');
        });

        it('defines a Props interface with items array', () => {
            expect(src).toContain('interface Props');
            expect(src).toContain('ReadonlyArray<BreadcrumbItem>');
        });

        it('defines BreadcrumbItem with label and optional href', () => {
            expect(src).toContain('readonly label: string');
            expect(src).toContain('readonly href?: string');
        });
    });

    describe('accessible navigation markup', () => {
        it('renders a <nav> element', () => {
            expect(src).toContain('<nav');
        });

        it('sets role="navigation" on the nav', () => {
            expect(src).toContain('role="navigation"');
        });

        it('sets aria-label="breadcrumb" on the nav', () => {
            expect(src).toContain('aria-label="breadcrumb"');
        });

        it('renders an ordered list <ol>', () => {
            expect(src).toContain('<ol');
        });

        it('renders list items <li>', () => {
            expect(src).toContain('<li');
        });

        it('marks the last item with aria-current="page"', () => {
            expect(src).toContain("aria-current={isLast ? 'page' : undefined}");
        });
    });

    describe('link vs plain text rendering', () => {
        it('renders links for items with href', () => {
            expect(src).toContain('<a href={item.href}');
        });

        it('uses the breadcrumbs__link class for link items', () => {
            expect(src).toContain('breadcrumbs__link');
        });

        it('renders span for the current (last) item without href', () => {
            expect(src).toContain('breadcrumbs__current--active');
        });

        it('renders separator between items', () => {
            expect(src).toContain('breadcrumbs__separator');
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('JSON-LD BreadcrumbList', () => {
        it('emits a <script type="application/ld+json">', () => {
            expect(src).toContain('type="application/ld+json"');
        });

        it('builds JSON-LD with @type BreadcrumbList', () => {
            expect(src).toContain("'@type': 'BreadcrumbList'");
        });

        it('populates itemListElement from items', () => {
            expect(src).toContain("'@type': 'ListItem'");
            expect(src).toContain('itemListElement');
        });

        it('sets position from index + 1', () => {
            expect(src).toContain('index + 1');
        });

        it('escapes < characters to prevent XSS', () => {
            expect(src).toContain("replace(/</g, '\\\\u003c')");
        });

        it('uses set:html to inject JSON-LD content', () => {
            expect(src).toContain('set:html={jsonLdContent}');
        });
    });

    describe('mobile collapse behaviour (> 3 items)', () => {
        it('computes hasMany flag when items.length > 3', () => {
            expect(src).toContain('items.length > 3');
        });

        it('adds hidden-mobile modifier class for middle items', () => {
            expect(src).toContain('breadcrumbs__item--hidden-mobile');
        });

        it('renders an ellipsis span for collapsed path', () => {
            expect(src).toContain('breadcrumbs__ellipsis');
        });

        it('provides a title tooltip with the full path', () => {
            expect(src).toContain('title={fullPathTitle}');
        });

        it('builds fullPathTitle by joining all labels', () => {
            expect(src).toContain("items.map((i) => i.label).join(' / ')");
        });

        it('hides middle items via CSS on mobile', () => {
            expect(src).toContain('max-width: 639px');
            expect(src).toContain('display: none');
        });
    });

    describe('styles', () => {
        it('uses --font-sans for breadcrumb text', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('uses --brand-primary for link colour', () => {
            expect(src).toContain('var(--brand-primary)');
        });

        it('uses --core-muted-foreground for separator and current', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('uses --text-body-sm for font size', () => {
            expect(src).toContain('var(--text-body-sm');
        });

        it('includes focus-visible rule for keyboard navigation', () => {
            expect(src).toContain(':focus-visible');
        });
    });
});
