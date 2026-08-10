/**
 * @file EditorRouteNav.test.ts
 * @description Source-level guards for the editor route nav (HOS-318 T-005/T-006).
 *
 * Vitest cannot render `.astro`, so these assertions read the source. That is a
 * weak instrument — it cannot tell a declared behaviour from a rendered one — so
 * it is used ONLY for properties that are genuinely textual (which imports
 * exist, which attribute names appear). The behaviour itself lives in
 * `editor-route-nav-model.ts` and is unit-tested for real there.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../../src/components/host/editor/EditorRouteNav.astro'),
    'utf8'
);

/**
 * The source with comments removed.
 *
 * A raw source match cannot tell code from prose: this file's own JSDoc explains
 * why it does NOT use `IntersectionObserver` and how it relates to
 * `EditorSectionNav`, so asserting their absence against the whole file fails on
 * the explanation rather than on any real usage. Absence claims must be made
 * against code only.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

describe('EditorRouteNav.astro — no JavaScript (AC-9)', () => {
    it('should not use IntersectionObserver', () => {
        // The scrollspy died with the split: the active item is the current
        // route, known at render time.
        expect(CODE).not.toContain('IntersectionObserver');
    });

    it('should not hydrate as an island', () => {
        expect(CODE).not.toMatch(/client:(load|idle|visible|only|media)/);
    });

    it('should not import React', () => {
        expect(CODE).not.toMatch(/from ['"]react['"]/);
    });

    it('should not import the scrollspy nav it replaces', () => {
        expect(CODE).not.toContain('EditorSectionNav');
    });

    it('should have a comment-stripper that actually strips (guard on the guard)', () => {
        // The four assertions above are only meaningful if CODE really drops
        // comments. If the regex silently stopped working they would pass by
        // matching nothing at all.
        expect(SOURCE).toContain('IntersectionObserver');
        expect(CODE.length).toBeLessThan(SOURCE.length);
    });
});

describe('EditorRouteNav.astro — delegates its logic', () => {
    it('should build its links from the shared model', () => {
        // If the component re-derived hrefs or the active state inline, the unit
        // tests in editor-route-nav-model.test.ts would be testing dead code.
        expect(SOURCE).toContain('buildEditorNavModel');
    });

    it('should not build section URLs by hand', () => {
        expect(CODE).not.toContain('/editar/${');
        expect(CODE).not.toContain('mi-cuenta/propiedades/');
    });
});

describe('EditorRouteNav.astro — accessibility', () => {
    it('should mark the current link with aria-current="page"', () => {
        expect(SOURCE).toContain("aria-current={link.isActive ? 'page' : undefined}");
    });

    it('should label the nav landmark', () => {
        expect(SOURCE).toMatch(/<nav[\s\S]*?aria-label=/);
    });

    it('should render group headings as text, not as bare styling', () => {
        expect(SOURCE).toContain('editor-route-nav__group-label');
        expect(SOURCE).toContain('{t(group.headingKey)}');
    });

    it('should give links a visible focus ring', () => {
        expect(SOURCE).toContain('focus-visible');
    });
});

describe('EditorRouteNav.astro — responsive contract (D-1)', () => {
    it('should be hidden by default and shown from the two-column breakpoint', () => {
        // Below 1100px the hub is the navigation; a sidebar there would eat the
        // screen the form needs.
        expect(SOURCE).toMatch(/\.editor-route-nav\s*\{\s*display:\s*none/);
        expect(SOURCE).toContain('@media (min-width: 1100px)');
    });

    it('should keep the pre-split sticky offset so desktop does not visibly move', () => {
        expect(SOURCE).toContain('position: sticky');
        expect(SOURCE).toContain('top: 110px');
    });
});

describe('EditorRouteNav.astro — styling rules', () => {
    it('should use design tokens rather than hardcoded colors', () => {
        const hardcoded = SOURCE.match(/color:\s*(#[0-9a-f]{3,8}|rgb\(|oklch\()/gi) ?? [];

        expect(hardcoded).toEqual([]);
    });
});
