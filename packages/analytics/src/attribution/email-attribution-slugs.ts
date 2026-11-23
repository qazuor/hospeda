/**
 * Deterministic attribution slugs for emails (HOS-2359 §6.0).
 *
 * The email renderer and `pnpm umami:setup` compute the same string from the same
 * catalog key, so neither needs a lookup table, a DB read or a network call to agree
 * on a template's pixel.
 */

/** Prefix of a transactional email template's Umami pixel slug. */
export const EMAIL_TEMPLATE_PIXEL_PREFIX = 'email-';

/** Prefix of a newsletter campaign's Umami pixel slug. */
export const NEWSLETTER_PIXEL_PREFIX = 'newsletter-';

/** Max length of the title part of a newsletter campaign slug. */
const NEWSLETTER_TITLE_MAX_LENGTH = 40;

/**
 * Normalizes any string to a kebab-case UTM token: diacritics stripped (`ñ` → `n`),
 * lowercased, every run of characters outside `[a-z0-9]` replaced by one `-`, and
 * leading/trailing `-` trimmed.
 *
 * @param value - Free-form text
 * @returns The token (possibly empty)
 */
export function toUtmToken(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * `utm_campaign` of a transactional email: its catalog key as a token
 * (`auth.reset-password` → `auth-reset-password`).
 *
 * @param input - `key`: the email catalog entry key (`<sendPath>.<id>`)
 * @returns The campaign token
 */
export function buildEmailTemplateCampaign({ key }: { readonly key: string }): string {
    return toUtmToken(key);
}

/**
 * Umami pixel slug of a transactional email template (`email-auth-reset-password`).
 *
 * @param input - `key`: the email catalog entry key
 * @returns The pixel slug
 */
export function buildEmailTemplatePixelSlug({ key }: { readonly key: string }): string {
    return `${EMAIL_TEMPLATE_PIXEL_PREFIX}${toUtmToken(key)}`;
}

/**
 * Attribution slug of a newsletter campaign: the title as a token cut at 40 chars
 * (no trailing `-`), plus `-` and the first 8 hex chars of the campaign id. An empty
 * title yields `newsletter-<id8>`.
 *
 * @param input - Campaign `title` and `id` (UUID)
 * @returns The campaign slug (`utm_campaign`)
 */
export function buildNewsletterCampaignSlug({
    title,
    id
}: {
    readonly title: string;
    readonly id: string;
}): string {
    const id8 = id.replace(/-/g, '').toLowerCase().slice(0, 8);
    const titleToken = toUtmToken(title).slice(0, NEWSLETTER_TITLE_MAX_LENGTH).replace(/-+$/g, '');
    return titleToken.length > 0 ? `${titleToken}-${id8}` : `newsletter-${id8}`;
}

/**
 * Umami pixel slug of a newsletter campaign (`newsletter-<campaignSlug>`).
 *
 * @param input - `campaignSlug` from {@link buildNewsletterCampaignSlug}
 * @returns The pixel slug
 */
export function buildNewsletterPixelSlug({
    campaignSlug
}: {
    readonly campaignSlug: string;
}): string {
    return `${NEWSLETTER_PIXEL_PREFIX}${campaignSlug}`;
}
