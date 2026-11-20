/**
 * @file VenuePromotionsManager.styles.test.ts
 * @description Static checks on the venue promotion form stylesheet (HOS-2395).
 *
 * jsdom does not apply CSS Modules, so the layout bug these rules fix cannot be
 * seen from a render test. On staging, `.form input { width: 100% }` stretched
 * every checkbox and cut off the weekday names in their chips, and
 * `.form label { display: grid }` stacked the «Activar franja semanal» checkbox
 * over its text. These checks pin the two rules that prevent that.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenuePromotionsManager.module.css'),
    'utf8'
);

/** Returns the declaration block of the first rule whose selector list matches. */
function ruleBody(selectorPattern: RegExp): string | null {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((match = ruleRe.exec(css))) {
        if (selectorPattern.test(match[1])) return match[2];
    }
    return null;
}

describe('VenuePromotionsManager.module.css', () => {
    it('never stretches checkboxes to the full width of their label', () => {
        const widthRules = [...css.matchAll(/([^{}]+)\{[^{}]*width:\s*100%[^{}]*\}/g)].map(
            (match) => match[1]
        );
        expect(widthRules.length).toBeGreaterThan(0);
        for (const selectors of widthRules) {
            for (const selector of selectors.split(',').map((part) => part.trim())) {
                if (/\binput\b/.test(selector)) {
                    expect(selector).toContain(':not([type="checkbox"])');
                }
            }
        }
    });

    it('lays out a checkbox label as a single row', () => {
        const body = ruleBody(/\.form label:has\(>\s*input\[type="checkbox"\]\)/);
        expect(body).not.toBeNull();
        expect(body).toMatch(/display:\s*flex/);
        expect(body).toMatch(/align-items:\s*center/);
    });
});
