/**
 * @fileoverview
 * Source-read regression for HOS-2156, kept after HOS-2488 replaced the
 * `<fieldset>` wrapper with the kit `Section`.
 *
 * Root cause of the original bug: the wrapper was a `<fieldset>`, whose
 * user-agent default is `min-inline-size: min-content`. The amenity browser's
 * category chip row is one long horizontal line, so the fieldset grew to
 * thousands of px and the card's `overflow: hidden` clipped the search box and
 * tiles on a phone. The kit `Section` body is a plain block, so the UA default
 * no longer applies; this asserts that nobody reintroduces a fieldset around
 * the picker.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = resolve(__dirname, '../../../../src');
const formSrc = readFileSync(
    resolve(WEB_SRC, 'components/host/editor/forms/ServicesForm.client.tsx'),
    'utf8'
);

describe('ServicesForm amenity wrapper on narrow viewports (HOS-2156)', () => {
    it('wraps the picker in the kit Section, not in a fieldset', () => {
        // Arrange + Act
        const usesKitSection = /<Section\b/.test(formSrc);
        const usesFieldset = /<fieldset\b/.test(formSrc);

        // Assert
        expect(usesKitSection).toBe(true);
        expect(usesFieldset).toBe(false);
    });

    it('does not depend on a local stylesheet that could re-add a min-content minimum', () => {
        // Arrange + Act
        const importsOwnCss = /ServicesForm\.module\.css/.test(formSrc);

        // Assert
        expect(importsOwnCss).toBe(false);
    });
});
