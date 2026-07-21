/**
 * @file features-content-veracity.test.ts
 * @description Regression guard for plan-catalog veracity across BOTH plan
 * surfaces (HOS-213): the `/funcionalidades` brochure (`features-content.ts`)
 * and the plan comparison table (`plan-comparison-rows.ts`). Phantom
 * entitlements (announced but not implemented) must never render as a plain
 * "✓", and implemented features must not be under-represented as "upcoming".
 * These assertions pin each row so a future edit cannot silently regress the
 * honesty of the catalog.
 */

import { describe, expect, it } from 'vitest';
import { OWNER_ROWS } from '../../components/billing/plan-comparison-rows';
import { ANFITRIONES_TABLE_ROWS } from '../features-content';

function anfitrionesRow(labelKey: string) {
    const row = ANFITRIONES_TABLE_ROWS.find((r) => r.labelKey === labelKey);
    if (!row) throw new Error(`Row not found: ${labelKey}`);
    return row;
}

function ownerRow(id: string) {
    const row = OWNER_ROWS.find((r) => r.id === id);
    if (!row) throw new Error(`OWNER_ROWS row not found: ${id}`);
    return row;
}

describe('features-content catalog veracity — /funcionalidades (HOS-213)', () => {
    it('CUSTOM_BRANDING is announced as upcoming, never a plain yes', () => {
        const row = anfitrionesRow('features.anfitriones.table.rows.customBranding.label');
        // Básico / Pro: not offered · Premium: upcoming (phantom, not shipped).
        expect(row.cells.map((c) => c.kind)).toEqual(['no', 'no', 'upcoming']);
    });

    it('PRIORITY_SUPPORT is announced as upcoming, never a plain yes', () => {
        const row = anfitrionesRow('features.anfitriones.table.rows.prioritySupport.label');
        expect(row.cells.map((c) => c.kind)).toEqual(['no', 'upcoming', 'upcoming']);
    });

    it('never marks a phantom entitlement as a shipped yes', () => {
        const phantomLabels = [
            'features.anfitriones.table.rows.customBranding.label',
            'features.anfitriones.table.rows.prioritySupport.label'
        ];
        for (const labelKey of phantomLabels) {
            const row = anfitrionesRow(labelKey);
            expect(row.cells.some((c) => c.kind === 'yes')).toBe(false);
        }
    });
});

describe('plan-comparison-rows catalog veracity — comparison table (HOS-213)', () => {
    it('base calendar (CAN_USE_CALENDAR) is available for every owner plan', () => {
        const row = ownerRow('calendar');
        expect(row.cell.kind).toBe('all-yes');
        expect(row.status).toBe('available');
    });

    it('calendar sync (CAN_SYNC_EXTERNAL_CALENDAR) is available, pro+ only', () => {
        const row = ownerRow('calendarSync');
        expect(row.status).toBe('available');
        expect(row.cell).toEqual({ kind: 'literals', values: ['no', 'yes', 'yes'] });
    });

    it('featured (FEATURED_LISTING, shipped SPEC-309) is available, pro+ only', () => {
        const row = ownerRow('featured');
        expect(row.status).toBe('available');
        expect(row.cell).toEqual({ kind: 'literals', values: ['no', 'yes', 'yes'] });
    });

    it('priority support (phantom, no gate) is marked upcoming', () => {
        const row = ownerRow('prioritySupport');
        expect(row.status).toBe('upcoming');
    });

    it('custom branding (phantom, no gate) is marked upcoming', () => {
        const row = ownerRow('branding');
        expect(row.status).toBe('upcoming');
    });
});
