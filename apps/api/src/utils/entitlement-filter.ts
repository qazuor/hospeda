/**
 * Entitlement Filtering Utilities
 *
 * Provides functions to filter accommodation data based on viewer entitlements.
 * These filters ensure that premium content is only visible to users with
 * the appropriate entitlements.
 *
 * @module utils/entitlement-filter
 */

import { EntitlementKey } from '@repo/billing';
import type { Accommodation, I18nText } from '@repo/schemas';
import type { Context } from 'hono';
import { hasEntitlement } from '../middlewares/entitlement';
import type { AppBindings } from '../types';
import { apiLogger } from './logger';

/**
 * Accommodation data that may contain premium features
 */
export interface AccommodationData {
    id: string;
    ownerId?: string;
    createdAt?: string | Date;
    description?: string;
    richDescription?: string | null;
    /**
     * SPEC-212 i18n sibling of {@link AccommodationData.richDescription}. Carries the
     * same premium content per locale and is therefore gated by the SAME owner
     * entitlement (`CAN_USE_RICH_DESCRIPTION`) — never gate one without the other.
     */
    richDescriptionI18n?: I18nText | null;
    videoUrl?: string;
    /**
     * Contact info blob (JSONB `contact_info`). The WhatsApp number lives at
     * `contactInfo.whatsapp` (BETA-151) — there is NO dedicated column. HOS-19
     * reads this to derive the cache-safe `hasWhatsapp` flag; the number itself
     * is never emitted on the shared-cached public payload.
     */
    contactInfo?: { whatsapp?: string | null } | null;
    /**
     * HOS-19: owner-derived, cache-safe flag — whether `contactInfo.whatsapp`
     * is present. Set by {@link filterAccommodationByEntitlements}. The number
     * is gated by the VIEWER's plan on a separate per-user protected endpoint.
     */
    hasWhatsapp?: boolean;
    isVerified?: boolean;
    media?: unknown; // May be array of {type, url} (test mocks) or object with featuredImage/gallery/videos (DB)
    [key: string]: unknown;
}

/**
 * Drops BOTH rich-description fields from an accommodation object before it
 * reaches a public CARD listing payload.
 *
 * `richDescription` and its SPEC-212 i18n sibling `richDescriptionI18n` are
 * PREMIUM fields gated per-owner by the entitlement system. Card listings never
 * render rich text, so both must be absent regardless of the owner's plan. The
 * omission is applied at the DATA level so it is fail-closed and independent of
 * any Zod schema change.
 *
 * Prefer this helper over a hand-rolled destructure: the two fields MUST be
 * dropped together. Dropping only the plain one is equivalent to dropping
 * neither, because the web transform resolves the visitor's locale from
 * `richDescriptionI18n` in preference to `richDescription`.
 *
 * The constraint is `T extends object` — deliberately NOT
 * `{ richDescription?: unknown; richDescriptionI18n?: unknown }` — with an
 * internal cast. Some call sites pass `AccommodationListItem`, whose static type
 * declares neither field even though the underlying `findAll` runs `SELECT *` and
 * both are present at runtime. An all-optional constraint would reject that
 * argument outright under TypeScript's weak-type detection ("has no properties in
 * common"), which is exactly the shape that needs stripping the most.
 *
 * The cost of that looser constraint is that `object` also admits arrays. Since
 * nearly every call site is `xs.map(stripRichDescriptionFields)`, forgetting the
 * `.map` is a one-character mistake that would otherwise object-spread the array
 * into `{0: …, 1: …}` and fail far away as an opaque schema error. The runtime
 * guard below turns that into an immediate, named failure.
 *
 * @param item - Raw accommodation object from the service layer.
 * @returns The same object without either rich-description field.
 * @throws {TypeError} If handed an array (almost certainly a missing `.map`).
 */
export function stripRichDescriptionFields<T extends object>(
    item: T
): Omit<T, 'richDescription' | 'richDescriptionI18n'> {
    if (Array.isArray(item)) {
        throw new TypeError(
            'stripRichDescriptionFields expects a single accommodation object, got an array — did you mean items.map(stripRichDescriptionFields)?'
        );
    }
    const {
        richDescription: _dropped,
        richDescriptionI18n: _droppedI18n,
        ...rest
    } = item as T & { richDescription?: unknown; richDescriptionI18n?: unknown };
    return rest as Omit<T, 'richDescription' | 'richDescriptionI18n'>;
}

