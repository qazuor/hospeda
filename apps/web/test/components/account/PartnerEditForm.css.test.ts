/**
 * @file PartnerEditForm.css.test.ts
 * @description Source-read tests pinning the field-row alignment of the
 * partner and host-trade edit forms (HOS-1767 AC:1767:6, :7, :8).
 *
 * The `.field` rule carries a top margin to separate a field that lives
 * outside a grid from the grid above it. Inside a grid the row gap already
 * spaces the cells, so that margin must not be applied to the grid's fields
 * — otherwise every cell but the first drops 16px below the row.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCss(fileName: string): string {
    return readFileSync(resolve(__dirname, '../../../src/components/account', fileName), 'utf8');
}

const partnerCss = readCss('PartnerEditForm.module.css');
const hostTradeCss = readCss('HostTradeEditForm.module.css');

describe('PartnerEditForm.module.css field alignment', () => {
    it('AC:1767:6 — removes the top margin from every field inside the grid', () => {
        expect(partnerCss).toMatch(/\.grid\s*>\s*\.field\s*\{[^}]*margin-top:\s*0;/);
        expect(partnerCss).not.toContain('.field:first-of-type');
    });

    it('AC:1767:7 — keeps the base top margin for a field outside the grid', () => {
        expect(partnerCss).toMatch(/\n\.field\s*\{[^}]*margin-top:\s*var\(--space-4, 16px\);/);
    });
});

describe('HostTradeEditForm.module.css field alignment', () => {
    it('AC:1767:8 — applies the same grid rule and drops the first-of-type exception', () => {
        expect(hostTradeCss).toMatch(/\.grid\s*>\s*\.field\s*\{[^}]*margin-top:\s*0;/);
        expect(hostTradeCss).not.toContain('.field:first-of-type');
        expect(hostTradeCss).toMatch(/\n\.field\s*\{[^}]*margin-top:\s*var\(--space-4, 16px\);/);
    });
});
