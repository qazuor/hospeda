/**
 * @file editor-hub-status-model.test.ts
 * @description Guards the hub's per-section status lines (HOS-318 T-018).
 */

import { describe, expect, it } from 'vitest';
import {
    type EditorStatusInput,
    resolveEditorSectionStatuses
} from '@/lib/editor/editor-hub-status-model';

/** A fully-filled accommodation; each test overrides only what it is about. */
const COMPLETE: EditorStatusInput = {
    hasDescription: true,
    maxGuests: 4,
    basePrice: 25000,
    hasCoordinates: true,
    amenityCount: 8,
    featureCount: 4,
    photoCount: 6,
    faqCount: 3,
    hasContact: true
};

/** Resolves statuses for `COMPLETE` with the given overrides applied. */
function resolve(overrides: Partial<EditorStatusInput> = {}) {
    return resolveEditorSectionStatuses({ input: { ...COMPLETE, ...overrides } });
}

describe('resolveEditorSectionStatuses — never a misleading zero', () => {
    it('should render NO amenities line when nothing is selected', () => {
        // "0 seleccionados" reads as a measurement; the absence of a line reads
        // as "nothing to report", which is the truth.
        const statuses = resolve({ amenityCount: 0, featureCount: 0 });

        expect(statuses.amenities).toBeUndefined();
    });

    it('should render NO faqs line when there are none', () => {
        expect(resolve({ faqCount: 0 }).faqs).toBeUndefined();
    });

    it('should never emit a status whose count param is zero', () => {
        const statuses = resolve({ amenityCount: 0, featureCount: 0, faqCount: 0, photoCount: 0 });

        for (const [id, status] of Object.entries(statuses)) {
            expect(status.params?.count, `section ${id}`).not.toBe(0);
        }
    });
});

describe('resolveEditorSectionStatuses — warnings carry words', () => {
    it.each([
        ['location', { hasCoordinates: false }],
        ['basicInfo', { hasDescription: false }],
        ['photos', { photoCount: 0 }],
        ['contact', { hasContact: false }],
        ['capacityPricing', { basePrice: null }]
    ])('should warn on %s', (section, overrides) => {
        const statuses = resolve(overrides as Partial<EditorStatusInput>);

        expect(statuses[section]?.tone).toBe('warning');
    });

    it('should give every warning its own label key, not colour alone', () => {
        const statuses = resolve({
            hasCoordinates: false,
            hasDescription: false,
            photoCount: 0,
            hasContact: false
        });

        for (const [id, status] of Object.entries(statuses)) {
            if (status.tone === 'warning') {
                expect(status.labelKey, `section ${id}`).toBeTruthy();
            }
        }
    });
});

describe('resolveEditorSectionStatuses — neutral counts', () => {
    it('should sum amenities and features into one selection count', () => {
        const status = resolve({ amenityCount: 8, featureCount: 4 }).amenities;

        expect(status?.params?.count).toBe(12);
        expect(status?.tone).toBe('neutral');
    });

    it('should report the photo count', () => {
        expect(resolve().photos?.params?.count).toBe(6);
    });

    it('should report the guest capacity when a price exists', () => {
        expect(resolve().capacityPricing?.params?.count).toBe(4);
    });

    it('should prefer the missing-price warning over the guest count', () => {
        // A listing with guests but no price is not "up to 4 guests" — the
        // actionable fact is the missing price.
        const status = resolve({ basePrice: null, maxGuests: 4 });

        expect(status.capacityPricing?.tone).toBe('warning');
    });

    it('should say nothing about capacity when neither price nor guests are set', () => {
        expect(resolve({ basePrice: 25000, maxGuests: null }).capacityPricing).toBeUndefined();
    });
});

describe('resolveEditorSectionStatuses — silent sections', () => {
    it.each([
        'calendar',
        'translations',
        'externalReputation'
    ])('should render no line for %s', (section) => {
        // Describing these would need extra round-trips the hub must not pay
        // for. Absent from the map means the row shows only its title.
        expect(resolve()[section]).toBeUndefined();
    });

    it('should render nothing at all for a fully complete accommodation except counts', () => {
        const statuses = resolve();

        for (const status of Object.values(statuses)) {
            expect(status.tone).toBe('neutral');
        }
    });
});
