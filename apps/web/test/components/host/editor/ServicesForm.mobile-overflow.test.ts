/**
 * @fileoverview
 * Source-read regression for HOS-2156: on a phone, the amenity browser on the
 * services page was clipped at the right edge (search box, category chips and
 * tiles cut off).
 *
 * Root cause: the wrapper is a `<fieldset>`, whose user-agent default is
 * `min-inline-size: min-content`. The category chip row is a single long
 * horizontal line, so the fieldset grew to thousands of px and the card's
 * `overflow: hidden` clipped everything instead of letting the chip row scroll.
 *
 * jsdom does no layout, so this asserts the CSS rule that neutralises the UA
 * default is declared on the fieldset's class. It proves the rule is DECLARED,
 * not the rendered width. The rendered width was measured on staging at 390px:
 * the nav dropped from 3957px to 301px and became scrollable.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = resolve(__dirname, '../../../../src');
const formSrc = readFileSync(
    resolve(WEB_SRC, 'components/host/editor/forms/ServicesForm.client.tsx'),
    'utf8'
);
const cssSrc = readFileSync(
    resolve(WEB_SRC, 'components/host/editor/forms/ServicesForm.module.css'),
    'utf8'
);

/** Extracts the declaration block of a top-level `.className { ... }` rule. */
function ruleBody({ css, className }: { css: string; className: string }): string {
    const match = new RegExp(`(^|\\n)\\.${className}\\s*\\{([^}]*)\\}`).exec(css);
    return match?.[2] ?? '';
}

describe('ServicesForm amenity wrapper on narrow viewports (HOS-2156)', () => {
    it('wraps the picker in a fieldset styled by the `section` class', () => {
        // Arrange + Act
        const usesFieldsetSection = /<fieldset className=\{pickerSectionStyles\.section\}>/.test(
            formSrc
        );

        // Assert
        expect(usesFieldsetSection).toBe(true);
    });

    it('overrides the fieldset min-content minimum width so the chip row can scroll', () => {
        // Arrange
        const body = ruleBody({ css: cssSrc, className: 'section' });

        // Act
        const neutralised = /\bmin-(inline-size|width)\s*:\s*0(px)?\s*;/.test(body);

        // Assert
        expect(body).not.toBe('');
        expect(neutralised).toBe(true);
    });
});
