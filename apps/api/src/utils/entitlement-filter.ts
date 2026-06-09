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
    videoUrl?: string;
    whatsappNumber?: string;
    whatsappDirectLink?: boolean;
    enableWhatsAppDirect?: boolean;
    verificationBadge?: boolean;
    media?: unknown; // May be array of {type, url} (test mocks) or object with featuredImage/gallery/videos (DB)
    [key: string]: unknown;
}

/**
 * Filter accommodation data based on viewer's entitlements
 *
 * Removes or modifies premium content that the caller should not expose:
 * - Omits `richDescription` when the OWNING HOST lacks CAN_USE_RICH_DESCRIPTION
 * - Removes video content if viewer lacks CAN_EMBED_VIDEO
 * - Hides WhatsApp number if viewer lacks CAN_CONTACT_WHATSAPP_DISPLAY
 * - Disables WhatsApp direct link if viewer lacks CAN_CONTACT_WHATSAPP_DIRECT
 * - Removes verification badge if viewer lacks HAS_VERIFICATION_BADGE
 *
 * @param c - Hono context (contains viewer entitlements)
 * @param accommodation - Accommodation data to filter
 * @param ownerEntitlements - Optional entitlement set for the accommodation owner.
 *   When omitted, the function behaves like an admin/internal call site and leaves
 *   `richDescription` untouched. When provided, presence of
 *   `CAN_USE_RICH_DESCRIPTION` is the ONLY signal that `richDescription` may be
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

    try {
        // Check viewer entitlements
        const canEmbedVideo = hasEntitlement(c, EntitlementKey.CAN_EMBED_VIDEO);
        const canDisplayWhatsApp = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY);
        const canUseWhatsAppDirect = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT);
        const hasVerificationBadge = hasEntitlement(c, EntitlementKey.HAS_VERIFICATION_BADGE);

        // OWNER-gated richDescription omission (FR-3b): when ownerEntitlements
        // are provided, presence of CAN_USE_RICH_DESCRIPTION is the ONLY signal
        // that the public payload may include richDescription. The viewer's
        // entitlements are deliberately ignored here.
        if (
            ownerEntitlements &&
            !ownerEntitlements.includes(EntitlementKey.CAN_USE_RICH_DESCRIPTION) &&
            filtered.richDescription
        ) {
            filtered.richDescription = undefined;
            apiLogger.debug(
                `Omitted richDescription from accommodation ${filtered.id} - owner lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
            );
        }

        // Remove video content if not entitled
        if (!canEmbedVideo) {
            // Remove video URL
            if (filtered.videoUrl) {
                filtered.videoUrl = undefined;
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

        // Hide WhatsApp number if not entitled
        if (!canDisplayWhatsApp && filtered.whatsappNumber) {
            filtered.whatsappNumber = undefined;
            apiLogger.debug(
                `Removed WhatsApp number from accommodation ${filtered.id} - viewer lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY}`
            );
        }

        // Disable WhatsApp direct link if not entitled
        if (!canUseWhatsAppDirect) {
            if (filtered.whatsappDirectLink) {
                filtered.whatsappDirectLink = false;
            }
            if (filtered.enableWhatsAppDirect) {
                filtered.enableWhatsAppDirect = false;
            }
            apiLogger.debug(
                `Disabled WhatsApp direct link for accommodation ${filtered.id} - viewer lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT}`
            );
        }

        // Remove verification badge if not entitled
        if (!hasVerificationBadge && filtered.verificationBadge) {
            filtered.verificationBadge = false;
            apiLogger.debug(
                `Removed verification badge from accommodation ${filtered.id} - viewer lacks ${EntitlementKey.HAS_VERIFICATION_BADGE}`
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
    hasWhatsAppDirect: boolean;
    hasVerificationBadge: boolean;
} {
    // Check for markdown in description
    const hasRichDescription = Boolean(
        accommodation.description && /[*#`\[\]>~]/.test(accommodation.description)
    );

    // Check for video content
    const hasVideo = Boolean(
        accommodation.videoUrl ||
            (Array.isArray(accommodation.media) &&
                accommodation.media.some((item: { type?: string }) => item.type === 'video'))
    );

    // Check for WhatsApp
    const hasWhatsApp = Boolean(accommodation.whatsappNumber);

    // Check for WhatsApp direct link
    const hasWhatsAppDirect = Boolean(
        accommodation.whatsappDirectLink || accommodation.enableWhatsAppDirect
    );

    // Check for verification badge
    const hasVerificationBadge = Boolean(accommodation.verificationBadge);

    return {
        hasRichDescription,
        hasVideo,
        hasWhatsApp,
        hasWhatsAppDirect,
        hasVerificationBadge
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
 * // ['can_use_rich_description', 'can_embed_video', 'has_verification_badge']
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

    if (premiumFeatures.hasWhatsAppDirect) {
        required.push(EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT);
    }

    if (premiumFeatures.hasVerificationBadge) {
        required.push(EntitlementKey.HAS_VERIFICATION_BADGE);
    }

    return required;
}
