/**
 * @file entitlement-labels.ts
 * @description Presentation-only label map for the commerce entitlement keys
 * that can appear in a tier's "what this adds" list (HOS-1119).
 *
 * Mirrors `missing-field-labels.ts`'s shape: the CELL (which entitlements a
 * tier adds over a cheaper one) is derived data
 * (`deriveCommercePlanTierDiffs`), but the LABEL for each entitlement key is
 * hand-written copy, so it lives here rather than being invented at render
 * time from the raw `EntitlementKey` string value.
 *
 * Deliberately does not import `EntitlementKey` from `@repo/billing` — the
 * keys here are plain string literals matching its wire values, kept in sync
 * by `packages/schemas/test` guards elsewhere in the repo. Importing the enum
 * itself would pull `@repo/billing` into every client island that renders a
 * tier picker, which the static guard
 * (`apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`)
 * forbids.
 *
 * @module lib/commerce/entitlement-labels
 */

/**
 * i18n key SUFFIX (under `commerce.owner.entitlements.*`) for each
 * entitlement key that can show up in a tier's "adds" list. An entitlement
 * with no entry here falls back to its raw key (see
 * `COMMERCE_ENTITLEMENT_FALLBACK_LABEL`) rather than being hidden — an
 * unlabeled addition is still real and should not silently disappear from
 * the picker.
 */
export const COMMERCE_ENTITLEMENT_I18N_SUFFIX: Record<string, string> = {
    manage_gastronomy_menu: 'manageGastronomyMenu',
    // HOS-1045 — the first key that separates gastronomy PREMIUM from `-pro`,
    // so it is the first entry here that will ever be rendered by the premium
    // column of the tier picker.
    menu_item_photos: 'menuItemPhotos',
    // HOS-1049. Shows up in the experience tier picker's "adds" list the day a
    // second experience tier is activated — `deriveCommercePlanTierDiffs` only
    // renders when there is more than one, and `experience-basico` is the only
    // sellable one today. The label is added now anyway: an unlabeled key falls
    // back to its raw snake_case string, and the fallback firing in production
    // is not something anyone would notice before a customer does.
    manage_experience_directions: 'manageExperienceDirections',
    // HOS-1057. Same reasoning, same tier: labelled now so the raw key can
    // never reach the picker.
    issue_experience_certificate: 'issueExperienceCertificate',
    // HOS-1041 — the second thing `gastronomy-pro` adds over `-basico`, so the
    // plan picker's "adds" list must name it or the tier reads as one feature
    // dearer than it is.
    manage_gastronomy_daily_special: 'manageGastronomyDailySpecial',
    manage_gastronomy_events: 'manageGastronomyEvents',
    // HOS-400 — the AI chat, premium in BOTH verticals. Note this is the same
    // `ai_chat` key the accommodation catalogue grants: the picker renders it
    // from the plan row's own entitlements, so a gastronomy premium and an
    // accommodation premium both showing "Chat con IA" is correct, not a leak.
    ai_chat: 'aiChat',
    // HOS-1043 — same tier and same reasoning as `menu_item_photos`: the
    // second key that separates gastronomy PREMIUM from `-pro`.
    multilingual_gastronomy_menu: 'multilingualGastronomyMenu'
};

/**
 * Spanish fallback label per entitlement key, passed as `t()`'s fallback arg.
 */
export const COMMERCE_ENTITLEMENT_FALLBACK_LABEL: Record<string, string> = {
    manage_gastronomy_menu: 'Carta estructurada',
    menu_item_photos: 'Foto por plato',
    manage_experience_directions: 'Mapa y cómo llegar',
    issue_experience_certificate: 'Certificados de experiencia',
    manage_gastronomy_daily_special: 'Menú del día',
    manage_gastronomy_events: 'Eventos del local',
    ai_chat: 'Chat con IA en tu ficha',
    multilingual_gastronomy_menu: 'Carta en varios idiomas'
};
