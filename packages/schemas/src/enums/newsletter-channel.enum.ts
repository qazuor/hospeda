/**
 * Delivery channels supported by the newsletter subsystem.
 *
 * MVP (SPEC-101) ships with `EMAIL` only. `WHATSAPP` is reserved for V2 when
 * programmatic WhatsApp Business / BSP integration lands. The static channel
 * CTA shown post-verification does NOT go through this enum.
 */
export enum NewsletterChannelEnum {
    EMAIL = 'email',
    WHATSAPP = 'whatsapp'
}
