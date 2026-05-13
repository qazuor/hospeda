/**
 * Acquisition source for a newsletter subscriber.
 *
 * Used for analytics segmentation and to identify legacy seeds when running
 * the one-time SPEC-101 migration of `user.settings.newsletter` flags.
 */
export enum NewsletterSourceEnum {
    /** Subscribed via the footer NewsletterForm island (web). */
    WEB_FOOTER = 'web_footer',
    /** Subscribed (or re-subscribed) from /mi-cuenta/preferencias/newsletter/. */
    ACCOUNT_PREFERENCES = 'account_preferences',
    /** Seeded by the SPEC-101 one-time SQL migration of legacy opt-ins. */
    MIGRATION = 'migration'
}
