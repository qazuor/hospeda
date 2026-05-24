/**
 * @file generators/generate-css.test.ts
 * @description SPEC-153 T-153-16 — Unit tests for the CSS generator.
 *
 * These tests operate on the pure `buildCSS()` output (no filesystem IO).
 * The validator in T-153-17 will perform the round-trip against the seed
 * manifest; here we cover structural correctness, selector contracts, and
 * a few byte-for-byte canonical values so drift between the token modules
 * and the emitted CSS is caught early.
 */

import { describe, expect, it } from 'vitest';

import { adminDark } from '../themes/admin-dark.ts';
import { adminLight } from '../themes/admin-light.ts';
import { webDark } from '../themes/web-dark.ts';
import { webLight } from '../themes/web-light.ts';
import { SHADES, formatOKLCH, palettes, river } from '../tokens/colors.ts';
import { buildCSS } from './generate-css.ts';

const CSS = buildCSS();

/**
 * Extract the substring between `selector {` and the matching closing brace.
 * Naive matcher — works because the generator never nests blocks inside a
 * top-level theme block (the @media block is the only nested case and we
 * don't query into it via this helper).
 */
function blockOf(css: string, selector: string): string {
    const open = `${selector} {`;
    const start = css.indexOf(open);
    if (start === -1) throw new Error(`Selector not found: ${selector}`);
    const end = css.indexOf('\n}', start);
    if (end === -1) throw new Error(`Unterminated block: ${selector}`);
    return css.slice(start + open.length, end);
}

function countDeclarations(block: string): number {
    return [...block.matchAll(/^\s*--/gm)].length;
}

describe('buildCSS — header', () => {
    it('emits the auto-generated banner', () => {
        expect(CSS).toContain('@repo/design-tokens — auto-generated');
        expect(CSS).toContain('SPEC-153');
    });

    it('starts with the comment banner before any selector', () => {
        const firstSelector = CSS.indexOf(':root {');
        const headerClose = CSS.indexOf('*/');
        expect(headerClose).toBeGreaterThan(-1);
        expect(headerClose).toBeLessThan(firstSelector);
    });
});

describe('buildCSS — palette primitives', () => {
    const rootBlock = blockOf(CSS, ':root');

    it('emits a declaration for every palette × shade (100 total)', () => {
        const paletteCount = Object.keys(palettes).length;
        const expected = paletteCount * SHADES.length;
        expect(paletteCount).toBe(10);
        const matches = [...rootBlock.matchAll(/--palette-[a-z]+-\d+:/g)];
        expect(matches).toHaveLength(expected);
    });

    it('emits palettes in source order (brand → semantic → neutral)', () => {
        const expectedOrder = Object.keys(palettes);
        const seen: string[] = [];
        for (const match of rootBlock.matchAll(/--palette-([a-z]+)-50:/g)) {
            const [, name] = match;
            if (name && !seen.includes(name)) seen.push(name);
        }
        expect(seen).toEqual(expectedOrder);
    });

    it('emits river-500 byte-for-byte from formatOKLCH(river[500])', () => {
        const expected = `--palette-river-500: ${formatOKLCH(river[500])};`;
        expect(rootBlock).toContain(expected);
    });

    it('emits neutral with zero chroma and zero hue across all shades', () => {
        for (const shade of SHADES) {
            const expected = `--palette-neutral-${shade}: ${formatOKLCH(palettes.neutral[shade])};`;
            expect(rootBlock).toContain(expected);
            expect(rootBlock).toContain(' 0 0);'); // both c and h are 0 → trailing ` 0 0);`
        }
    });
});

describe('buildCSS — :root web-light declarations', () => {
    const rootBlock = blockOf(CSS, ':root');

    it(`emits all ${Object.keys(webLight).length} web-light keys inside :root`, () => {
        for (const key of Object.keys(webLight)) {
            expect(rootBlock).toContain(`--${key}:`);
        }
    });

    it('total :root declarations = 100 palettes + 142 webLight = 242', () => {
        const total = countDeclarations(rootBlock);
        expect(total).toBe(100 + Object.keys(webLight).length);
        expect(total).toBe(242);
    });

    it('emits --core-background byte-for-byte from the seed value', () => {
        expect(rootBlock).toContain('--core-background: oklch(0.985 0.002 210);');
    });

    it('emits relative-color expressions as raw strings (--primary-hover)', () => {
        expect(rootBlock).toContain(
            '--primary-hover: oklch(from var(--brand-primary) calc(l - 0.05) c h);'
        );
    });

    it('emits z-index as a plain number (no oklch wrap)', () => {
        expect(rootBlock).toContain('--z-modal: 100;');
        expect(rootBlock).toContain('--z-content: 10;');
    });

    it('emits semantic typography clamp() expressions verbatim', () => {
        expect(rootBlock).toMatch(/--text-hero: clamp\([^)]+\);/);
    });
});

