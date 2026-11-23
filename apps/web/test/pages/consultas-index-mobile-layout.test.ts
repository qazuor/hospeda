/**
 * @file consultas-index-mobile-layout.test.ts
 * @description Layout guards for the guest inbox rows (HOS-1767), now carried by
 * the kit `ListRow` inside a `DataList` (HOS-2481). The date no longer competes
 * with the name and excerpt on a narrow screen: below 40rem of the LIST's width
 * the trailing piece stacks under the content, and from 40rem the row is one
 * line. The page itself keeps no `<style>` block of its own.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(__dirname, '../../src');
const page = readFileSync(resolve(src, 'pages/[lang]/mi-cuenta/consultas/index.astro'), 'utf8');
const rowCss = readFileSync(resolve(src, 'components/account/ui/ListRow.module.css'), 'utf8');

/** Body of the first `selector {` rule found in `scope`. */
function ruleIn({
    scope,
    selector
}: {
    readonly scope: string;
    readonly selector: string;
}): string {
    const start = scope.indexOf(`${selector} {`);
    expect(start, `missing ${selector} rule`).toBeGreaterThanOrEqual(0);
    return scope.slice(start, scope.indexOf('}', start));
}

const wideAt = rowCss.indexOf('@container (width >= 40rem)');
const narrow = rowCss.slice(0, wideAt);
const wide = rowCss.slice(wideAt);

describe('mi-cuenta/consultas — inbox row layout (HOS-1767 on the kit)', () => {
    it('the page renders the kit inbox and keeps no style block', () => {
        expect(page).toContain('<ConversationInbox client:load');
        expect(page).not.toContain('<style');
    });

    it('TEST:1767:18 — below 40rem the trailing piece (date) stacks under the content', () => {
        expect(wideAt).toBeGreaterThan(-1);
        const row = ruleIn({ scope: narrow, selector: '.row' });
        expect(row).toContain('display: grid;');
        expect(row).toMatch(/"leading body"\s*"leading trailing"/);
    });

    it('TEST:1767:19 — from 40rem the row is one line with the date at the end', () => {
        const row = ruleIn({ scope: wide, selector: '.row' });
        expect(row).toContain('grid-template-areas: "leading body trailing actions";');
    });
});
