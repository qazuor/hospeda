/**
 * Content types a newsletter subscriber can opt in or out of per-channel.
 *
 * Each value is a stable JSONB key inside `newsletter_subscribers.preferences`
 * (camelCase to match the rest of the JSONB serialization in this project),
 * and the per-content boolean stored under that key determines whether the
 * subscriber should be included in a campaign whose `contentType` matches.
 *
 * Master ON/OFF lives at the row level via `status` (`active` vs
 * `unsubscribed`); this enum is for the finer-grained per-content gates
 * displayed in the /mi-cuenta/newsletter preferences page.
 *
 * Defaults to ALL content types enabled (`true`) for new subscribers — see
 * the column default in `newsletter_subscribers.dbschema.ts` and the
 * `DEFAULT_NEWSLETTER_PREFERENCES` constant exported with this enum.
 */
export enum NewsletterContentTypeEnum {
    /** Time-limited promotions, discounts, and deal alerts. */
    OFFERS = 'offers',
    /** Upcoming events, festivals, and cultural agenda. */
    EVENTS = 'events',
    /** Editorial travel guides and curated itineraries. */
    GUIDES = 'guides',
    /** Platform updates: new features, regions added, policy notices. */
    PRODUCT_NEWS = 'productNews'
}

/**
 * Default preferences object stored when a subscriber row is first inserted
 * and no explicit preferences payload is provided.
 *
 * KEEP IN SYNC with the JSONB column default declared in
 * `packages/db/src/schemas/newsletter/newsletter_subscribers.dbschema.ts`
 * and the migration that adds the column.
 */
export const DEFAULT_NEWSLETTER_PREFERENCES: Readonly<Record<NewsletterContentTypeEnum, boolean>> =
    {
        [NewsletterContentTypeEnum.OFFERS]: true,
        [NewsletterContentTypeEnum.EVENTS]: true,
        [NewsletterContentTypeEnum.GUIDES]: true,
        [NewsletterContentTypeEnum.PRODUCT_NEWS]: true
    } as const;
