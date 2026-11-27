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
            // HOS-2189: the venue's structured postal address (the same
            // `location` JSONB an accommodation has). Common to every business
            // line: a food or nightlife venue is a physical place either way.
            id: 'location',
            vertical: 'venue',
            common: true,
            fields: ['location'],
            order: 2,
            group: 'property'
        },
        {
            id: 'openingHours',
            vertical: 'venue',
            common: true,
            fields: ['openingHours'],
            order: 3,
            group: 'property'
        },
        {
            id: 'price',
            vertical: 'venue',
            common: true,
            fields: ['priceRange'],
            order: 4,
            group: 'property'
        },
        {
            id: 'amenities',
            vertical: 'venue',
            common: true,
            // HOS-2060: the structured `policies` live with the catalog rows
            // they replaced; a section may claim keys inside it (`policyKeys`).
            fields: ['amenityIds', 'featureIds', 'amenityAttributes', 'policies'],
            order: 5,
            group: 'property'
        },
        {
            id: 'media',
            vertical: 'venue',
            common: true,
            fields: ['videos'],
            // HOS-2258: photos stay free; only the linked videos are gated.
            // The key exists in the catalog but no venue plan grants it yet
            // (HOS-2280), so the trait ships OFF: writes answer 403 and the
            // public payload carries no videos.
            traits: [{ id: 'videos', entitlementKey: K.CAN_EMBED_VIDEO, fields: ['videos'] }],
            order: 6,
            group: 'content'
        },
        {
            id: 'contact',
            vertical: 'venue',
            common: true,
            // HOS-2256: `whatsappVisibility` is the owner's choice (writable);
            // `whatsapp` is the derived public block (read-only, number only
            // for PUBLIC). Both travel with the contact section.
            fields: ['contactInfo', 'socialNetworks', 'whatsappVisibility'],
            readOnlyFields: ['whatsapp'],
            order: 7,
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
            order: 8,
            group: 'content'
        },
        {
            id: 'dailySpecials',
            vertical: 'venue',
            common: false,
            entitlementKey: K.MANAGE_VENUE_DAILY_SPECIAL,
            fields: [],
            readOnlyFields: ['dailySpecials'],
            order: 9,
            group: 'content'
        },
        {
            id: 'venueEvents',
            vertical: 'venue',
            common: true,
            entitlementKey: K.MANAGE_VENUE_EVENTS,
            fields: [],
            readOnlyFields: ['venueEvents'],
            order: 10,
            group: 'content'
        },
        {
            // HOS-2270: the venue's promotions. They are NOT part of the venue payload:
            // they have their own routes (`/venues/{id}/promotions`) and their own public
            // read (HOS-2271), so no field is listed. That is deliberate: the public
            // projector therefore never hides them when the section is locked, and they
            // stay in force after a plan downgrade (the owner keeps what they loaded; only
            // creating, editing and re-activating are gated, by `create_promotions`).
            id: 'promotions',
            vertical: 'venue',
            common: true,
            entitlementKey: K.CREATE_PROMOTIONS,
            fields: [],
            readOnlyFields: [],
            order: 11,
            group: 'content'
        },
        {
            id: 'faqs',
            vertical: 'venue',
            common: true,
            fields: ['faqs'],
            order: 12,
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
            // HOS-2060: age and dress code are policies now, still nightInfo's;
            // HOS-2098 adds the age's scope, gated with the age.
            policyKeys: ['minAge', 'minAgeScope', 'dressCode', 'dressCodeNote'],
            // Server-managed: never writable and never counted by sections-touched.
            readOnlyFields: ['entryPriceUpdatedAt'],
            // DEC-FAC-050 / DEC-FAC-068: an i18n key, never the Spanish text.
            // The component resolves it through `t()`.
            headingWhenMultiLineKey: 'venue.detail.nightInfo.headingMultiLine',
            order: 13,
            group: 'property'
        },
        {
            id: 'translations',
            vertical: 'venue',
            common: true,
            fields: ['nameI18n', 'summaryI18n', 'descriptionI18n', 'richDescriptionI18n'],
            order: 14,
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
            fields: ['amenityIds', 'featureIds', 'amenityAttributes', 'policies'],
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
            fields: ['nameI18n', 'summaryI18n', 'descriptionI18n', 'richDescriptionI18n'],
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
            // Field traits (HOS-1809): `richDescription` and its i18n sibling are one
            // gate, never two. `isVerified` is read-only for the owner (an admin sets
            // it) but its public exposure is still gated by the owner's key (Q-1).
            traits: [
                {
                    id: 'richDescription',
                    entitlementKey: K.CAN_USE_RICH_DESCRIPTION,
                    fields: ['richDescription', 'richDescriptionI18n']
                },
                {
                    id: 'verification',
                    entitlementKey: K.HAS_VERIFICATION_BADGE,
                    fields: ['isVerified']
                }
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
            // `media.videos` and the video URLs inside `description` travel with this
            // trait; they are nested, so the public projection handles them apart.
            traits: [{ id: 'videos', entitlementKey: K.CAN_EMBED_VIDEO, fields: ['videos'] }],
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
            fields: ['nameI18n', 'summaryI18n', 'descriptionI18n', 'richDescriptionI18n'],
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
