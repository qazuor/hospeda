/**
 * What a visitor did on a listing page that is worth counting (HOS-2256).
 *
 * Stored in `entity_interactions.kind`. A CLOSED list on purpose, like
 * {@link PartnerLogoClickDestinationEnum}: a counter grouped by a free-text
 * column stops grouping the first time someone writes `phone-click`.
 *
 * @module entity-interaction-kind.enum
 */

/**
 * Every interaction kind the capture endpoint can record.
 *
 * @example
 * ```ts
 * import { EntityInteractionKindEnum } from '@repo/schemas';
 *
 * const kind = EntityInteractionKindEnum.PHONE_CLICK;
 * ```
 */
export enum EntityInteractionKindEnum {
    /** The visitor tapped a `tel:` link (mobile or landline). */
    PHONE_CLICK = 'PHONE_CLICK',
    /** The visitor tapped the "see on map" / directions link. */
    MAP_CLICK = 'MAP_CLICK',
    /** The visitor tapped the listing's own website. */
    WEBSITE_CLICK = 'WEBSITE_CLICK',
    /** The visitor tapped the listing's Instagram link. */
    INSTAGRAM_CLICK = 'INSTAGRAM_CLICK',
    /** The visitor tapped a "buy ticket" link of one event (carries an event id). */
    TICKET_CLICK = 'TICKET_CLICK',
    /** The visitor tapped the WhatsApp button (HOS-2256 section 7.8). */
    WHATSAPP_CLICK = 'WHATSAPP_CLICK',
    /**
     * An event was shown to the visitor (carries an event id). Reserved for
     * HOS-2265; nothing emits it yet, so it changes no number today.
     */
    EVENT_IMPRESSION = 'EVENT_IMPRESSION'
}
