/**
 * Who may see the WhatsApp button of a venue listing (HOS-2256 section 7.8).
 *
 * Chosen by the owner, per listing. A missing value (`null` in the column) means
 * "the owner has not decided" and is treated as HIDDEN, which is what every
 * listing did before this setting existed, so promoting it changes nothing
 * until an owner opts in.
 *
 * @module venue-whatsapp-visibility.enum
 */

/**
 * Visibility of a venue's WhatsApp contact.
 *
 * @example
 * ```ts
 * import { VenueWhatsappVisibilityEnum } from '@repo/schemas';
 *
 * const mode = VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY;
 * ```
 */
export enum VenueWhatsappVisibilityEnum {
    /**
     * The number is in the page HTML for everybody. Any scraper can read it:
     * the owner editor says so when this value is picked.
     */
    PUBLIC = 'PUBLIC',
    /**
     * The number is NEVER in the HTML. The button shows to everyone, signed-in
     * visitors get the number from a protected endpoint, and anonymous visitors
     * are sent to sign in when they tap it.
     */
    LOGGED_IN_ONLY = 'LOGGED_IN_ONLY'
}
