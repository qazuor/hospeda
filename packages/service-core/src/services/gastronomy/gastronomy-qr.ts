import { EntityTypeEnum, QrCodePurposeEnum } from '@repo/schemas';

/**
 * Where a venue's menu QR sends a diner, and how its target survives a slug
 * change (HOS-1044 §6.2, §6.3).
 *
 * ## Why this lives in `service-core` and not in `apps/api`
 *
 * Two callers need the same shape and neither can see the other. `apps/api`
 * builds the target URL when it first provisions a venue's menu code
 * (`routes/gastronomy/protected/menuQr.ts`), and {@link GastronomyService}
 * rebuilds it when the venue renames its slug. Leaving the builder in
 * `apps/api` would have forced the service to spell the path a second time —
 * exactly the drift `HostTradeService`'s equivalent module
 * (`hostTrade/host-trade-qr.ts`) was written to avoid.
 *
 * @module services/gastronomy/gastronomy-qr
 */

/** The entity type every menu QR is filed under. */
export const GASTRONOMY_MENU_QR_ENTITY_TYPE = EntityTypeEnum.GASTRONOMY;

/**
 * WHICH of a venue's codes this module is about.
 *
 * A gastronomy listing may grow other QR purposes over time (the listing's
 * own brochure code already exists under `QrCodePurposeEnum.BROCHURE`), so
 * naming this one explicitly is what keeps the lookup key from silently
 * colliding with a future addition.
 */
export const GASTRONOMY_MENU_QR_PURPOSE = QrCodePurposeEnum.MENU;

/** `qr_codes.label` is `varchar(200)`; a longer label is a failed insert. */
const QR_CODE_LABEL_MAX_LENGTH = 200;

/**
 * Matches the public menu page's path, `/{lang}/gastronomia/{slug}/carta/`,
 * capturing the language segment. Used only to READ BACK the language a
 * stored target was minted with — the venue's slug is not captured, because
 * the whole point of a repoint is to write a NEW one over it.
 */
const GASTRONOMY_MENU_PATH_PATTERN = /^\/([a-z]{2})\/gastronomia\/[^/]+\/carta\/?$/;

/**
 * Builds the absolute URL a menu QR should redirect to.
 *
 * @param input - Input parameters.
 * @param input.siteUrl - Public base URL of the web app. A trailing slash is
 *   tolerated.
 * @param input.lang - The locale segment of the public menu page.
 * @param input.slug - The venue's CURRENT slug.
 * @returns The absolute `/{lang}/gastronomia/{slug}/carta/` URL.
 */
export function buildGastronomyMenuQrTargetUrl(input: {
    readonly siteUrl: string;
    readonly lang: string;
    readonly slug: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    const lang = encodeURIComponent(input.lang);
    const slug = encodeURIComponent(input.slug);
    return `${base}/${lang}/gastronomia/${slug}/carta/`;
}

/**
 * Recovers the language segment from a target URL previously built by
 * {@link buildGastronomyMenuQrTargetUrl}.
 *
 * This is what lets the slug-change repointing hook (`GastronomyService.
 * _afterUpdate`) rebuild the target without guessing which locale the code
 * was minted for — it reads the stored row instead, the same principle
 * `resolveSiteUrlFromTargetUrl` (`hostTrade/host-trade-qr.ts`) applies to the
 * site origin.
 *
 * @param input - Input parameters.
 * @param input.targetUrl - The currently stored target URL.
 * @returns The two-letter locale segment, or `null` when the stored value is
 *   not a parseable absolute URL or does not match the menu page's shape.
 */
export function resolveGastronomyMenuQrLangFromTargetUrl(input: {
    readonly targetUrl: string;
}): string | null {
    try {
        const { pathname } = new URL(input.targetUrl);
        return GASTRONOMY_MENU_PATH_PATTERN.exec(pathname)?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * Builds the operator-facing name of a venue's menu QR code.
 *
 * Carries BOTH the venue's display name and its slug, for the same reason
 * `buildHostTradeQrLabel` does: an admin searching a year from now, holding
 * only a photograph of a printed sticker, needs either one to find the row.
 *
 * @param input - Input parameters.
 * @param input.name - The venue's display name.
 * @param input.slug - The venue's slug.
 * @returns A label of at most 200 characters.
 */
export function buildGastronomyMenuQrLabel(input: {
    readonly name: string;
    readonly slug: string;
}): string {
    const label = `Gastronomy menu QR — ${input.name} (${input.slug})`;
    return label.length > QR_CODE_LABEL_MAX_LENGTH
        ? label.slice(0, QR_CODE_LABEL_MAX_LENGTH)
        : label;
}
