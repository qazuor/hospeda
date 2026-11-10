/**
 * @file listing-editor-error-page.ts
 * @description Fail-closed screen for the venue/experience editor when the
 * section-state map cannot be read (HOS-1787 leaf 5.1).
 *
 * The API answers `503` and never a degraded map (3.12): a listing whose
 * effective entitlement set cannot be resolved is not the same listing as one
 * with no sections. The editor must not guess either — rendering every catalog
 * section would offer an owner pages whose every write the API may refuse, and
 * omitting them silently would look like data loss.
 *
 * So the resolver returns this Response instead of a registry, with the same
 * `503` the API produced and a retry link. It is server-rendered HTML, not an
 * Astro page: the failure happens before the page has any data to lay out.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Input for {@link buildListingEditorErrorResponse}. */
export interface ListingEditorErrorPageParams {
    readonly locale: SupportedLocale;
    /** The exact path to reload; the page that just failed. */
    readonly retryHref: string;
    /** The owner's listing index. */
    readonly backHref: string;
}

/** Escapes the five HTML-significant characters. */
function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Builds the editor's `503` response.
 *
 * @param params - Locale and the two internal links the screen offers.
 * @returns A complete HTML response with status `503`.
 */
export function buildListingEditorErrorResponse({
    locale,
    retryHref,
    backHref
}: ListingEditorErrorPageParams): Response {
    const { t } = createTranslations(locale);
    const title = t('listing.owner.editor.errorPage.title', 'No pudimos cargar el editor');
    const description = t(
        'listing.owner.editor.errorPage.description',
        'No pudimos leer el estado de las secciones de tu ficha. Probá de nuevo en unos minutos.'
    );
    const retry = t('listing.owner.editor.errorPage.retry', 'Reintentar');
    const back = t('listing.owner.editor.errorPage.back', 'Volver a mis fichas');

    const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(retryHref)}">${escapeHtml(retry)}</a></p>
<p><a href="${escapeHtml(backHref)}">${escapeHtml(back)}</a></p>
</main>
</body>
</html>`;

    return new Response(html, {
        status: 503,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}
