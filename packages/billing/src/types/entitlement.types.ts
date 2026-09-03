/**
 * Entitlement key identifiers used across the billing system.
 * These keys map to features that can be enabled/disabled per plan.
 */
export enum EntitlementKey {
    /** Owner entitlements */
    PUBLISH_ACCOMMODATIONS = 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO = 'edit_accommodation_info',
    VIEW_BASIC_STATS = 'view_basic_stats',
    VIEW_ADVANCED_STATS = 'view_advanced_stats',
    RESPOND_REVIEWS = 'respond_reviews',
    PRIORITY_SUPPORT = 'priority_support',
    FEATURED_LISTING = 'featured_listing',
    CUSTOM_BRANDING = 'custom_branding',
    CREATE_PROMOTIONS = 'create_promotions',

    /** Accommodation feature entitlements */
    CAN_USE_RICH_DESCRIPTION = 'can_use_rich_description',
    CAN_EMBED_VIDEO = 'can_embed_video',
    CAN_USE_CALENDAR = 'can_use_calendar',
    CAN_SYNC_EXTERNAL_CALENDAR = 'can_sync_external_calendar',
    CAN_CONTACT_WHATSAPP_DISPLAY = 'can_contact_whatsapp_display',
    CAN_CONTACT_WHATSAPP_DIRECT = 'can_contact_whatsapp_direct',
    HAS_VERIFICATION_BADGE = 'has_verification_badge',

    /**
     * Commerce vertical entitlements (HOS-1074).
     *
     * One PAIR PER VERTICAL, deliberately NOT a reuse of
     * `EDIT_ACCOMMODATION_INFO` / `PUBLISH_ACCOMMODATIONS`. `loadEntitlements`
     * resolves the ACCOMMODATION subscription, so an accommodation key asked on
     * a commerce route breaks in both directions: a commerce owner with no
     * accommodation plan is always refused, and an owner who happens to hold
     * both is always allowed — for the wrong reason.
     *
     * Every tier of a vertical grants its own pair, exactly as all six
     * accommodation plans grant the accommodation pair. A key that is uniform
     * across a catalogue's tiers is the platform's existing convention, not an
     * exception invented here.
     */
    EDIT_GASTRONOMY_INFO = 'edit_gastronomy_info',
    PUBLISH_GASTRONOMY = 'publish_gastronomy',
    EDIT_EXPERIENCE_INFO = 'edit_experience_info',
    PUBLISH_EXPERIENCE = 'publish_experience',

    /**
     * The printable PDF ficha of a commerce listing (HOS-1058).
     *
     * ONE key for both verticals, where the four above are one pair per
     * vertical — and the difference is not an inconsistency. Those four are
     * asked on routes reached through
     * `commerceVerticalEntitlementMiddleware(vertical)`, which REPLACES the
     * request's entitlement set with the one resolved from the subscription of
     * THAT vertical. A gastronomy owner's set is built from their gastronomy
     * subscription and nothing else, so a single key cannot be satisfied by the
     * other vertical's plan: the isolation lives in the loader, not in the
     * spelling of the key.
     *
     * Unlike those four it is a TIER differentiator — premium, in both
     * verticals (owner decision, 2026-09-01) — so it is deliberately NOT in
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, whose contract is "every tier of
     * this vertical grants this". It is granted by the premium plan rows and
     * reaches the gate through the union `resolveCommerceVerticalGrants`
     * already performs over the subscribed plan's `entitlements` column — the
     * path HOS-1074 called "how a future premium tier earns its name".
     */
    DOWNLOAD_LISTING_PDF = 'download_listing_pdf',

