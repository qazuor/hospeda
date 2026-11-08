import { EntitlementKeyEnum as K } from './key-enums.js';
import type { ListingSectionDefinitionBase } from './listing-catalog.base-types.js';

/** All listing sections, grouped by vertical and ordered as in the editor. */
export const LISTING_SECTIONS = {
    venue: [
        {
            id: 'basicInfo',
            vertical: 'venue',
            common: true,
            fields: [
                'name',
                'slug',
                'summary',
                'description',
                'richDescription',
                'type',
                'destinationId',
                'refreshSlugFromName',
                'adminInfo',
                'tags',
                'rating',
                'seo'
            ],
            order: 1,
            group: 'property'
        },
        {
            id: 'openingHours',
            vertical: 'venue',
            common: true,
            fields: ['openingHours'],
            order: 2,
            group: 'property'
        },
        {
            id: 'price',
            vertical: 'venue',
            common: true,
            fields: ['priceRange'],
            order: 3,
            group: 'property'
        },
        {
            id: 'amenities',
            vertical: 'venue',
            common: true,
            // HOS-2060: the structured `policies` live with the catalog rows
            // they replaced; a section may claim keys inside it (`policyKeys`).
            fields: ['amenityIds', 'featureIds', 'policies'],
            order: 4,
            group: 'property'
        },
        {
            id: 'media',
            vertical: 'venue',
            common: true,
            fields: ['videos'],
            order: 5,
            group: 'content'
        },
        {
            id: 'contact',
            vertical: 'venue',
            common: true,
            fields: ['contactInfo', 'socialNetworks'],
            order: 6,
            group: 'content'
        },
        {
            id: 'menu',
            vertical: 'venue',
            common: false,
            entitlementKey: K.MANAGE_VENUE_MENU,
            fields: ['menuUrl'],
            readOnlyFields: ['menuFileUrl', 'menuFileKind', 'menuSections'],
            traits: [
                { id: 'itemPhotos', entitlementKey: K.MENU_ITEM_PHOTOS },
                { id: 'translations', entitlementKey: K.MULTILINGUAL_VENUE_MENU },
                { id: 'qr', entitlementKey: K.MENU_QR_SCAN_METRICS },
                { id: 'qrMetrics', entitlementKey: K.MENU_QR_SCAN_METRICS }
            ],
            order: 7,
            group: 'content'
        },
        {
            id: 'dailySpecials',
            vertical: 'venue',
            common: false,
            entitlementKey: K.MANAGE_VENUE_DAILY_SPECIAL,
            fields: [],
            readOnlyFields: ['dailySpecials'],
            order: 8,
            group: 'content'
        },
        {
            id: 'venueEvents',
            vertical: 'venue',
            common: true,
            entitlementKey: K.MANAGE_VENUE_EVENTS,
            fields: [],
            readOnlyFields: ['venueEvents'],
            order: 9,
            group: 'content'
        },
        {
            id: 'faqs',
            vertical: 'venue',
            common: true,
            fields: ['faqs'],
            order: 10,
            group: 'content'
        },
        {
            id: 'nightInfo',
            vertical: 'venue',
            common: false,
            // HOS-1846 (DEC-FAC-040): the writable fields of the section. Its
            // detection (`sectionsTouchedByBody`) and the public projector's
            // removal of the section both read from here.
            fields: ['entryKind', 'entryNoteI18n', 'entryPriceFrom'],
            // HOS-2060: age and dress code are policies now, still nightInfo's.
            policyKeys: ['minAge', 'dressCode', 'dressCodeNote'],
            // Server-managed: never writable and never counted by sections-touched.
            readOnlyFields: ['entryPriceUpdatedAt'],
            // DEC-FAC-050 / DEC-FAC-068: an i18n key, never the Spanish text.
            // The component resolves it through `t()`.
            headingWhenMultiLineKey: 'venue.detail.nightInfo.headingMultiLine',
            order: 11,
            group: 'property'
        },
        {
            id: 'translations',
            vertical: 'venue',
            common: true,
            fields: [
                'nameI18n',
                'summaryI18n',
                'descriptionI18n',
                'richDescriptionI18n',
                'translationMeta'
            ],
            order: 12,
            group: 'management'
        }
    ] as const satisfies readonly ListingSectionDefinitionBase<'venue'>[],
    experience: [
        {
            id: 'basicInfo',
            vertical: 'experience',
            common: true,
            fields: [
                'name',
                'slug',
                'summary',
                'description',
                'richDescription',
                'type',
                'destinationId',
                'refreshSlugFromName',
                'adminInfo',
                'tags',
                'rating',
                'seo'
            ],
            order: 1,
            group: 'property'
        },
        {
            id: 'meetingPoint',
            vertical: 'experience',
            common: true,
            fields: [
                'meetingPoint',
                'meetingPointLat',
                'meetingPointLong',
                'meetingPointDirections'
            ],
            traits: [
                {
                    id: 'directions',
                    entitlementKey: K.MANAGE_EXPERIENCE_DIRECTIONS,
                    fields: ['meetingPointDirections']
                }
            ],
            order: 2,
            group: 'property'
        },
        {
            id: 'practicalInfo',
            vertical: 'experience',
            common: true,
            fields: ['durationMinutes', 'whatToBring', 'requirements'],
            order: 3,
            group: 'property'
        },
        {
            id: 'openingHours',
            vertical: 'experience',
            common: true,
            fields: ['openingHours'],
            order: 4,
            group: 'property'
        },
        {
            id: 'price',
            vertical: 'experience',
            common: true,
            fields: ['priceFrom', 'priceUnit', 'isPriceOnRequest'],
            order: 5,
            group: 'property'
        },
        {
            id: 'amenities',
            vertical: 'experience',
            common: true,
            // HOS-2060: the structured `policies` live with the catalog rows
            // they replaced; a section may claim keys inside it (`policyKeys`).
            fields: ['amenityIds', 'featureIds', 'policies'],
            order: 6,
            group: 'property'
        },
        {
            id: 'media',
            vertical: 'experience',
            common: true,
            fields: ['videos'],
            order: 7,
            group: 'content'
        },
        {
            id: 'contact',
            vertical: 'experience',
            common: true,
            fields: ['contactInfo', 'socialNetworks'],
            order: 8,
            group: 'content'
        },
        {
            id: 'faqs',
            vertical: 'experience',
            common: true,
            fields: ['faqs'],
            order: 9,
            group: 'content'
        },
        {
            id: 'translations',
            vertical: 'experience',
            common: true,
            fields: [
                'nameI18n',
                'summaryI18n',
                'descriptionI18n',
                'richDescriptionI18n',
                'translationMeta'
            ],
            order: 10,
            group: 'management'
        }
    ] as const satisfies readonly ListingSectionDefinitionBase<'experience'>[],
    accommodation: [
        {
            id: 'basicInfo',
            vertical: 'accommodation',
            common: true,
            fields: [
                'name',
                'slug',
                'summary',
                'description',
                'richDescription',
                'type',
                'destinationId',
                'refreshSlugFromName',
                'adminInfo',
                'tags',
                'rating',
                'iaData',
                'aiAssistedFields',
                'ownerId',
                'lastWarnedAt',
                'reviewsCount',
                'averageRating'
            ],
            order: 1,
            group: 'property'
        },
        {
            id: 'capacityPricing',
            vertical: 'accommodation',
            common: true,
            fields: ['extraInfo', 'price'],
            order: 2,
            group: 'property'
        },
        {
            id: 'location',
            vertical: 'accommodation',
            common: true,
            fields: ['location'],
            order: 3,
            group: 'property'
        },
        {
            id: 'amenities',
            vertical: 'accommodation',
            common: true,
            // HOS-2058: per-amenity scope/availability is written with the
            // amenity selection, from the same editor section.
            // HOS-2060: the structured `policies` live with the catalog rows
            // they replaced; a section may claim keys inside it (`policyKeys`).
            fields: ['amenityIds', 'featureIds', 'amenityAttributes', 'policies'],
            order: 4,
            group: 'property'
        },
        {
            id: 'photos',
            vertical: 'accommodation',
            common: true,
            fields: ['videos'],
            order: 5,
            group: 'content'
        },
        {
            id: 'faqs',
            vertical: 'accommodation',
            common: true,
            fields: ['faqs'],
            order: 6,
            group: 'content'
        },
        {
            id: 'contact',
            vertical: 'accommodation',
            common: true,
            fields: ['contactInfo', 'socialNetworks'],
            order: 7,
            group: 'content'
        },
        {
            id: 'seo',
            vertical: 'accommodation',
            common: true,
            fields: ['seo'],
            order: 8,
            group: 'content'
        },
        {
            id: 'calendar',
            vertical: 'accommodation',
            common: true,
            entitlementKey: K.CAN_USE_CALENDAR,
            fields: [],
            traits: [{ id: 'externalSync', entitlementKey: K.CAN_SYNC_EXTERNAL_CALENDAR }],
            order: 9,
            group: 'management'
        },
        {
            id: 'translations',
            vertical: 'accommodation',
            common: true,
            fields: [
                'nameI18n',
                'summaryI18n',
                'descriptionI18n',
                'richDescriptionI18n',
                'translationMeta'
            ],
            order: 10,
            group: 'management'
        },
        {
            id: 'externalReputation',
            vertical: 'accommodation',
            common: true,
            fields: [],
            order: 11,
            group: 'management'
        }
    ] as const satisfies readonly ListingSectionDefinitionBase<'accommodation'>[]
};
