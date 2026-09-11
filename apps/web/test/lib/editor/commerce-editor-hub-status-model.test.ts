/**
 * @file commerce-editor-hub-status-model.test.ts
 * @description Guards the commerce editor hub's status lines (HOS-1080).
 *
 * The rule these exist to hold is H-101, inherited from the accommodation hub:
 * never warn about what does not block while staying silent about what does.
 * That is why the blocking lines are READ from `resolveListingCompleteness`
 * rather than written here, and why the tests below drive them by making a real
 * field genuinely absent rather than by asserting against a hand-written list.
 */

import type { CommerceListingCompletenessListing } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    COMMERCE_MISSING_FIELD_SECTION,
    resolveCommerceEditorSectionStatuses
} from '@/lib/editor/commerce-editor-hub-status-model';

/** A gastronomy listing complete enough to publish. */
function completeListing(
    overrides: Partial<CommerceListingCompletenessListing> = {}
): CommerceListingCompletenessListing {
    return {
        name: 'La Parrilla',
        summary: 'Un resumen suficientemente largo para pasar la validación de completitud.',
        description:
            'Una descripción bastante más larga todavía, porque el mínimo de descripción es mayor que el de resumen y hace falta superarlo con holgura para que la ficha cuente como completa.',
        destinationId: '11111111-1111-4111-8111-111111111111',
        ownerId: 'owner-1',
        type: 'RESTAURANT',
        media: { featuredImage: { url: 'https://cdn.test/a.jpg' } },
        contactInfo: { mobilePhone: '+54 9 11 1234 5678' },
        openingHours: {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [{ open: '09:00', close: '18:00' }] } }
        },
        priceRange: 'MID',
        ...overrides
    } as unknown as CommerceListingCompletenessListing;
}

function resolve(
    listing: CommerceListingCompletenessListing,
    counts: { photoCount?: number; faqCount?: number; selectedCatalogCount?: number } = {}
) {
    return resolveCommerceEditorSectionStatuses({
        input: {
            vertical: 'gastronomy',
            listing,
            photoCount: counts.photoCount ?? 0,
            faqCount: counts.faqCount ?? 0,
            selectedCatalogCount: counts.selectedCatalogCount ?? 0
        }
    });
}

describe('resolveCommerceEditorSectionStatuses — neutral lines', () => {
    it('should count photos when there are any', () => {
        expect(resolve(completeListing(), { photoCount: 6 }).media).toEqual({
            labelKey: 'commerce.owner.editor.hub.status.photos',
            tone: 'neutral',
            params: { count: 6 }
        });
    });

    it('should say NOTHING rather than render a misleading zero', () => {
        // "0 fotos" reads as a measurement; an absence is not one. The row gets
        // no second line at all.
        const statuses = resolve(completeListing());

        expect(statuses.media).toBeUndefined();
        expect(statuses.faqs).toBeUndefined();
        expect(statuses.amenities).toBeUndefined();
    });

    it('should count FAQs and ticked catalog entries', () => {
        const statuses = resolve(completeListing(), { faqCount: 3, selectedCatalogCount: 11 });

        expect(statuses.faqs?.params).toEqual({ count: 3 });
        expect(statuses.amenities?.params).toEqual({ count: 11 });
    });
});

describe('resolveCommerceEditorSectionStatuses — blocking lines', () => {
    it('should report nothing blocking for a complete listing', () => {
        const statuses = resolve(completeListing());

        expect(Object.values(statuses).some((status) => status.tone === 'blocking')).toBe(false);
    });

    it('should name the missing field on the section that owns it', () => {
        const statuses = resolve(completeListing({ priceRange: null }));

        expect(statuses.price).toEqual({
            labelKey: 'commerce.owner.editor.hub.status.blockedFromPublishing',
            tone: 'blocking',
            missingRequirementLabelKeys: ['commerce.owner.checklist.field.priceRange']
        });
    });

    it('should group several missing fields of one section into ONE line', () => {
        // Five of the eight shared requirements live in basic info. Five stacked
        // warnings on one row is noise; one line naming all of them is the
        // actionable version.
        const statuses = resolve(completeListing({ name: '', summary: '', type: '' }));

        expect(statuses.basicInfo?.missingRequirementLabelKeys).toEqual([
            'commerce.owner.checklist.field.name',
            'commerce.owner.checklist.field.summary',
            'commerce.owner.checklist.field.type'
        ]);
    });

    it('should let a blocker OVERWRITE a calm neutral line on the same section', () => {
        // H-101 in one assertion: a section missing a publish requirement used to
        // render its neutral count instead — a complete-looking line sitting on
        // top of the very field refusing the publish.
        const statuses = resolve(completeListing({ media: null }), { photoCount: 6 });

        expect(statuses.media?.tone).toBe('blocking');
        expect(statuses.media?.missingRequirementLabelKeys).toEqual([
            'commerce.owner.checklist.field.featuredImage'
        ]);
    });

    it('should skip a missing field no section can fix', () => {
        // `ownerId` is not owner-editable anywhere in this editor. A blocking
        // line for it would name a page that does not contain the field.
        const statuses = resolve(completeListing({ ownerId: '' }));

        expect(COMMERCE_MISSING_FIELD_SECTION.ownerId).toBeUndefined();
        expect(Object.values(statuses).some((status) => status.tone === 'blocking')).toBe(false);
    });

    it('should apply the experience price rule rather than the gastronomy one', () => {
        // The vertical is what decides which fields are required at all, and it
        // reaches `resolveListingCompleteness` from the ROUTE's vocabulary.
        const statuses = resolveCommerceEditorSectionStatuses({
            input: {
                vertical: 'experience',
                listing: completeListing({
                    priceRange: null,
                    priceFrom: 0,
                    isPriceOnRequest: false
                }),
                photoCount: 0,
                faqCount: 0,
                selectedCatalogCount: 0
            }
        });

        expect(statuses.price?.missingRequirementLabelKeys).toEqual([
            'commerce.owner.checklist.field.priceFrom'
        ]);
    });
});