    /**
     * Editing a gastronomy listing's structured carta — sections and dishes
     * (HOS-895).
     *
     * A TIER differentiator, like {@link EntitlementKey.DOWNLOAD_LISTING_PDF}
     * and unlike the four keys above it, so it is NOT in
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor EVERY
     * tier of a vertical receives, and putting a paid capability there would
     * hand it to `-basico` as well. Granted from `gastronomy-pro` UPWARDS
     * (owner decision): `-pro` and `-premium` both carry it, because a premium
     * subscriber losing a capability their cheaper neighbour has would be a
     * downgrade dressed as a tier.
     *
     * ## What it also gates, since HOS-895 PR2
     *
     * Originally ONLY the structured carta — the external `menuUrl` and the
     * uploaded photo/PDF stayed free on every tier, `-basico` included, because
     * that was how a `-basico` venue showed a menu at all. Owner decision
     * (2026-09-02) narrowed that: the uploaded photo/PDF (`POST`/`DELETE
     * .../menu-file`) is now gated by this SAME key, `-pro`/`-premium` only.
     * `menuUrl` (the external link) is the one fallback still free on every
     * tier — it predates HOS-895 entirely (SPEC-239) and taking it away would
     * be a regression, not a re-tiering.
     *
     * The public detail page enforces this live, not by deleting rows: a
     * downgraded owner's already-typed carta and already-uploaded file stay in
     * the database, but `resolveOwnerGrantsGastronomyMenuManagement`
     * (`@repo/service-core`) reads the CURRENT subscription on every render and
     * withholds both from the public payload when it no longer grants this key.
     *
     * Gastronomy-only by name and on purpose. Experiences have no carta, so
     * there is no second vertical for this key to be shared with — the shape
     * `DOWNLOAD_LISTING_PDF` has for the opposite reason.
     */
    MANAGE_GASTRONOMY_MENU = 'manage_gastronomy_menu',

    /**
     * A photo attached to each dish of the structured carta (HOS-1045).
     *
     * A TIER differentiator like {@link EntitlementKey.MANAGE_GASTRONOMY_MENU}
     * and {@link EntitlementKey.DOWNLOAD_LISTING_PDF}, so it stays OUT of
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor EVERY
     * tier of a vertical receives, and a paid capability placed there is handed
     * to `-basico` as well. Granted by `gastronomy-premium` ONLY (owner
     * decision, 2026-09-01): where `-pro` earns the right to type a carta at
     * all, this is what the step above it buys.
     *
     * ## It layers ON TOP of `MANAGE_GASTRONOMY_MENU`, it does not replace it
     *
     * A dish photo has nowhere to live without dishes, so this key is only
     * reachable by an owner who also holds the carta key — which `-premium`
     * does, and which is why that plan repeats `MANAGE_GASTRONOMY_MENU` rather
     * than inheriting it from `-pro`. The two are still checked independently:
     * the carta write is gated on the first, and the photo upload plus the
     * presence of a photo in the submitted document on this one.
     *
     * ## No numeric limit rides with it
     *
     * Deliberately: there is no `MAX_MENU_ITEM_PHOTOS` key and none is planned
     * for v1. Access is the gate and nothing else. The limit engine resolves an
     * unknown key as *unlimited* across five layers without raising anything,
     * so a cap declared but not wired end to end behaves in production exactly
     * like no cap — while reading, in the catalogue, like a promise the
     * platform keeps. `MAX_PHOTOS_PER_ACCOMMODATION` and its `extra-photos-20`
     * addon are ACCOMMODATION machinery and are not reused here.
     *
     * The public detail page enforces this live, the same way the carta key is:
     * a downgraded owner's dish photos stay in the database and
     * `resolveOwnerGastronomyMenuGrants` (`@repo/service-core`) withholds them
     * from the public payload on every render.
     *
     * Gastronomy-only by name and on purpose — an experience has no carta, so
     * there is no second vertical for this key to be shared with.
     */
    MENU_ITEM_PHOTOS = 'menu_item_photos',

    /**
     * Issuing a certificate to a person who did an experience (HOS-1057).
     *
     * Experience-only by name and on purpose, the exact mirror of
     * {@link EntitlementKey.MANAGE_GASTRONOMY_MENU}: a restaurant has nothing
     * to certify, so there is no second vertical for this key to be shared
     * with.
     *
     * A TIER differentiator — `experience-pro` and UPWARDS (owner decision,
     * 2026-09-01) — so, like the two keys above it, it is deliberately NOT in
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`. That map is the floor
     * `commerceVerticalEntitlementMiddleware` hands EVERY tier of a vertical at
     * once, and a paid capability listed there would be given to
     * `experience-basico` as well. It reaches the gate through the union
     * `resolveCommerceVerticalGrants` already performs over the subscribed
     * plan's own `entitlements` column.
     *
     * `-premium` repeats the grant rather than inheriting it, for the reason
     * `MANAGE_GASTRONOMY_MENU` already documents: these arrays are literal per
     * plan and nothing composes a tier from the one below it, so omitting it
     * would mean the dearer plan silently lost a feature `-pro` has.
     *
     * ## What it gates, and what it does not
     *
     * It gates the whole `/api/v1/protected/experiences/{id}/certificates`
     * surface — issuing, listing back, and the PDF. There is no PUBLIC
     * certificate URL for it to gate: the artifact that travels is the PDF file
     * itself, and the only link it carries is a QR back to the experience's own
     * public page. See the module doc of
     * `apps/api/src/services/experience-certificate/certificate-response.ts`
     * for why that decision was taken rather than left implicit.
     */
    ISSUE_EXPERIENCE_CERTIFICATE = 'issue_experience_certificate',