/**
 * Compile-time pin for the two premium field names this module strips by string
 * literal. The strip is a destructure over a cast, so the names carry no type link
 * to the entity — renaming the column would leave every call site compiling while
 * silently stripping nothing, which is precisely how the i18n sibling went ungated
 * in the first place. This makes such a rename a BUILD failure.
 *
 * Pinned against `Accommodation` (the `@repo/schemas` SSOT entity) and NOT against
 * the local `AccommodationData`: the latter carries an `[key: string]: unknown`
 * index signature, so `keyof` collapses to `string` and any assertion against it
 * would pass vacuously.
 */
type _RichFieldNamePin = 'richDescription' | 'richDescriptionI18n' extends keyof Accommodation
    ? true
    : never;
const _richFieldNamesExist: _RichFieldNamePin = true;
void _richFieldNamesExist;

/**
 * Total string read for values coming out of unvalidated JSONB blobs.
 *
 * Returns the trimmed string for an actual string, and `''` for anything else —
 * number, object, array, null, undefined. Never throws. Exists because
 * `blob?.field?.trim()` throws a TypeError on a legacy non-string value, and the
 * entitlement filter's error handling is fail-open: a throw there ships premium
 * fields rather than withholding them.
 *
 * @param value - Arbitrary value read out of a JSONB column.
 * @returns The trimmed string, or `''` when the value is not a string.
 */
function readTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Filter accommodation data based on viewer's entitlements
 *
 * Removes or modifies premium content that the caller should not expose:
 * - Omits BOTH `richDescription` AND `richDescriptionI18n` when the OWNING HOST
 *   lacks CAN_USE_RICH_DESCRIPTION. The two are one gate, never two: the web
 *   transform resolves the visitor's locale from the i18n object in PREFERENCE to
 *   the plain field, so omitting only the plain one omits nothing in practice.
 * - Removes video content if viewer lacks CAN_EMBED_VIDEO
 * - Sets `hasWhatsapp` (owner-derived boolean) from `contactInfo.whatsapp`
 *   (HOS-19). The WhatsApp NUMBER is deliberately NOT emitted here — this
 *   endpoint is shared-cached, so the number is gated by the viewer's plan on
 *   the per-user protected endpoint instead.
 * - Forces `isVerified` to false when the OWNING HOST lacks HAS_VERIFICATION_BADGE
 *
 * @param c - Hono context (contains viewer entitlements)
 * @param accommodation - Accommodation data to filter
 * @param ownerEntitlements - Optional entitlement set for the accommodation owner.
 *   When omitted, the function behaves like an admin/internal call site and leaves
 *   both rich-description fields untouched. When provided, presence of
 *   `CAN_USE_RICH_DESCRIPTION` is the ONLY signal that either of them may be
 *   surfaced downstream (FR-3b / FR-4).
 * @returns Filtered accommodation data
 *
 * @example
 * ```typescript
 * import { filterAccommodationByEntitlements } from '../utils/entitlement-filter';
 *
 * app.get('/accommodations/:id', async (c) => {
 *   const accommodation = await accommodationService.getById(id);
 *
 *   // Filter based on viewer's entitlements
 *   const filtered = filterAccommodationByEntitlements(c, accommodation);
 *
 *   return c.json(filtered);
 * });
 * ```
 */
