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
interface AccommodationData {
    id: string;
    description?: string;
    videoUrl?: string;
    whatsappNumber?: string;
    whatsappDirectLink?: boolean;
    enableWhatsAppDirect?: boolean;
    verificationBadge?: boolean;
    media?: Array<{
        type?: string;
        url?: string;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
}

/**
 * Filter accommodation data based on viewer's entitlements
 *
 * Removes or modifies premium content that the viewer doesn't have access to:
 * - Strips markdown from description if viewer lacks CAN_USE_RICH_DESCRIPTION
 * - Removes video content if viewer lacks CAN_EMBED_VIDEO
 * - Hides WhatsApp number if viewer lacks CAN_CONTACT_WHATSAPP_DISPLAY
 * - Disables WhatsApp direct link if viewer lacks CAN_CONTACT_WHATSAPP_DIRECT
 * - Removes verification badge if viewer lacks HAS_VERIFICATION_BADGE
 *
 * @param c - Hono context (contains viewer entitlements)
 * @param accommodation - Accommodation data to filter
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
    accommodation: AccommodationData
): AccommodationData {
    // Create a copy to avoid mutating the original
    const filtered = { ...accommodation };

    try {
        // Check viewer entitlements
        const canUseRichDescription = hasEntitlement(c, EntitlementKey.CAN_USE_RICH_DESCRIPTION);
        const canEmbedVideo = hasEntitlement(c, EntitlementKey.CAN_EMBED_VIDEO);
        const canDisplayWhatsApp = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY);
        const canUseWhatsAppDirect = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT);
        const hasVerificationBadge = hasEntitlement(c, EntitlementKey.HAS_VERIFICATION_BADGE);

        // Strip markdown from description if not entitled
        if (!canUseRichDescription && filtered.description) {
            filtered.description = stripMarkdown(filtered.description);
            apiLogger.debug(
                `Stripped markdown from accommodation ${filtered.id} - viewer lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
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
                filtered.media = filtered.media.filter((item) => item.type !== 'video');
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
 * @param text - Text with potential markdown
 * @returns Plain text without markdown
 */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold **text**
        .replace(/\*(.+?)\*/g, '$1') // Italic *text*
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links [text](url)
        .replace(/^#+\s+/gm, '') // Headers # text
        .replace(/^[-*+]\s+/gm, '') // Lists - item
        .replace(/`(.+?)`/g, '$1') // Inline code `code`
        .replace(/^>\s+/gm, '') // Blockquotes > text
        .replace(/~~(.+?)~~/g, '$1') // Strikethrough ~~text~~
        .replace(/!\[(.+?)\]\(.+?\)/g, '$1') // Images ![alt](url)
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
        accommodation.videoUrl || accommodation.media?.some((item) => item.type === 'video')
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