describe('buildCSS — viewport media overrides', () => {
    it('emits the (min-width: 1600px) :root override block', () => {
        expect(CSS).toContain('@media (min-width: 1600px) {');
        const idx = CSS.indexOf('@media (min-width: 1600px) {');
        const close = CSS.indexOf('\n}', idx);
        const block = CSS.slice(idx, close + 2);
        expect(block).toContain('--container-max: 1500px;');
        expect(block).toContain(':root {');
    });

    it('container-max appears twice total (default in :root + media override)', () => {
        const occurrences = [...CSS.matchAll(/--container-max:/g)];
        expect(occurrences).toHaveLength(2);
    });
});

describe('buildCSS — web dark theme block', () => {
    const block = blockOf(CSS, '[data-theme="dark"]:not([data-app="admin"])');

    it(`emits all ${Object.keys(webDark).length} (=56) web dark overrides`, () => {
        for (const key of Object.keys(webDark)) {
            expect(block).toContain(`--${key}:`);
        }
        expect(countDeclarations(block)).toBe(Object.keys(webDark).length);
        expect(countDeclarations(block)).toBe(56);
    });

    it('flips primary-hover direction (calc(l + 0.07) in dark)', () => {
        expect(block).toContain(
            '--primary-hover: oklch(from var(--brand-primary) calc(l + 0.07) c h);'
        );
    });

    it('uses the dark-scoped selector exactly once', () => {
        const matches = [...CSS.matchAll(/\[data-theme="dark"\]:not\(\[data-app="admin"\]\)/g)];
        expect(matches).toHaveLength(1);
    });
});

describe('buildCSS — admin light theme block', () => {
    const block = blockOf(CSS, '[data-app="admin"]');

    it(`emits all ${Object.keys(adminLight).length} (=17) admin light declarations`, () => {
        for (const key of Object.keys(adminLight)) {
            expect(block).toContain(`--${key}:`);
        }
        expect(countDeclarations(block)).toBe(Object.keys(adminLight).length);
        expect(countDeclarations(block)).toBe(17);
    });

    it('color-primary references river[600] (denser admin shade)', () => {
        expect(block).toContain(`--color-primary: ${formatOKLCH(river[600])};`);
    });

    it('color-bg-elevated is pure white oklch(1 0 0)', () => {
        expect(block).toContain('--color-bg-elevated: oklch(1 0 0);');
    });
});

describe('buildCSS — admin dark theme block', () => {
    const block = blockOf(CSS, '[data-app="admin"][data-theme="dark"]');

    it(`emits all ${Object.keys(adminDark).length} (=14) admin dark overrides`, () => {
        for (const key of Object.keys(adminDark)) {
            expect(block).toContain(`--${key}:`);
        }
        expect(countDeclarations(block)).toBe(Object.keys(adminDark).length);
        expect(countDeclarations(block)).toBe(14);
    });

    it('shifts color-primary one shade lighter to river[500] in dark', () => {
        expect(block).toContain(`--color-primary: ${formatOKLCH(river[500])};`);
    });

    it('does NOT redeclare font-body or radius (those inherit from admin-light)', () => {
        expect(block).not.toContain('--font-body:');
        expect(block).not.toContain('--radius:');
    });
});

describe('buildCSS — selector ordering invariants', () => {
    it('emits blocks in the documented order: :root → @media → web-dark → admin-light → admin-dark', () => {
        const order = [
            ':root {',
            '@media (min-width: 1600px) {',
            '[data-theme="dark"]:not([data-app="admin"]) {',
            '[data-app="admin"] {',
            '[data-app="admin"][data-theme="dark"] {'
        ];
        const positions = order.map((needle) => CSS.indexOf(needle));
        for (const pos of positions) expect(pos).toBeGreaterThan(-1);
        const sorted = [...positions].sort((a, b) => a - b);
        expect(positions).toEqual(sorted);
    });

    it('terminates with a trailing newline', () => {
        expect(CSS.endsWith('\n')).toBe(true);
    });
});

describe('buildCSS — snapshot', () => {
    it('matches the recorded full output (regression gate)', () => {
        expect(CSS).toMatchSnapshot();
    });
});
