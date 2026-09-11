/**
 * commerce-completeness.test.ts
 *
 * Unit tests for the publish-readiness ("complete") contract (HOS-166 §6.6).
 * Pure function — no DB, no mocks needed.
 *
 * Moved from `packages/service-core/test/services/commerce/commerce-completeness.test.ts`
 * (HOS-166 R-5) alongside the function's relocation to `@repo/schemas`.
 */

import { describe, expect, it } from 'vitest';
import { ExperiencePublicContactInfoSchema } from '../../entities/experience/experience.access.schema.js';
import { CommerceEntityTypeEnum } from '../../enums/commerce-entity-type.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import {
    type CommerceListingCompletenessListing,
    resolveListingCompleteness
} from '../commerce-completeness.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const DESTINATION_ID = '00000000-0000-4000-a000-000000000002';

/** A fully-complete gastronomy listing snapshot. */
function makeCompleteGastronomyListing(): CommerceListingCompletenessListing {
    return {
        name: 'La Parrilla del Puerto',
        summary: 'A riverside parrilla with fresh grilled fish and steak.',
        description:
            'La Parrilla del Puerto has served the Concepción del Uruguay waterfront for over a decade, specializing in grilled fish and classic Argentine asado.',
        destinationId: DESTINATION_ID,
        ownerId: OWNER_ID,
        type: 'RESTAURANT',
        media: {
            featuredImage: {
                url: 'https://example.com/img.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        contactInfo: { mobilePhone: '+5493441234567' },
        openingHours: {
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                tue: { closed: true, shifts: [] },
                wed: { closed: true, shifts: [] },
                thu: { closed: true, shifts: [] },
                fri: { closed: true, shifts: [] },
                sat: { closed: true, shifts: [] },
                sun: { closed: true, shifts: [] }
            }
        },
        priceRange: 'MODERATE'
    };
}

/** A fully-complete experience listing snapshot (shared block + experience-specific price). */
function makeCompleteExperienceListing(): CommerceListingCompletenessListing {
    return {
        name: 'Kayak tour on the Uruguay river',
        summary: 'A guided two-hour kayak tour along the riverside.',
        description:
            'Explore the Uruguay river coastline by kayak with a certified local guide, including all safety equipment and a light snack.',
        destinationId: DESTINATION_ID,
        ownerId: OWNER_ID,
        type: 'TOUR_GUIDE',
        media: {
            featuredImage: {
                url: 'https://example.com/kayak.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        // HOS-924: `workEmail`, not `personalEmail` — a personal address is
        // never published on the experience page, so it cannot be the channel
        // that makes the listing reachable.
        contactInfo: { workEmail: 'guide@example.com' },
        priceFrom: 1500000,
        isPriceOnRequest: false
    };
}

// ---------------------------------------------------------------------------
// resolveListingCompleteness — gastronomy
// ---------------------------------------------------------------------------

describe('resolveListingCompleteness — gastronomy', () => {
    it('should return complete=true and missing=[] for a fully-complete listing', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: makeCompleteGastronomyListing()
        });

        expect(result.complete).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('should report "name" missing when name is empty', () => {
        const listing = { ...makeCompleteGastronomyListing(), name: '' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toContain('name');
    });

    it('should report "name" missing when name is null', () => {
        const listing = { ...makeCompleteGastronomyListing(), name: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('name');
    });

    it('should report "summary" missing when summary is below the minimum length', () => {
        const listing = { ...makeCompleteGastronomyListing(), summary: 'too short' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('summary');
    });

    it('should report "description" missing when description is below the minimum length', () => {
        const listing = { ...makeCompleteGastronomyListing(), description: 'too short' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('description');
    });

    it('should report "destinationId" missing when destinationId is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), destinationId: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('destinationId');
    });

    it('should report "ownerId" missing when ownerId is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), ownerId: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('ownerId');
    });

    it('should report "type" missing when type is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), type: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('type');
    });

    it('should report "media.featuredImage" missing when media is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), media: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('media.featuredImage');
    });

    it('should report "media.featuredImage" missing when featuredImage is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), media: {} };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('media.featuredImage');
    });

    it('should report "contactInfo" missing when no phone or email is set', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            contactInfo: { website: 'https://example.com' }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('contactInfo');
    });

    it('should NOT report "contactInfo" missing when only an email is set', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            contactInfo: { personalEmail: 'owner@example.com' }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).not.toContain('contactInfo');
    });

    it('should report "openingHours" missing when no day has a shift', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            openingHours: {
                timezone: 'America/Argentina/Buenos_Aires',
                days: {
                    mon: { closed: true, shifts: [] },
                    tue: { closed: true, shifts: [] },
                    wed: { closed: true, shifts: [] },
                    thu: { closed: true, shifts: [] },
                    fri: { closed: true, shifts: [] },
                    sat: { closed: true, shifts: [] },
                    sun: { closed: true, shifts: [] }
                }
            }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('openingHours');
    });

    it('should report "openingHours" missing when openingHours is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), openingHours: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('openingHours');
    });

    it('should report "priceRange" missing when priceRange is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), priceRange: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('priceRange');
    });

    it('should NOT require menuUrl, richDescription, or socialNetworks', () => {
        // These fields do not even exist on CommerceListingCompletenessListing —
        // this test documents the deliberate exclusion (spec §6.6) by asserting
        // a listing missing them entirely is still complete.
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: makeCompleteGastronomyListing()
        });

        expect(result.complete).toBe(true);
    });

    it('should accumulate every missing field, not stop at the first', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: {}
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toEqual([
            'name',
            'summary',
            'description',
            'destinationId',
            'ownerId',
            'type',
            'media.featuredImage',
            'contactInfo',
            'openingHours',
            'priceRange'
        ]);
    });
});

