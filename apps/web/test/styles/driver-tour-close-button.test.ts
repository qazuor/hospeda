/**
 * @file driver-tour-close-button.test.ts
 * @description Regression for HOS-2448: the tour's close "×" must not share the
 * filled-button rules (it became an orange block over the title), and the title
 * must reserve room for it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../src/styles/driver-tour.css'), 'utf8');

/** Returns the declaration block of the rule whose selector list is exactly `selector`. */
function ruleFor(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
}

describe('driver tour close button (HOS-2448)', () => {
    it('does not paint the close button with the accent fill used by prev/next', () => {
        const filled =
            css.match(/\.driver-popover-prev-btn,\s*\.driver-popover-next-btn[^{]*\{/)?.[0] ?? '';
        expect(filled).not.toContain('close-btn');
        expect(ruleFor('.driver-popover-close-btn')).toMatch(/background-color:\s*transparent/);
    });

    it('shows a visible keyboard focus outline on the close button', () => {
        const focus =
            css.match(/\.driver-popover-close-btn:focus-visible\s*\{([^}]*outline:[^}]*)\}/)?.[1] ??
            '';
        expect(focus).toMatch(/outline:\s*2px solid var\(--brand-primary\)/);
    });

    it('reserves room beside the title so the close icon never covers it', () => {
        expect(ruleFor('.driver-popover-title')).toMatch(/padding-inline-end/);
    });
});
