/**
 * @file TextLink.css-order.guard.test.ts
 * @description Regression guard for the HOS-2611 visual drift.
 *
 * StatCard (`.link`) and Switch (`.lockedLink`) give TextLink their own `font`
 * through `className`. When TextLink's base rule set `font: inherit` at the
 * same specificity, the winner depended on which CSS chunk the bundler emitted
 * last. Importing LinkButton (which reuses TextLink.module.css) from more
 * islands moved that module into its own chunk, after the callers' rules:
 * every StatCard changed font, the dashboard grew 17px and ~280 kit visual
 * baselines shifted. The base `font` must stay at zero specificity.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(__dirname, '../../../../src/components/account/ui');
const read = (file: string): string => readFileSync(resolve(UI, file), 'utf8');

/** Returns the body of the first `<selector> {` block of a stylesheet. */
const ruleBody = (css: string, selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) return '';
    return css.slice(start, css.indexOf('}', start));
};

describe('TextLink base font never depends on CSS chunk order', () => {
    it('keeps `font` out of the `.root` rule', () => {
        // Arrange
        const css = read('TextLink.module.css');

        // Assert
        expect(ruleBody(css, '.root')).not.toMatch(/\bfont\s*:/);
    });

    it('declares the inherited font at zero specificity', () => {
        expect(ruleBody(read('TextLink.module.css'), ':where(.root)')).toMatch(/font:\s*inherit/);
    });

    it.each([
        ['StatCard.module.css', '.link'],
        ['Switch.module.css', '.lockedLink']
    ])('%s still overrides the font through %s', (file, selector) => {
        expect(ruleBody(read(file), selector)).toMatch(/\bfont\s*:/);
    });
});
