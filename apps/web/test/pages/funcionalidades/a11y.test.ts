/**
 * @file a11y.test.ts
 * @description Lightweight accessibility guard-rail tests for the
 * `/[lang]/funcionalidades/` marketing page and its `PlanTable` sub-component
 * (HOS-119). These are source-string assertions, not a full axe/Lighthouse
 * sweep — the project's heavy a11y sweep (SPEC-294) runs against a built
 * site separately and is out of scope here. Complements T-008's structural
 * assertions with a11y-specific ones: focusable/named subnav links,
 * `aria-hidden` decorative elements, and reachability of the horizontally
 * scrolling plan tables.
 *
 * Tasks: T-011
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/funcionalidades/index.astro'),
    'utf8'
);
const planTableSrc = readFileSync(
    resolve(__dirname, '../../../src/components/features/PlanTable.astro'),
    'utf8'
);

describe('Funcionalidades page — subnav links are keyboard-operable', () => {
    it('renders subnav links as real anchor elements with an href (natively focusable)', () => {
        expect(pageSrc).toMatch(/<a href=\{`#\$\{link\.id\}`\}/);
    });

    it('gives every subnav link an accessible name via translated text content (not icon-only)', () => {
        // The link's only child is the translated label — no aria-hidden icon
        // masking it, no empty anchor relying on a title attribute alone.
        const linkBlockMatch = pageSrc.match(
            /<a href=\{`#\$\{link\.id\}`\}[^>]*>\s*\{t\(link\.labelKey\)\}\s*<\/a>/
        );
        expect(linkBlockMatch).not.toBeNull();
    });

    it('labels the subnav <nav> landmark with an aria-label', () => {
        expect(pageSrc).toMatch(/<nav class="fx-subnav" aria-label=\{t\(/);
    });
});

describe('Funcionalidades page — decorative hero blobs are hidden from assistive tech', () => {
    it('wraps the hero blob decorations in an aria-hidden="true" container', () => {
        const blobsBlockMatch = pageSrc.match(
            /<div class="fx-hero__blobs" aria-hidden="true">[\s\S]*?<\/div>/
        );
        expect(blobsBlockMatch).not.toBeNull();
        // All 4 blob spans live inside that single aria-hidden wrapper — none
        // of them need their own aria-hidden since the parent already hides
        // the whole subtree from assistive tech.
        expect(blobsBlockMatch?.[0]).toContain('fx-blob--1');
        expect(blobsBlockMatch?.[0]).toContain('fx-blob--4');
    });
});

describe('PlanTable — horizontally-scrollable region reachability', () => {
    it('wraps the table in a scrollable container (overflow-x: auto via .fx-tscroll)', () => {
        expect(planTableSrc).toContain('<div class="fx-tscroll"');
        expect(pageSrc).toContain(':global(.fx-tscroll) {');
    });

    /**
     * The `.fx-tscroll` wrapper is a keyboard-operable, named scroll region
     * (WCAG 2.1.1 / 1.4.10): `tabindex="0"` makes the horizontally-scrolling
     * plan table reachable by keyboard, and `role="region"` + `aria-label`
     * (the table's header label) name it for assistive tech.
     */
    it('makes the scroll wrapper keyboard-reachable (tabindex + role=region + aria-label)', () => {
        expect(planTableSrc).toContain('tabindex="0"');
        expect(planTableSrc).toContain('role="region"');
        expect(planTableSrc).toMatch(/aria-label=\{headerLabel\}/);
    });
});
