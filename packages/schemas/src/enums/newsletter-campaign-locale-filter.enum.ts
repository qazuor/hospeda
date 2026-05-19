/**
 * Audience locale filter for a campaign dispatch (SPEC-101 MVP).
 *
 * `ALL` targets every active subscriber regardless of `locale`; the other
 * values restrict the audience to subscribers whose `locale` column matches.
 *
 * The MVP intentionally exposes only the locale axis. Other segmentation
 * dimensions (source, signup date range, accommodation interest, etc.) are
 * out of scope per spec §3.
 */
export enum NewsletterCampaignLocaleFilterEnum {
    ALL = 'all',
    ES = 'es',
    EN = 'en',
    PT = 'pt'
}
