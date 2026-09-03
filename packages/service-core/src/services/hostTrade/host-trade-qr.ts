import { EntityTypeEnum } from '@repo/schemas';

/**
 * Where a provider's QR sends a host, and how that code is labelled in the
 * admin panel (HOS-981 PR 4).
 *
 * ## Why this lives in `service-core` and not next to the renderer
 *
 * Two callers need the same string and neither can see the other. `apps/api`
 * builds it when it first provisions a provider's code, and
 * {@link HostTradeService} rebuilds it when the provider's slug changes, so that
 * an already-printed sticker keeps landing on a page that exists. Leaving the
 * builder in `apps/api/src/utils/host-trade-qr.ts` — where it was born — would
 * have forced the service to spell the path a second time, and the day the two
 * spellings disagreed nothing would fail: the QR would simply start redirecting
 * to a 404, silently, for every provider that ever renamed itself.
 *
 * @module services/hostTrade/host-trade-qr
 */

/** Path the redirect lands a host on, relative to the site root. */
export const HOST_TRADE_USAGE_PATH_PREFIX = '/mi-cuenta/directorio-proveedores';

/** Last segment of that path. */
export const HOST_TRADE_USAGE_PATH_SUFFIX = 'registrar-uso';

/** `qr_codes.label` is `varchar(200)`; a longer label is a failed insert. */
const QR_CODE_LABEL_MAX_LENGTH = 200;

/** The entity type every provider QR is filed under. */
export const HOST_TRADE_QR_ENTITY_TYPE = EntityTypeEnum.HOST_TRADE;

/**
 * Builds the URL a provider's QR REDIRECTS TO.
 *
 * Since HOS-981 PR 4 this is no longer what the QR encodes — the printed code
 * carries `/qr/{qrSlug}/` and the platform 302s here. The distinction is the
 * whole point of the change: this URL contains the listing's slug, which the
 * provider may rename, and only a value stored in a row can be corrected after
 * a sticker is printed.
 *
 * @param input - Input parameters.
 * @param input.slug - The LISTING's slug (`host_trades.slug`), not the QR's.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 *   A trailing slash is tolerated.
 * @returns The absolute URL of the usage-registration page.
 */
export function buildHostTradeUsageUrl(input: {
    readonly slug: string;
    readonly siteUrl: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    // The slug is slug-shaped by construction, so this encodes nothing today.
    // It is here so that a value carrying `?` or `#` truncates into a 404
    // rather than into a different page than the one intended.
    const slug = encodeURIComponent(input.slug);
    return `${base}${HOST_TRADE_USAGE_PATH_PREFIX}/${slug}/${HOST_TRADE_USAGE_PATH_SUFFIX}`;
}

/**
 * Recovers the site origin from a URL previously built by
 * {@link buildHostTradeUsageUrl}.
 *
 * This exists so the slug-change hook can rebuild a target URL without
 * `service-core` ever learning what `HOSPEDA_SITE_URL` is. Threading that env
 * var through every `new HostTradeService(...)` in `apps/api` would be a
 * fail-OPEN dependency: a construction site that forgot it would keep working
 * and simply stop repointing QR codes, which is the exact defect this PR
 * closes and the one no test would notice. The stored row already carries the
 * origin its code was minted with, so reading it back is both sufficient and
 * self-correcting.
 *
 * @param input - Input parameters.
 * @param input.targetUrl - The currently stored target URL.
 * @returns The origin (`https://host[:port]`), or `null` when the stored value
 *   is not a parseable absolute URL.
 */
export function resolveSiteUrlFromTargetUrl(input: { readonly targetUrl: string }): string | null {
    try {
        return new URL(input.targetUrl).origin;
    } catch {
        return null;
    }
}

/**
 * Builds the operator-facing name of a provider's QR code.
 *
 * `qr_codes.label` is what an admin searches on a year from now, when the only
 * thing they have is a photograph of a sticker. It therefore carries BOTH the
 * listing's display name (what a human calls the provider) and its slug (what
 * the target URL contains), because either one alone fails a real lookup: two
 * providers may share a trading name, and nobody remembers a slug.
 *
 * The result is truncated to the column's width rather than left to fail at
 * insert time — a provider with a very long name must still get a QR.
 *
 * @param input - Input parameters.
 * @param input.name - The listing's display name.
 * @param input.slug - The listing's slug.
 * @returns A label of at most 200 characters.
 */
export function buildHostTradeQrLabel(input: {
    readonly name: string;
    readonly slug: string;
}): string {
    const label = `Host trade usage QR — ${input.name} (${input.slug})`;
    return label.length > QR_CODE_LABEL_MAX_LENGTH
        ? label.slice(0, QR_CODE_LABEL_MAX_LENGTH)
        : label;
}
