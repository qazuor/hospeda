/**
 * Structural entitlement definitions for the Hospeda billing system.
 *
 * ---
 * STRUCTURAL DEFINITION — CODE-LEVEL ONLY (SPEC-192 T-030 / ADR-030)
 *
 * `ENTITLEMENT_DEFINITIONS` is NOT DB-backed and is intentionally NOT part of
 * the billing catalog that was migrated to the database in SPEC-168 / SPEC-192.
 *
 * It is tightly coupled to the `EntitlementKey` TypeScript enum. Adding or
 * removing an entitlement requires a code change, a PR, and a deploy — the
 * enum is the source of truth, and this array is its human-readable companion.
 *
 * Rationale:
 *   - Entitlement keys appear in TypeScript generics, permission checks, and
 *     middleware type signatures. A DB-only registry would lose compile-time
 *     exhaustiveness guarantees.
 *   - The seeder (`packages/seed/src/required/billingEntitlements.seed.ts`)
 *     reads this array to populate the `billing_entitlements` lookup table, but
 *     that table is a reflection of this file — not an independent source.
 *
 * Consumers:
 *   - Seed package (divergence-respecting, never overwrites runtime edits)
 *   - Admin UI (display-only, plan editor entitlement picker)
 *   - Web app i18n helper (`@repo/billing` import in `billing-i18n.ts`)
 * ---
 *
 * @module config/entitlements
 */

import { type EntitlementDefinition, EntitlementKey } from '../types/entitlement.types.js';

/**
 * All structural entitlement definitions for the Hospeda billing system.
 *
 * This is a code-level structural definition coupled to `EntitlementKey`.
 * See module JSDoc banner above for scope constraints.
 */
