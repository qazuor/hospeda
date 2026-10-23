/**
 * @file consultas-index-mobile-layout.test.ts
 * @description Source-level layout guards for the guest inbox cards (HOS-1767).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas/index.astro'),
    'utf8'
);

const style = source.slice(source.indexOf('<style>'));
const mobileBreakpoint = '@media (max-width: 480px)';
const mobile = style.slice(style.lastIndexOf(mobileBreakpoint));
const base = style.slice(0, style.lastIndexOf(mobileBreakpoint));

function ruleIn({
    scope,
    selector
}: {
    readonly scope: string;
    readonly selector: string;
}): string {
    const start = scope.indexOf(`${selector} {`);
    expect(start, `missing ${selector} rule`).toBeGreaterThanOrEqual(0);
    const end = scope.indexOf('}', start);
    return scope.slice(start, end);
}

describe('mi-cuenta/consultas/index.astro — mobile card layout (HOS-1767)', () => {
    it('TEST:1767:18 — stacks the date under the content at 480px and below', () => {
        expect(style.split(mobileBreakpoint)).toHaveLength(2);

        const link = ruleIn({ scope: mobile, selector: '.messages-inbox__link' });
        expect(link).toContain('display: grid;');
        expect(link).toContain('grid-template-columns: 48px minmax(0, 1fr);');

        const avatar = ruleIn({ scope: mobile, selector: '.messages-inbox__avatar' });
        expect(avatar).toContain('grid-row: 1 / span 2;');

        const meta = ruleIn({ scope: mobile, selector: '.messages-inbox__meta' });
        expect(meta).toContain('grid-column: 2;');
        expect(meta).toContain('flex-direction: row;');
    });

    it('TEST:1767:19 — keeps the desktop flex rows unchanged', () => {
        const link = ruleIn({ scope: base, selector: '.messages-inbox__link' });
        expect(link).toContain('display: flex;');

        const meta = ruleIn({ scope: base, selector: '.messages-inbox__meta' });
        expect(meta).toContain('flex-direction: column;');
    });
});