    /**
     * How to GET to an experience's meeting point (HOS-1049) — the walking and
     * parking instructions, and the map drawn from the stored coordinates.
     *
     * A TIER differentiator on the same terms as
     * {@link EntitlementKey.MANAGE_GASTRONOMY_MENU}, and therefore NOT in
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor EVERY
     * tier of a vertical receives. Granted from `experience-pro` UPWARDS
     * (owner decision, 2026-09-01): `-pro` and `-premium` both carry it,
     * because a premium subscriber missing a capability their cheaper
     * neighbour has is a downgrade dressed as a tier.
     *
     * ## What is NOT behind it
     *
     * The meeting point ITSELF — `experiences.meeting_point` and its two
     * coordinate columns — is ficha data on every tier (HOS-1048, owner
     * decision). Knowing where you have to show up cannot be a paid feature.
     * What this key gates is the enrichment: the `meeting_point_directions`
     * list ("estacioná en la bajada municipal", "son 300 m por camino de
     * tierra") and the rendered MAP. Many Litoral departures start at a place
     * with no useful postal address, and there the instructions are worth more
     * than the address is.
     *
     * ## Enforced on the write AND on the public read
     *
     * The write half is a field gate on `PATCH /protected/experiences/{id}`:
     * the whole route already needs `EDIT_EXPERIENCE_INFO`, so this is checked
     * only when the body actually names `meetingPointDirections`. The read half
     * is live and withholds rather than deletes — a downgraded provider's
     * already-typed instructions stay in the database, and
     * `resolveOwnerGrantsExperienceDirections` (`@repo/service-core`) reads the
     * CURRENT experience subscription on every public render. Same mechanism,
     * and same reason, as `MANAGE_GASTRONOMY_MENU`.
     *
     * Experience-only by name and on purpose: a restaurant has an address and
     * a door, so there is no second vertical for this to be shared with — the
     * mirror image of `MANAGE_GASTRONOMY_MENU`'s "an experience has no carta".
     */
    MANAGE_EXPERIENCE_DIRECTIONS = 'manage_experience_directions',

    /**
     * The menú del día — a dish with its own validity window (HOS-1041).
     *
     * ## Not a narrower `MANAGE_GASTRONOMY_MENU`
     *
     * The carta is what the venue cooks all year; this is what it is cooking
     * today, and they are bought for different reasons. A venue with a fixed
     * menu and a blackboard out front wants this and not the carta; a venue
     * with forty dishes and no daily offer wants the reverse. They land on the
     * same tier today, but they are separate capabilities and reusing one key
     * for both would make it impossible to price them apart later without
     * migrating live subscriptions.
     *
     * ## Where it sits, and why not in the vertical floor
     *
     * Granted from `gastronomy-pro` UPWARDS (owner decision, 2026-09-01): a
     * daily operational feature, used every day by whoever uses it and paid for
     * by nobody else. Deliberately ABSENT from
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor EVERY
     * tier receives, and a paid capability there would be handed to `-basico`.
     * `-premium` repeats it literally rather than inheriting it, for the reason
     * `plans.config.ts` states: nothing composes a tier out of the one below.
     *
     * ## What it gates
     *
     * `PUT .../daily-specials` (writing them) and the public projection
     * (showing them). The OWNER's own read is NOT gated — an owner whose
     * subscription lapsed still sees what they typed, the same split
     * `MANAGE_GASTRONOMY_MENU` makes between `getMenu` and `putMenu`. The
     * public detail page enforces it live via
     * `resolveOwnerGrantsGastronomyDailySpecial` (`@repo/service-core`) rather
     * than by deleting rows.
     *
     * Gastronomy-only by name and on purpose: an experience has no menú del
     * día.
     */
    MANAGE_GASTRONOMY_DAILY_SPECIAL = 'manage_gastronomy_daily_special',

