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
    hasContact: true,
    publishReadiness: {
        capacity: 4,
        minNights: 1,
        bedrooms: 2,
        bathrooms: 1,
        hasMainImage: true
    }
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

describe('resolveEditorSectionStatuses — warns about what actually blocks (H-101)', () => {
    it('should flag the capacity section when bathrooms are missing', () => {
        // Arrange — the exact production listing: capacity 11, bedrooms 3,
        // minNights 1, no bathrooms. The hub showed NO warning on this section
        // and the publish was refused for that very field.
        const statuses = resolve({
            publishReadiness: {
                capacity: 11,
                minNights: 1,
                bedrooms: 3,
                bathrooms: undefined,
                hasMainImage: true
            }
        });

        // Assert
        expect(statuses.capacityPricing?.tone).toBe('blocking');
        expect(statuses.capacityPricing?.missingRequirementLabelKeys).toEqual([
            'host.properties.editor.publishRequirement.bathrooms'
        ]);
    });

    it('should surface minNights, which the editor never mentioned at all', () => {
        // Arrange — zero occurrences of `minNights` existed in this module
        // before H-101, so a listing blocked solely on it got no signal.
        const statuses = resolve({
            publishReadiness: {
                capacity: 4,
                minNights: null,
                bedrooms: 2,
                bathrooms: 1,
                hasMainImage: true
            }
        });

        // Assert
        expect(statuses.capacityPricing?.missingRequirementLabelKeys).toEqual([
            'host.properties.editor.publishRequirement.minNights'
        ]);
    });

    it('should group several missing fields of one section into a single line', () => {
        // Arrange
        const statuses = resolve({
            publishReadiness: {
                capacity: undefined,
                minNights: undefined,
                bedrooms: 2,
                bathrooms: undefined,
                hasMainImage: true
            }
        });

        // Assert — four separate rows would bury the section title; none at all
        // is what the old hub did.
        expect(statuses.capacityPricing?.missingRequirementLabelKeys).toEqual([
            'host.properties.editor.publishRequirement.capacity',
            'host.properties.editor.publishRequirement.minNights',
            'host.properties.editor.publishRequirement.bathrooms'
        ]);
    });

    it('should mark the photos section as BLOCKING, not advisory, without a main image', () => {
        // Arrange — H-101 mitad A. The old "⚠ Sin fotos" was a `warning` and
        // publishing went through anyway, leaving a public page with a broken
        // <img>. The owner decided on 14/08 that it must block.
        const statuses = resolve({
            photoCount: 0,
            publishReadiness: { ...COMPLETE.publishReadiness, hasMainImage: false }
        });

        // Assert
        expect(statuses.photos?.tone).toBe('blocking');
        expect(statuses.photos?.missingRequirementLabelKeys).toEqual([
            'host.properties.editor.publishRequirement.mainImage'
        ]);
    });

    it('should let a blocker overwrite the calm neutral line that used to hide it', () => {
        // Arrange — with a price and a guest count set, the section rendered
        // "4 huéspedes": a neutral, finished-looking line sitting directly on
        // top of the field that was refusing the publish.
        const statuses = resolve({
            maxGuests: 4,
            basePrice: 25000,
            publishReadiness: { ...COMPLETE.publishReadiness, bathrooms: undefined }
        });

        // Assert
        expect(statuses.capacityPricing?.tone).toBe('blocking');
        expect(statuses.capacityPricing?.labelKey).toBe(
            'host.properties.editor.hub.status.blockedFromPublishing'
        );
    });

    it('should keep advisory warnings advisory', () => {
        // Arrange — coordinates and contact are worth prompting for, but a
        // listing publishes fine without them. They must not be dressed up as
        // blockers, which is the mirror image of the H-101 mistake.
        const statuses = resolve({ hasCoordinates: false, hasContact: false });

        // Assert
        expect(statuses.location?.tone).toBe('warning');
        expect(statuses.contact?.tone).toBe('warning');
    });

    it('should report no blockers for a listing that meets every requirement', () => {
        // Arrange / Act
        const statuses = resolve();

        // Assert
        const blocking = Object.values(statuses).filter((s) => s.tone === 'blocking');
        expect(blocking).toEqual([]);
    });
});