// ---------------------------------------------------------------------------
// resolveListingCompleteness — experience
// ---------------------------------------------------------------------------

describe('resolveListingCompleteness — experience', () => {
    it('should return complete=true and missing=[] for a fully-complete listing', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: makeCompleteExperienceListing()
        });

        expect(result.complete).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('should NOT require openingHours or priceRange (gastronomy-only fields)', () => {
        const listing = {
            ...makeCompleteExperienceListing(),
            openingHours: undefined,
            priceRange: undefined
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing
        });

        expect(result.complete).toBe(true);
        expect(result.missing).not.toContain('openingHours');
        expect(result.missing).not.toContain('priceRange');
    });

    it('should report shared-block fields missing the same way as gastronomy', () => {
        const listing = { ...makeCompleteExperienceListing(), name: '' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toEqual(['name']);
    });

    // -------------------------------------------------------------------------
    // HOS-166 PR-B: experience-specific `priceFrom` requirement
    // -------------------------------------------------------------------------

    describe('experience-specific priceFrom requirement (HOS-166 PR-B)', () => {
        it('should report "priceFrom" missing when priceFrom is 0 and isPriceOnRequest is false', () => {
            const listing = {
                ...makeCompleteExperienceListing(),
                priceFrom: 0,
                isPriceOnRequest: false
            };
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                listing
            });

            expect(result.complete).toBe(false);
            expect(result.missing).toContain('priceFrom');
        });

        it('should report "priceFrom" missing when priceFrom is absent', () => {
            const listing = {
                ...makeCompleteExperienceListing(),
                priceFrom: undefined,
                isPriceOnRequest: false
            };
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                listing
            });

            expect(result.missing).toContain('priceFrom');
        });

        it('should report "priceFrom" missing when priceFrom is negative', () => {
            const listing = {
                ...makeCompleteExperienceListing(),
                priceFrom: -100,
                isPriceOnRequest: false
            };
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                listing
            });

            expect(result.missing).toContain('priceFrom');
        });

        it('should NOT report "priceFrom" missing when isPriceOnRequest is true, even with priceFrom=0', () => {
            const listing = {
                ...makeCompleteExperienceListing(),
                priceFrom: 0,
                isPriceOnRequest: true
            };
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                listing
            });

            expect(result.complete).toBe(true);
            expect(result.missing).not.toContain('priceFrom');
        });

        it('should NOT report "priceFrom" missing when priceFrom is a positive integer', () => {
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                listing: makeCompleteExperienceListing()
            });

            expect(result.complete).toBe(true);
            expect(result.missing).not.toContain('priceFrom');
        });

        it('should NOT apply the priceFrom rule to gastronomy listings', () => {
            const listing = {
                ...makeCompleteGastronomyListing(),
                priceFrom: 0,
                isPriceOnRequest: false
            };
            const result = resolveListingCompleteness({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                listing
            });

            expect(result.complete).toBe(true);
            expect(result.missing).not.toContain('priceFrom');
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-924 — the publish gate must only accept channels the page publishes
// ---------------------------------------------------------------------------

/**
 * The bug: `hasReachableContactChannel` accepted any of SIX channels, while
 * `ExperiencePublicContactInfoSchema` publishes only four keys — of which only
 * three are a phone or an email. So an operator whose only contact was a
 * WhatsApp number (the natural channel for a guide or a boatman) passed every
 * validator, paid the subscription, published, and got a listing with no way to
 * be contacted. Nobody told him; the page looked complete.
 *
 * `homePhone` and `personalEmail` had the same problem — three fields, not one.
 *
 * These tests execute the gate rather than describing it, and the last block
 * derives its expectations from the public schema itself, so the two lists
 * cannot drift apart again without a red test.
 */
describe('HOS-924 — an experience cannot publish on a channel its page never shows', () => {
    /** Every phone/email key `contact_info` can hold. `website` is not a channel. */
    const ALL_CONTACT_CHANNELS = [
        'homePhone',
        'workPhone',
        'mobilePhone',
        'whatsapp',
        'personalEmail',
        'workEmail'
    ] as const;

    /** Values that satisfy the WRITE-side format for each key. */
    const SAMPLE_VALUE: Readonly<Record<(typeof ALL_CONTACT_CHANNELS)[number], string>> = {
        homePhone: '+543442111111',
        workPhone: '+543442222222',
        mobilePhone: '+5493447412233',
        whatsapp: '+5493447412233',
        personalEmail: 'guide.personal@gmail.com',
        workEmail: 'contacto@kayakaventura.com.ar'
    };

    /** Resolves an experience whose ONLY contact channel is `key`. */
    function resolveWithOnlyChannel(key: (typeof ALL_CONTACT_CHANNELS)[number]) {
        return resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: {
                ...makeCompleteExperienceListing(),
                contactInfo: { [key]: SAMPLE_VALUE[key] }
            }
        });
    }

    it('refuses to publish an experience whose only contact is WhatsApp', () => {
        const result = resolveWithOnlyChannel('whatsapp');

        expect(result.missing).toContain('contactInfo');
        expect(result.complete).toBe(false);
    });

    it('refuses to publish an experience whose only contact is a home phone', () => {
        const result = resolveWithOnlyChannel('homePhone');

        expect(result.missing).toContain('contactInfo');
        expect(result.complete).toBe(false);
    });

    it('refuses to publish an experience whose only contact is a personal email', () => {
        const result = resolveWithOnlyChannel('personalEmail');

        expect(result.missing).toContain('contactInfo');
        expect(result.complete).toBe(false);
    });

    it('publishes on a work phone alone', () => {
        expect(resolveWithOnlyChannel('workPhone').complete).toBe(true);
    });

    it('publishes on a mobile phone alone', () => {
        expect(resolveWithOnlyChannel('mobilePhone').complete).toBe(true);
    });

    it('publishes on a work email alone', () => {
        expect(resolveWithOnlyChannel('workEmail').complete).toBe(true);
    });

    it('still refuses a website as the only contact', () => {
        // Unchanged by HOS-924: it is published, but a site is not a channel
        // that reaches a person, and it never counted before either.
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: {
                ...makeCompleteExperienceListing(),
                contactInfo: { website: 'https://kayakaventura.com.ar' }
            }
        });

        expect(result.missing).toContain('contactInfo');
    });

    it('accepts a WhatsApp-only gastronomy listing — the narrowing is per-vertical', () => {
        // Applying the experience rule to gastronomy would make EVERY
        // gastronomy listing unpublishable: `GastronomyPublicSchema` publishes
        // no `contactInfo` at all. That hole is wider than a mis-calibrated
        // gate and is tracked separately.
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: {
                ...makeCompleteGastronomyListing(),
                contactInfo: { whatsapp: SAMPLE_VALUE.whatsapp }
            }
        });

        expect(result.missing).not.toContain('contactInfo');
        expect(result.complete).toBe(true);
    });

    describe('the gate and the public schema name the same channels', () => {
        /**
         * Read off the real schema, not restated here: this is the invariant
         * that broke. A key added to (or removed from) the published set
         * without the matching gate change turns one of these cases red.
         */
        const publishedKeys = new Set(Object.keys(ExperiencePublicContactInfoSchema.shape));

        it('publishes at least one contactable channel at all', () => {
            // Guards the loop below against a schema that published nothing:
            // every case would then assert "incomplete" and pass vacuously.
            const contactable = ALL_CONTACT_CHANNELS.filter((key) => publishedKeys.has(key));
            expect(contactable.length).toBeGreaterThan(0);
        });

        for (const key of ALL_CONTACT_CHANNELS) {
            it(`${key} alone ${publishedKeys.has(key) ? 'publishes' : 'does not publish'}`, () => {
                const result = resolveWithOnlyChannel(key);

                expect(result.complete).toBe(publishedKeys.has(key));
            });
        }
    });
});