    /**
     * Publishing a gastronomy venue's OWN events — live music night, happy
     * hour, dinner show, the Tuesday deal (HOS-1042).
     *
     * A TIER differentiator granted from `gastronomy-pro` UPWARDS (owner
     * decision, 2026-09-01), on exactly the terms
     * {@link EntitlementKey.MANAGE_GASTRONOMY_MENU} is: NOT in
     * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` (that map is the floor every tier
     * of a vertical receives), and carried by `-pro` and `-premium` alike so a
     * premium subscriber never loses a capability their cheaper neighbour has.
     *
     * ## What this is NOT
     *
     * Three things in this codebase are called "events" and only one of them is
     * this key:
     *
     * - The platform `events` entity is the DESTINATION's agenda — a festival,
     *   a popular fiesta — curated by staff and of another scale entirely. A
     *   happy hour does not belong there.
     * - `GastronomyEventsCta` (HOS-1055) is the "we host YOUR event" toggle:
     *   birthdays, corporate dinners, weddings. That is the venue offering
     *   itself as a place to hire, and it stays free on every tier.
     * - This key is the venue's own recurring agenda: things that happen AT the
     *   venue, on a date or every Thursday, that a diner may show up for.
     *
     * Gastronomy-only by name and on purpose, the same way
     * `MANAGE_GASTRONOMY_MENU` is: an experience IS an event with a date, so it
     * has no second agenda to hang off itself.
     *
     * The public detail page enforces it live rather than by deleting rows — a
     * downgraded owner's already-typed agenda stays in the database and is
     * withheld from the public payload, the same mechanism the carta uses.
     */
    MANAGE_GASTRONOMY_EVENTS = 'manage_gastronomy_events',
    /** Complex entitlements (extend owner) */
    MULTI_PROPERTY_MANAGEMENT = 'multi_property_management',
    CONSOLIDATED_ANALYTICS = 'consolidated_analytics',
    CENTRALIZED_BOOKING = 'centralized_booking',
    STAFF_MANAGEMENT = 'staff_management',

    /** Tourist entitlements */
    SAVE_FAVORITES = 'save_favorites',
    WRITE_REVIEWS = 'write_reviews',
    READ_REVIEWS = 'read_reviews',
    PRICE_ALERTS = 'price_alerts',
    EXCLUSIVE_DEALS = 'exclusive_deals',
    VIP_SUPPORT = 'vip_support',
    VIP_VISIBILITY_ACCESS = 'vip_visibility_access',
    /**
     * Grants access to VIP-only tier exclusive deals (HOS-21). Distinct from
     * `VIP_VISIBILITY_ACCESS`, which is an unrelated accommodation-visibility
     * bypass.
     */
    VIP_PROMOTIONS_ACCESS = 'vip_promotions_access',
    CAN_COMPARE_ACCOMMODATIONS = 'can_compare_accommodations',
    CAN_ATTACH_REVIEW_PHOTOS = 'can_attach_review_photos',
    CAN_VIEW_SEARCH_HISTORY = 'can_view_search_history',
    CAN_VIEW_RECOMMENDATIONS = 'can_view_recommendations',
    /** Access to favorites collections (SPEC-287). Not available on tourist-free. */
    CAN_USE_COLLECTIONS = 'can_use_collections',

    /** AI feature entitlements (SPEC-173) */
    /**
     * Allows the user to use the AI-powered text improvement tool
     * to enhance their accommodation descriptions and other content.
     * Available on owner and complex plans only (not tourist plans,
     * since tourists do not own content to improve).
     */
    AI_TEXT_IMPROVE = 'ai_text_improve',
    /**
     * Allows the user to interact with the AI chat assistant
     * for travel planning, recommendations, and general queries.
     */
    AI_CHAT = 'ai_chat',
    /**
     * Allows the user to use the AI-powered search to get
     * semantically relevant accommodation results.
     */
    AI_SEARCH = 'ai_search',
    /**
     * Allows the user to access the AI-powered support assistant
     * for platform help and troubleshooting.
     */
    AI_SUPPORT = 'ai_support',
    /**
     * Allows the user to use the AI-powered content translation feature
     * to auto-translate accommodation, destination, event, and post content
     * to English and Portuguese.
     */
    AI_TRANSLATE = 'ai_translate',
    /**
     * Allows the user to use the AI-powered accommodation import feature
     * to extract structured listing data from an external URL and pre-fill
     * the accommodation creation form.
     */
    AI_ACCOMMODATION_IMPORT = 'ai_accommodation_import'
}

/**
 * Entitlement definition for a plan
 */
export interface EntitlementDefinition {
    /** The entitlement key */
    key: EntitlementKey;
    /** Human-readable name */
    name: string;
    /** Description of the entitlement */
    description: string;
}
