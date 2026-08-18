/**
 * @file AiChatWidget.mobile-expand.guard.test.ts
 * @description Structural guard for the H-139 / HOS-552 mobile-hide rule on
 * the AI chat widget's expand toggle.
 *
 * `AiChatWidget.module.css` is mocked to a `String(prop)` identity proxy in
 * `AiChatWidget.test.tsx` (as CSS Modules are everywhere in this suite), so
 * jsdom-based component tests can assert WHICH class an element carries but
 * can never evaluate a real `@media` query — jsdom does not apply CSS layout
 * at all. This guard reads the ACTUAL stylesheet text instead and asserts the
 * mobile-hide rule is present, worded the way the component test assumes it
 * to be (`.expandButton` hidden, not `.iconButton` — that class is shared
 * with the close button and must stay visible).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(TEST_DIR, '../../../src/components/accommodation/AiChatWidget.module.css');

describe('AiChatWidget.module.css — HOS-552 / H-139 mobile-hide rule', () => {
    const css = readFileSync(CSS_PATH, 'utf-8');

    it('hides .expandButton under a max-width: 767px media query', () => {
        const mobileBlockMatch = css.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/);
        expect(mobileBlockMatch).not.toBeNull();

        const mobileBlock = mobileBlockMatch?.[1] ?? '';
        expect(mobileBlock).toContain('.expandButton');
        expect(mobileBlock).toContain('display: none;');
    });

    it('does not hide the shared .iconButton class outright (the close button must stay visible)', () => {
        // A bare `.iconButton { display: none; }` inside the mobile block would
        // hide the close button too, since both buttons share that base class
        // in the component. Only the more specific `.expandButton` may be hidden.
        const mobileBlockMatch = css.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/);
        const mobileBlock = mobileBlockMatch?.[1] ?? '';
        expect(mobileBlock).not.toMatch(/\.iconButton\s*\{/);
    });
});
