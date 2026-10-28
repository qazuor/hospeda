/** Source-based regression tests for the hero's responsive blob composition. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SECTION = resolve(__dirname, '../../../src/components/sections/HeroSection.astro');

/** Body of the first `@media (<query>) { ... }` block, comments stripped so they cannot satisfy assertions. */
function mediaBlockOf(css: string, query: string): string {
    const opener = `@media (${query}) {`;
    const start = css.indexOf(opener);
    expect(start, `${opener} not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + opener.length - 1; i < css.length; i++) {
        if (css[i] === '{') depth++;
        if (css[i] === '}') {
            depth--;
            if (depth === 0) return css.slice(start + opener.length, i);
        }
    }
    throw new Error(`unbalanced braces after ${opener}`);
}

/** Declarations of `selector` inside a media block body. */
function rulesOf(block: string, selector: string): string {
    const match = block.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
    expect(match, `${selector} rule not found`).not.toBeNull();
    return match?.[1] ?? '';
}

describe('HeroSection responsive blob', () => {
    const source = readFileSync(SECTION, 'utf8');
    const css = source.slice(source.indexOf('<style>')).replace(/\/\*[\s\S]*?\*\//g, '');

    it('should scale the tablet visual instead of cropping it', () => {
        // Arrange
        const tablet = mediaBlockOf(css, 'max-width: 1024px');

        // Act
        const visual = rulesOf(tablet, '.hero__visual');

        // Assert
        expect(visual).toMatch(/zoom:\s*0\.\d+/);
        expect(visual).not.toMatch(/max-height|overflow|height:/);
    });

    it('should keep two columns on tablet and stack only at 768px', () => {
        // Arrange
        const tablet = mediaBlockOf(css, 'max-width: 1024px');
        const stacked = mediaBlockOf(css, 'max-width: 768px');

        // Act
        const tabletRow = rulesOf(tablet, '.hero__row');
        const stackedRow = rulesOf(stacked, '.hero__row');

        // Assert
        expect(tabletRow).not.toContain('flex-direction');
        expect(stackedRow).toMatch(/flex-direction:\s*column/);
    });

    it('should reset the tablet zoom on the mobile full-bleed visual', () => {
        // Arrange
        const mobile = mediaBlockOf(css, 'max-width: 640px');

        // Act
        const visual = rulesOf(mobile, '.hero__visual');

        // Assert
        expect(visual).toMatch(/position:\s*absolute/);
        expect(visual).toMatch(/zoom:\s*1;/);
    });
});
