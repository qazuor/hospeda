/**
 * @file resolve-editor-page.ts
 * @description Front-door for every accommodation editor page (HOS-318 T-010).
 *
 * Eleven pages (the hub plus ten sections) need the same four things before they
 * can render: a logged-in user, an id in the route, the accommodation loaded,
 * and a clean redirect when any of those fails. Written once here so a new
 * section page cannot forget one of them.
 */

import type { AstroGlobal } from 'astro';
import {
    type AccommodationEditorData,
    type EditorDataNeed,
    loadAccommodationEditorData
} from '@/lib/api/accommodation-editor-data';
import { findEditorSectionBySlug } from '@/lib/editor/accommodation-editor-sections';
import type { SupportedLocale } from '@/lib/i18n';
import { buildLoginRedirect } from '@/lib/middleware-helpers';
import { buildUrl } from '@/lib/urls';

/** What a page gets back. Exactly one of `redirect` / `data` is set. */
export type EditorPageResolution =
    | { readonly redirect: Response; readonly data?: undefined }
    | {
          readonly redirect?: undefined;
          readonly data: AccommodationEditorData;
          readonly locale: SupportedLocale;
          readonly accommodationId: string;
          readonly sectionId: string | null;
      };

/**
 * Resolves everything an editor page needs, or the redirect it should return.
 *
 * @param params - The Astro global, the page's section slug (`null` for the
 * hub), and the payloads this page needs loaded.
 * @returns Either a redirect Response to return, or the loaded data.
 */
export async function resolveEditorPage({
    astro,
    sectionSlug,
    need = []
}: {
    readonly astro: AstroGlobal;
    readonly sectionSlug: string | null;
    readonly need?: readonly EditorDataNeed[];
}): Promise<EditorPageResolution> {
    const locale = astro.locals.locale as SupportedLocale;

    if (!astro.locals.user) {
        return {
            redirect: astro.redirect(buildLoginRedirect({ locale, currentUrl: astro.url.pathname }))
        };
    }

    const propertiesUrl = buildUrl({ locale, path: 'mi-cuenta/propiedades' });
    const accommodationId = astro.params.id;
    if (!accommodationId) {
        return { redirect: astro.redirect(propertiesUrl) };
    }

    // An unknown slug must not render a page claiming to be a section that does
    // not exist — send it to the hub, which always exists.
    const section = sectionSlug === null ? null : findEditorSectionBySlug({ slug: sectionSlug });
    if (sectionSlug !== null && !section) {
        return {
            redirect: astro.redirect(
                buildUrl({ locale, path: `mi-cuenta/propiedades/${accommodationId}/editar` })
            )
        };
    }

    const result = await loadAccommodationEditorData({
        accommodationId,
        cookieHeader: astro.request.headers.get('cookie') ?? undefined,
        need
    });

    if (result.status !== 'ok') {
        // Both `redirect` (not yours / gone) and `error` land on the property
        // list: there is no useful editor to show either way, and an error page
        // for "this is not your listing" would be misleading.
        return { redirect: astro.redirect(propertiesUrl) };
    }

    return {
        data: result.data,
        locale,
        accommodationId,
        sectionId: section?.id ?? null
    };
}