export function filterAccommodationByEntitlements(
    c: Context<AppBindings>,
    accommodation: AccommodationData,
    ownerEntitlements?: readonly EntitlementKey[]
): AccommodationData {
    // Create a copy to avoid mutating the original
    const filtered = { ...accommodation };

    // The `catch` at the end of this function is fail-OPEN: it logs and returns
    // `filtered` as-is, premium fields intact. Statement order must therefore not be
    // what keeps a gate safe — ordering the gates ahead of a hazard only changes WHICH
    // field leaks when it throws.
    //
    // The known hazard is `contactInfo.whatsapp`, an unvalidated JSONB value that
    // `.trim()` throws on when it is not a string; it is read through the total
    // `readTrimmedString` instead. The two owner gates additionally run first, as
    // defence in depth.
    //
    // NOT yet total, and deliberately named rather than glossed over: the video block
    // below calls `.replace` on `description` and dereferences `.type` on `media`
    // elements, both typed but neither validated. A throw there is bounded to leaking
    // VIDEO content (the owner gates have already run), not the rich description. Do
    // not add a blanket "nothing here can throw" claim to this comment without making
    // it true — an earlier revision of this file asserted exactly that while both
    // statements were still reachable.
    try {
        // OWNER-gated richDescription omission (FR-3b): when ownerEntitlements
        // are provided, presence of CAN_USE_RICH_DESCRIPTION is the ONLY signal
        // that the public payload may include richDescription. The viewer's
        // entitlements are deliberately ignored here.
        //
        // Both the plain field and its SPEC-212 i18n sibling are gated together.
        // Gating only the plain one is equivalent to not gating at all: the web
        // transform (apps/web/src/lib/api/transforms.ts) resolves the visitor's
        // locale from `richDescriptionI18n` in PREFERENCE to `richDescription`,
        // so a surviving i18n value is rendered as HTML on the public detail page
        // even when the plain field was correctly omitted.
        //
        // `delete`, not `= undefined`: assigning undefined leaves the KEY present.
        // That happens to serialize correctly today (JSON.stringify drops
        // undefined-valued keys) but it is a property of the serializer, not of
        // this gate — anything that inspects the object instead of its wire form
        // (`'richDescriptionI18n' in obj`, `Object.keys()`, `structuredClone`, an
        // in-process response cache) would still see it. Deleting makes the
        // omission true at the object level and matches `stripRichDescriptionFields`.
        if (
            ownerEntitlements &&
            !ownerEntitlements.includes(EntitlementKey.CAN_USE_RICH_DESCRIPTION)
        ) {
            const omitted: string[] = [];
            if (filtered.richDescription) {
                delete filtered.richDescription;
                omitted.push('richDescription');
            }
            if (filtered.richDescriptionI18n) {
                delete filtered.richDescriptionI18n;
                omitted.push('richDescriptionI18n');
            }
            if (omitted.length > 0) {
                apiLogger.debug(
                    `Omitted ${omitted.join(' + ')} from accommodation ${filtered.id} - owner lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
                );
            }
        }

        // OWNER-gated isVerified badge: when ownerEntitlements are provided,
        // the badge is only surfaced when the owning host has HAS_VERIFICATION_BADGE.
        // This mirrors the richDescription pattern — the viewer's entitlements are
        // NOT consulted. When ownerEntitlements are omitted (admin/internal call sites),
        // isVerified is left as-is.
        if (
            ownerEntitlements &&
            !ownerEntitlements.includes(EntitlementKey.HAS_VERIFICATION_BADGE)
        ) {
            filtered.isVerified = false;
            apiLogger.debug(
                `Forced isVerified=false for accommodation ${filtered.id} - owner lacks ${EntitlementKey.HAS_VERIFICATION_BADGE}`
            );
        }

        // ── Derivations below this line. Both owner gates have already run. ──

        // Check viewer entitlements
        const canEmbedVideo = hasEntitlement(c, EntitlementKey.CAN_EMBED_VIDEO);

        // HOS-19: WhatsApp display is VIEWER-gated, but `/public/accommodations`
        // is shared-cached (cache key has no auth), so the number MUST NOT ride
        // this payload — a per-viewer field would leak the first viewer's plan
        // result to everyone. Instead we emit only a cache-safe, owner-derived
        // boolean here; the actual number is gated by the viewer's plan on the
        // per-user protected endpoint GET /protected/accommodations/:id/whatsapp.
        // Trim to stay consistent with that endpoint's own non-empty check —
        // a whitespace-only legacy value must NOT flip hasWhatsapp true (it would
        // otherwise surface a misleading upsell for a listing with no real number).
        //
        // `readTrimmedString`, not `?.trim()`: `contactInfo` is an unvalidated JSONB
        // blob, so a legacy non-string `whatsapp` (a number, an object) leaves `.trim`
        // undefined and throws — which the fail-open catch below would turn into an
        // ungated payload.
        filtered.hasWhatsapp = readTrimmedString(filtered.contactInfo?.whatsapp).length > 0;

        // Remove video content if not entitled
        if (!canEmbedVideo) {
            // Remove video URL. `delete`, not `= undefined`, for the same reason as
            // the rich-description strip above: assigning undefined leaves the key
            // present and only looks correct because JSON.stringify drops it.
            if (filtered.videoUrl) {
                delete filtered.videoUrl;
            }

            // Remove video embeds from description
            if (filtered.description) {
                filtered.description = stripVideoUrls(filtered.description);
            }

            // Remove video items from media array
            if (Array.isArray(filtered.media)) {
                filtered.media = filtered.media.filter(
                    (item: { type?: string }) => item.type !== 'video'
                );
            }

            apiLogger.debug(
                `Stripped video content from accommodation ${filtered.id} - viewer lacks ${EntitlementKey.CAN_EMBED_VIDEO}`
            );
        }
    } catch (error) {
        apiLogger.error(
            `Error filtering accommodation ${accommodation.id} by entitlements: ${error instanceof Error ? error.message : String(error)}`
        );
        // Return filtered data as-is on error
    }

    return filtered;
}

/**
 * Filter a list of accommodations based on viewer's entitlements
 *
 * Applies filterAccommodationByEntitlements to each accommodation in the list.
 * More efficient than calling the filter function individually.
 *
 * @param c - Hono context (contains viewer entitlements)
 * @param accommodations - Array of accommodation data to filter
 * @returns Array of filtered accommodation data
 *
 * @example
 * ```typescript
 * import { filterAccommodationListByEntitlements } from '../utils/entitlement-filter';
 *
 * app.get('/accommodations', async (c) => {
 *   const accommodations = await accommodationService.findAll();
 *
 *   // Filter entire list based on viewer's entitlements
 *   const filtered = filterAccommodationListByEntitlements(c, accommodations);
 *
 *   return c.json({ data: filtered });
 * });
 * ```
 */
export function filterAccommodationListByEntitlements(
    c: Context<AppBindings>,
    accommodations: AccommodationData[]
): AccommodationData[] {
    return accommodations.map((accommodation) =>
        filterAccommodationByEntitlements(c, accommodation)
    );
}

/**
 * Filter a list of accommodations based on the OWNER's billing entitlements.
 *
 * Pure and synchronous. Applies the owner-gated `isVerified` logic to a whole
 * page at once, driven by the pre-resolved {@link Map} returned by
 * `resolveOwnerEntitlementsForOwnerIds` (one DB query per page, parallel
 * billing calls). Counterpart to {@link filterAccommodationByEntitlements} but
 * designed for listing endpoints where the Hono context is not needed (listing
 * cards apply no viewer-gated stripping — video/WhatsApp are detail-only).
 *
 * Gate rules (applied per item):
 * - Owner absent from map → `isVerified` forced to `false` (fail-closed).
 * - Owner present but lacks `HAS_VERIFICATION_BADGE` → `isVerified` forced
 *   to `false`.
 * - Owner present and has `HAS_VERIFICATION_BADGE` → `isVerified` unchanged.
 * - Item already has `isVerified = false` → returned as-is (no allocation).
 *
 * Does NOT apply viewer-gated fields (video, WhatsApp, richDescription).
 * Those are handled by {@link filterAccommodationByEntitlements} on the detail
 * view and are stripped at the data level in listing handlers.
 *
 * @param items - Raw accommodation items from the service or DB layer.
 * @param ownerEntitlementsByOwnerId - Map keyed by `ownerId`, returned by
 *   `resolveOwnerEntitlementsForOwnerIds`.
 * @returns New array with `isVerified` gated per item. Input is NOT mutated.
 *
 * @example
 * ```typescript
 * const ownerIds = [...new Set(items.map((i) => i.ownerId).filter(Boolean))];
 * const entMap = await resolveOwnerEntitlementsForOwnerIds(ownerIds);
 * const gated = filterAccommodationListByOwnerEntitlements(items, entMap);
 * return c.json({ data: gated });
 * ```
 */
export function filterAccommodationListByOwnerEntitlements(
    items: AccommodationData[],
    ownerEntitlementsByOwnerId: Map<string, readonly EntitlementKey[]>
): AccommodationData[] {
    return items.map((item) => {
        // Already false — nothing to gate; return the same reference (no allocation).
        if (!item.isVerified) return item;

        const ownerId = typeof item.ownerId === 'string' ? item.ownerId : undefined;
        const ownerEntitlements = ownerId ? ownerEntitlementsByOwnerId.get(ownerId) : undefined;

        if (!ownerEntitlements?.includes(EntitlementKey.HAS_VERIFICATION_BADGE)) {
            apiLogger.debug(
                `filterAccommodationListByOwnerEntitlements: forced isVerified=false for item ${item.id} — owner ${ownerId ?? 'unknown'} lacks ${EntitlementKey.HAS_VERIFICATION_BADGE}`
            );
            return { ...item, isVerified: false };
        }

        return item;
    });
}

/**
 * Strip markdown formatting from text
 *
 * Removes common markdown syntax while preserving the text content.
 *
 * This function is the JS source of truth for the SPEC-187 PL/pgSQL
 * strip-markdown migrations in `packages/db/src/migrations/` (the original
 * `0008_strip_accommodation_description_markdown.sql` and the follow-up
 * `0011_restrip_accommodation_description_markdown.sql`). All three surfaces
 * — this function, the SQL `strip_markdown()` function, and the web mirror
 * `apps/web/src/lib/render-plain.ts#STRIP_MARKDOWN_REGEX_SET` — MUST stay in
 * lockstep (PD-1). A divergence lets stale markdown slip into the public web
 * render and creates an XSS surface that the strip was designed to close.
 *
 * Canonical transformation order (identical in JS and SQL):
 *   1. `**bold**`        -> inner text
 *   2. `*italic*`        -> inner text
 *   3. `__bold__`        -> inner text   (underscore emphasis, SPEC-187 follow-up)
 *   4. `_italic_`        -> inner text   (underscore emphasis, SPEC-187 follow-up)
 *   5. `~~strike~~`      -> inner text
 *   6. `` `code` ``      -> inner text
 *   7. `![alt](url)`     -> alt text     (image BEFORE link — order is load-bearing)
 *   8. `[text](url)`     -> link text
 *   9. `^#+ ` headings   -> removed
 *  10. `^[-*+] ` bullets -> removed
 *  11. `^> ` blockquotes -> removed
 *  12. `\n{3,}`          -> `\n\n`       (collapse excess blank lines)
 *  13. trim
 *
 * SPEC-187 follow-up fixes (relative to the original 0008 strip):
 *   (a) underscore emphasis (`_x_` / `__x__`) is now stripped — 0008's gate
 *       predicate selected rows containing `_` but never removed the marker;
 *   (b) the image rule now runs BEFORE the link rule, so `![alt](url)` yields
 *       `alt` instead of the orphan `!alt` the old order produced;
 *   (c) the `\n{3,}` collapse is mirrored here so JS matches SQL output.
 *
 * Exported so a unit test (apps/api/test/utils/entitlement-filter-strip.test.ts)
 * can pin the JS-side behavior against the PL/pgSQL canonical fixture.
 *
 * @param text - Text with potential markdown
 * @returns Plain text without markdown
 */
export function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold **text**
        .replace(/\*(.+?)\*/g, '$1') // Italic *text*
        .replace(/__(.+?)__/g, '$1') // Bold __text__
        .replace(/_(.+?)_/g, '$1') // Italic _text_
        .replace(/~~(.+?)~~/g, '$1') // Strikethrough ~~text~~
        .replace(/`(.+?)`/g, '$1') // Inline code `code`
        .replace(/!\[(.+?)\]\(.+?\)/g, '$1') // Images ![alt](url) — BEFORE links
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links [text](url)
        .replace(/^#+\s+/gm, '') // Headers # text
        .replace(/^[-*+]\s+/gm, '') // Lists - item
        .replace(/^>\s+/gm, '') // Blockquotes > text
        .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines
        .trim();
}

/**
 * Strip video URLs from text
 *
 * Removes embedded video URLs from common platforms (YouTube, Vimeo, etc.)
 *
 * @param text - Text with potential video URLs
 * @returns Text without video URLs
 */
function stripVideoUrls(text: string): string {
    const videoUrlPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w-]+/gi,
        /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/[\d]+/gi,
        /(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/[\w-]+/gi,
        /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/[\w-]+/gi
    ];

    let result = text;
    for (const pattern of videoUrlPatterns) {
        result = result.replace(pattern, '');
    }

    return result.trim();
}

/**
 * Check if accommodation has premium features
 *
 * Determines if an accommodation uses any premium features that require
 * specific entitlements. Useful for analytics or upgrade prompts.
 *
 * @param accommodation - Accommodation data to check
 * @returns Object indicating which premium features are used
 *
 * @example
 * ```typescript
 * const premiumFeatures = checkPremiumFeatures(accommodation);
 * if (premiumFeatures.hasRichDescription) {
 *   console.log('This accommodation uses rich description (Pro+ feature)');
 * }
 * ```
 */
export function checkPremiumFeatures(accommodation: AccommodationData): {
    hasRichDescription: boolean;
    hasVideo: boolean;
    hasWhatsApp: boolean;
    isVerified: boolean;
} {
    // Rich-description usage. The markdown heuristic on the plain `description`
    // is a legacy signal for rows that predate the dedicated column; an explicit
    // value in `richDescription` — or in its i18n sibling, which may carry the
    // only premium content when the plain field was never filled — is a direct
    // one. Omitting the sibling here under-reports exactly the field this module
    // gates, which would skew upgrade prompts and analytics against it.
    const hasRichDescription = Boolean(
        accommodation.richDescription ||
            (accommodation.richDescriptionI18n &&
                Object.values(accommodation.richDescriptionI18n).some(
                    (value) => typeof value === 'string' && value.length > 0
                )) ||
            (accommodation.description && /[*#`[\]>~]/.test(accommodation.description))
    );

    // Check for video content
    const hasVideo = Boolean(
        accommodation.videoUrl ||
            (Array.isArray(accommodation.media) &&
                accommodation.media.some((item: { type?: string }) => item.type === 'video'))
    );

    // Check for WhatsApp (HOS-19: the number lives at contactInfo.whatsapp;
    // there is no stored "direct link" flag — DIRECT is a VIEWER capability).
    const hasWhatsApp = Boolean(accommodation.contactInfo?.whatsapp?.trim());

    // Check for verification badge (owner-gated, derived from isVerified column)
    const isVerified = Boolean(accommodation.isVerified);

    return {
        hasRichDescription,
        hasVideo,
        hasWhatsApp,
        isVerified
    };
}

/**
 * Get required entitlements for accommodation features
 *
 * Returns a list of entitlements needed to access all features
 * in the given accommodation.
 *
 * @param accommodation - Accommodation data to analyze
 * @returns Array of required entitlement keys
 *
 * @example
 * ```typescript
 * const required = getRequiredEntitlements(accommodation);
 * console.log('This accommodation requires:', required);
 * // ['can_use_rich_description', 'can_embed_video', 'has_verification_badge']  (HAS_VERIFICATION_BADGE when isVerified=true)
 * ```
 */
export function getRequiredEntitlements(accommodation: AccommodationData): EntitlementKey[] {
    const required: EntitlementKey[] = [];
    const premiumFeatures = checkPremiumFeatures(accommodation);

    if (premiumFeatures.hasRichDescription) {
        required.push(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
    }

    if (premiumFeatures.hasVideo) {
        required.push(EntitlementKey.CAN_EMBED_VIDEO);
    }

    if (premiumFeatures.hasWhatsApp) {
        required.push(EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY);
    }

    if (premiumFeatures.isVerified) {
        required.push(EntitlementKey.HAS_VERIFICATION_BADGE);
    }

    return required;
}