export const ENTITLEMENT_DEFINITIONS: EntitlementDefinition[] = [
    // Owner entitlements
    {
        key: EntitlementKey.PUBLISH_ACCOMMODATIONS,
        name: 'Publish accommodations',
        description: 'Allows publishing accommodations on the platform'
    },
    {
        key: EntitlementKey.EDIT_ACCOMMODATION_INFO,
        name: 'Edit accommodation info',
        description: 'Allows editing information of owned accommodations'
    },
    {
        key: EntitlementKey.VIEW_BASIC_STATS,
        name: 'Basic statistics',
        description: 'Access to basic visit and booking statistics'
    },
    {
        key: EntitlementKey.VIEW_ADVANCED_STATS,
        name: 'Advanced statistics',
        description: 'Access to advanced statistics with charts and trends'
    },
    {
        key: EntitlementKey.RESPOND_REVIEWS,
        name: 'Respond to reviews',
        description: 'Allows responding to guest reviews'
    },
    {
        key: EntitlementKey.PRIORITY_SUPPORT,
        name: 'Priority support',
        description: 'Access to priority support with reduced response times'
    },
    {
        key: EntitlementKey.FEATURED_LISTING,
        name: 'Featured listing',
        description: 'Accommodation appears featured in search results'
    },
    {
        key: EntitlementKey.CUSTOM_BRANDING,
        name: 'Custom branding',
        description: 'Allows customizing the listing appearance with own branding'
    },
    {
        key: EntitlementKey.CREATE_PROMOTIONS,
        name: 'Create promotions',
        description: 'Allows creating exclusive promotions for VIP tourists'
    },
    // Accommodation feature entitlements
    {
        key: EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        name: 'Rich description',
        description: 'Allows using rich text formatting in accommodation description'
    },
    {
        key: EntitlementKey.CAN_EMBED_VIDEO,
        name: 'Embed video',
        description: 'Allows embedding videos in accommodation listing'
    },
    {
        key: EntitlementKey.CAN_USE_CALENDAR,
        name: 'Availability calendar',
        description: 'Allows using the availability calendar in listing'
    },
    {
        key: EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        name: 'External calendar sync',
        description: 'Allows syncing with external calendars like Google Calendar or iCal'
    },
    {
        key: EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        name: 'Display WhatsApp',
        description: 'Allows displaying WhatsApp number in listing'
    },
    {
        key: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        name: 'Direct WhatsApp contact',
        description: 'Allows tourists to contact directly via WhatsApp'
    },
    {
        key: EntitlementKey.HAS_VERIFICATION_BADGE,
        name: 'Verification badge',
        description: 'Displays a verification badge on the accommodation listing'
    },
    // Complex entitlements
    {
        key: EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        name: 'Multi-property management',
        description: 'Allows managing multiple properties from a single account'
    },
    {
        key: EntitlementKey.CONSOLIDATED_ANALYTICS,
        name: 'Consolidated analytics',
        description: 'Unified analytics dashboard for all properties'
    },
    {
        key: EntitlementKey.CENTRALIZED_BOOKING,
        name: 'Centralized booking',
        description: 'Centralized booking system for all properties'
    },
    {
        key: EntitlementKey.STAFF_MANAGEMENT,
        name: 'Staff management',
        description: 'Allows creating and managing staff accounts'
    },
    // Tourist entitlements
    {
        key: EntitlementKey.SAVE_FAVORITES,
        name: 'Save favorites',
        description: 'Allows saving accommodations as favorites'
    },
    {
        key: EntitlementKey.WRITE_REVIEWS,
        name: 'Write reviews',
        description: 'Allows writing accommodation reviews'
    },
    {
        key: EntitlementKey.READ_REVIEWS,
        name: 'Read reviews',
        description: 'Access to read reviews from other guests'
    },
    {
        key: EntitlementKey.PRICE_ALERTS,
        name: 'Price alerts',
        description: 'Notifications when favorite accommodation prices drop'
    },
    {
        key: EntitlementKey.EXCLUSIVE_DEALS,
        name: 'Exclusive deals',
        description: 'Access to exclusive offers and discounts'
    },
    {
        key: EntitlementKey.VIP_SUPPORT,
        name: 'VIP support',
        description: 'Dedicated VIP support channel'
    },
    {
        key: EntitlementKey.VIP_VISIBILITY_ACCESS,
        name: 'VIP visibility access',
        description:
            'VIP tourist visibility bypass: see RESTRICTED, owner-suspended, and plan-restricted accommodations'
    },
    {
        key: EntitlementKey.VIP_PROMOTIONS_ACCESS,
        name: 'VIP promotions access',
        description: 'Access to VIP-only tier exclusive deals, in addition to the plus tier'
    },
    {
        key: EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        name: 'Compare accommodations',
        description: 'Allows comparing multiple accommodations side by side'
    },
    {
        key: EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        name: 'Attach photos to reviews',
        description: 'Allows adding photos to accommodation reviews'
    },
    {
        key: EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        name: 'View search history',
        description: 'Access to past search history'
    },
    {
        key: EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        name: 'Personalized recommendations',
        description: 'Access to personalized accommodation recommendations based on preferences'
    },
    {
        key: EntitlementKey.CAN_USE_COLLECTIONS,
        name: 'Use favorites collections',
        description: 'Allows organizing saved favorites into named collections'
    },
    // AI feature entitlements (SPEC-173)
    {
        key: EntitlementKey.AI_TEXT_IMPROVE,
        name: 'AI text improvement',
        description:
            'Access to the AI-powered text improvement tool for enhancing accommodation descriptions and other content'
    },
    {
        key: EntitlementKey.AI_CHAT,
        name: 'AI chat assistant',
        description:
            'Access to the AI chat assistant for travel planning, accommodation recommendations, and general queries'
    },
    {
        key: EntitlementKey.AI_SEARCH,
        name: 'AI-powered search',
        description:
            'Access to AI-powered semantic search for finding the most relevant accommodations'
    },
    {
        key: EntitlementKey.AI_SUPPORT,
        name: 'AI support assistant',
        description:
            'Access to the AI-powered support assistant for platform help and troubleshooting'
    },
    {
        key: EntitlementKey.AI_TRANSLATE,
        name: 'AI content translation',
        description:
            'Access to AI-powered auto-translation of content entities (accommodations, destinations, events, posts) to English and Portuguese'
    },
    {
        key: EntitlementKey.AI_ACCOMMODATION_IMPORT,
        name: 'AI accommodation import',
        description:
            'Access to AI-powered accommodation import that extracts structured listing data from an external URL to pre-fill the creation form'
    },
    // Commerce vertical entitlements (HOS-1074).
    //
    // Appended as their OWN trailing section rather than folded into the owner
    // block above: `test/entitlements.test.ts` slices this array by category and
    // asserts each slice's length, so putting a commerce key inside the owner
    // run would silently move an accommodation key out of its own count.
    //
    // See `EntitlementKey`'s doc for why these are four new keys rather than a
    // reuse of the accommodation pair, and `commerce-entitlements.config.ts`
    // for which vertical grants which.
    {
        key: EntitlementKey.EDIT_GASTRONOMY_INFO,
        name: 'Edit gastronomy info',
        description: 'Allows editing the information of owned gastronomy listings'
    },
    {
        key: EntitlementKey.PUBLISH_GASTRONOMY,
        name: 'Publish gastronomy listings',
        description: 'Allows publishing gastronomy listings on the platform'
    },
    {
        key: EntitlementKey.EDIT_EXPERIENCE_INFO,
        name: 'Edit experience info',
        description: 'Allows editing the information of owned experience listings'
    },
    {
        key: EntitlementKey.PUBLISH_EXPERIENCE,
        name: 'Publish experience listings',
        description: 'Allows publishing experience listings on the platform'
    },
    // HOS-1058. Sits in the same trailing commerce section for the slicing
    // reason above, but is granted differently from the four keys before it:
    // those are uniform across a vertical's three tiers, this one is granted by
    // the PREMIUM tier of each vertical only.
    {
        key: EntitlementKey.DOWNLOAD_LISTING_PDF,
        name: 'Downloadable PDF listing sheet',
        description:
            'Allows downloading a print-ready PDF of the listing public page — photo, hours, contact and a QR back to the online sheet'
    },
    // HOS-895. Granted from `gastronomy-pro` upwards, and gastronomy-only:
    // an experience has no carta. The two menu fallbacks (external link,
    // uploaded photo/PDF) are NOT behind it — every gastronomy tier keeps them.
    {
        key: EntitlementKey.MANAGE_GASTRONOMY_MENU,
        name: 'Structured gastronomy menu',
        description:
            'Allows building the venue menu as sections and dishes with names, descriptions and prices, instead of only linking or uploading it'
    },
    // HOS-1045. Granted by `gastronomy-premium` ALONE — the tier step above
    // `-pro`'s structured carta, and the same trailing commerce section for
    // the slicing reason above.
    {
        key: EntitlementKey.MENU_ITEM_PHOTOS,
        name: 'Photos per dish',
        description:
            'Allows attaching a photo to each dish of the structured menu, shown next to the dish on the public page'
    },
    // HOS-1057. Granted from `experience-pro` upwards, and experience-only:
    // a restaurant has nothing to certify. The exact mirror of the key above
    // it, one vertical over.
    {
        key: EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE,
        name: 'Experience certificates',
        description:
            'Allows issuing a printable certificate to a person who did the experience, naming them, the outing and its date'
    },
    // HOS-1049. Granted from `experience-pro` upwards, and experience-only:
    // a restaurant has an address and a door. The meeting point itself stays
    // free on every tier (HOS-1048) — only the how-to-get-there half is here.
    {
        key: EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS,
        name: 'Meeting point map and directions',
        description:
            'Allows publishing how to reach the meeting point — where to park, which bus, how far the walk is — and drawing it on a map, on top of the meeting point address every tier already carries'
    },
    // HOS-1041. Same tier and same shape as the carta above — `gastronomy-pro`
    // upwards, gastronomy-only, kept out of the vertical floor map — but a
    // SEPARATE key: the carta is the year's menu, this is today's, and they are
    // bought for different reasons. See the enum member for why they are not
    // merged.
    {
        key: EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL,
        name: 'Menú del día',
        description:
            'Allows publishing a dish of the day with its own validity window, which stops being shown on the public page when the window passes'
    },
    // HOS-1042. Granted from `gastronomy-pro` upwards and gastronomy-only, on
    // exactly the terms the carta above is, and appended to this same trailing
    // commerce section for the slicing reason stated at its head.
    //
    // Not the platform's destination `events` entity, and not the free "we host
    // your birthday" CTA (HOS-1055) — see the enum member's doc for the three-way
    // distinction.
    {
        key: EntitlementKey.MANAGE_GASTRONOMY_EVENTS,
        name: 'Venue events agenda',
        description:
            'Allows publishing the venue’s own events — live music night, happy hour, dinner show — on a date or repeating every week'
    },
    // HOS-1043. Granted by `gastronomy-premium` ALONE, same tier and shape as
    // `MENU_ITEM_PHOTOS`, and appended to this same trailing commerce section
    // for the slicing reason stated at its head.
    {
        key: EntitlementKey.MULTILINGUAL_GASTRONOMY_MENU,
        name: 'Multi-language menu',
        description:
            'Allows translating the structured menu into English and Portuguese, shown to the visitor with a language switcher on the public page'
    }
];
