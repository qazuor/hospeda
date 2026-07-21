/**
 * @file features-content-veracity.test.ts
 * @description Regression guard for plan-catalog veracity on the
 * `/funcionalidades` page (HOS-213). Phantom entitlements (announced but not
 * implemented) must never render as a plain "✓". This test pins the two
 * marketing-only rows — CUSTOM_BRANDING and PRIORITY_SUPPORT — to the honest
 * `upcoming` cell kind so a future edit cannot silently restore a false yes.
 */

import { describe, expect, it } from 'vitest';
import { ANFITRIONES_TABLE_ROWS } from '../features-content';

function rowByLabelKey(labelKey: string) {
    const row = ANFITRIONES_TABLE_ROWS.find((r) => r.labelKey === labelKey);
    if (!row) throw new Error(`Row not found: ${labelKey}`);
    return row;
}

describe('features-content catalog veracity (HOS-213)', () => {
    it('CUSTOM_BRANDING is announced as upcoming, never a plain yes', () => {
        const row = rowByLabelKey('features.anfitriones.table.rows.customBranding.label');
        // Básico / Pro: not offered · Premium: upcoming (phantom, not shipped).
        expect(row.cells.map((c) => c.kind)).toEqual(['no', 'no', 'upcoming']);
    });

    it('PRIORITY_SUPPORT is announced as upcoming, never a plain yes', () => {
        const row = rowByLabelKey('features.anfitriones.table.rows.prioritySupport.label');
        expect(row.cells.map((c) => c.kind)).toEqual(['no', 'upcoming', 'upcoming']);
    });

    it('never marks a phantom entitlement as a shipped yes', () => {
        const phantomLabels = [
            'features.anfitriones.table.rows.customBranding.label',
            'features.anfitriones.table.rows.prioritySupport.label'
        ];
        for (const labelKey of phantomLabels) {
            const row = rowByLabelKey(labelKey);
            expect(row.cells.some((c) => c.kind === 'yes')).toBe(false);
        }
    });
});
