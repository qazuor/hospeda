/**
 * Entitlement Filtering Utilities
 *
 * Provides functions to filter accommodation data by the OWNING HOST's
 * entitlements. Nothing here reads the requesting user: these payloads are
 * shared-cached with no auth in the cache key, so anything derived from the
 * viewer would be computed once and replayed to everyone (HOS-19, HOS-353).
 *
 * @module utils/entitlement-filter
 */

import type { Accommodation, I18nText } from '@repo/schemas';

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
    /**
     * Top-level `videos` JSONB column. HOS-372 moved photos to
     * `accommodation_media` but left videos here, and `composeAccommodationMedia`
     * copies this array into `media.videos` on the way out — so the two must be
     * gated together or neither is gated.
     */
    videos?: unknown;
    /**
     * Media blob (JSONB). Shape is `{ featuredImage, gallery, videos }` since
     * HOS-372 made media relational. Typed `unknown` because it is unvalidated:
     * every reader here narrows it before use. It is NOT an array — a gate that
     * assumed so was dead code for exactly that reason.
     */
    media?: unknown;
    [key: string]: unknown;
}

/**
 * Drops BOTH rich-description fields from an accommodation object before it
 * reaches a payload that must never carry them.
 *
 * `richDescription` and its SPEC-212 i18n sibling `richDescriptionI18n` are
 * PREMIUM fields gated per-owner by the entitlement system. Two families of call
 * site use this — do not narrow the helper to either one:
 *
 *   - PUBLIC card listings, which never render rich text, so both fields must be
 *     absent regardless of the owner's plan.
 *   - The PROTECTED accommodation routes other than `getById` (BETA-199). That
 *     schema declares the pair so the owner's editor can show its translation
 *     status, and `getById` is the only route allowed to emit it — after resolving
 *     the owner's entitlements. The other seven drop it here instead, which keeps
 *     their payloads exactly as they were before the pair was declared.
 *
 * The omission is applied at the DATA level so it is fail-closed and independent of
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
function _readTrimmedString(value: unknown): string {
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
 * - Removes video content (`media.videos` and video URLs inside `description`)
 *   when the OWNING HOST lacks CAN_EMBED_VIDEO. Owner-gated, never viewer-gated:
 *   this payload is shared-cached with no auth in the cache key, so a
 *   viewer-derived field serves the first viewer's plan result to everyone.
 * - Sets `hasWhatsapp` (owner-derived boolean) from `contactInfo.whatsapp`
 *   (HOS-19). The WhatsApp NUMBER is deliberately NOT emitted here — this
 *   endpoint is shared-cached, so the number is gated by the viewer's plan on
 *   the per-user protected endpoint instead.
 * - Forces `isVerified` to false when the OWNING HOST lacks HAS_VERIFICATION_BADGE
 *
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
 *   const filtered = filterAccommodationByEntitlements(accommodation, ownerEntitlements);
 *
 *   return c.json(filtered);
 * });
 * ```
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

// The entitlement-gating functions that used to live here
// (filterAccommodationByEntitlements, filterAccommodationListByOwnerEntitlements,
// checkPremiumFeatures, getRequiredEntitlements and the video-strip helpers) were
// removed with the legacy billing system (HOS-1416). What remains is the
// entitlement-independent surface: unconditional strips and the markdown
// canonicalizer shared with the SQL migrations.
