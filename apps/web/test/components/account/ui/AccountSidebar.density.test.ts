/**
 * @file AccountSidebar.density.test.ts
 * @description Pins the desktop row rhythm of the account sidebar. HOS-2549
 * tightened rows from 44px to 32px and the owner found that too tight, with
 * two-line labels touching the row edges. These assertions hold the retuned
 * values at source level (CSS modules are not laid out under Vitest).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../../../../src', file), 'utf8');
const sidebarCss = read('components/account/ui/AccountSidebar.module.css');
const shellCss = read('layouts/AccountShell.module.css');

/** Returns the body of the first `@media (min-width: 64rem)` block. */
const desktopBlock = (css: string): string => {
    const start = css.indexOf('@media (min-width: 64rem)');
    return start === -1 ? '' : css.slice(start);
};

describe('AccountSidebar desktop density', () => {
    it('uses 36px rows with a 4px gap (40px pitch) from 64rem', () => {
        const desktop = desktopBlock(sidebarCss);
        expect(desktop).toMatch(/\.link\s*{[^}]*min-block-size: var\(--space-9\);/);
        expect(desktop).toMatch(/\.list\s*{[^}]*gap: var\(--space-1\);/);
        expect(desktop).not.toMatch(/\.link\s*{[^}]*min-block-size: var\(--space-8\);/);
    });

    it('gives every link block padding so a wrapped label keeps air', () => {
        const base = sidebarCss.slice(0, sidebarCss.indexOf('@media'));
        expect(base).toMatch(/\.link\s*{[^}]*padding-block: var\(--space-2\);/);
    });

    it('keeps the icon on the first line of a wrapped label on desktop', () => {
        const desktop = desktopBlock(sidebarCss);
        expect(desktop).toMatch(/\.link\s*{[^}]*align-items: flex-start;/);
        expect(desktop).toMatch(/\.icon\s*{[^}]*block-size: 1\.25rem;/);
    });

    it('reserves the scrollbar gutter so it never reflows the labels', () => {
        expect(desktopBlock(shellCss)).toMatch(/\.sidebar\s*{[^}]*scrollbar-gutter: stable;/);
    });
});
