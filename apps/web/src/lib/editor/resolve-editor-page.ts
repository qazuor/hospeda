/**
 * @file resolve-editor-page.ts
 * @description Front-door for every accommodation editor page (HOS-318 T-010).
 *
 * Every editor page (the hub plus one per section of
 * `ACCOMMODATION_EDITOR_REGISTRY`; no fixed count, so this line cannot go
 * stale when a page is added) needs the same four things before it can render: a logged-in user, an id in the route, the accommodation loaded,
 * and a clean redirect when any of those fails. Written once here so a new
 * section page cannot forget one of them.
 */

import type { AstroGlobal } from 'astro';
import { canAccessPublisherArea, publisherDenyRedirect } from '@/lib/account/publisher-access';
import { buildAccountNotFoundTarget } from '@/lib/account-not-found';
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
            redirect: astro.redirect(
                buildLoginRedirect({ locale, currentUrl: astro.url.pathname + astro.url.search })
            )
        };
    }

    const accommodationId = astro.params.id;
    if (
        !canAccessPublisherArea({
            area: 'accommodationEdit',
            permissions: astro.locals.user.permissions
        })
    ) {
        return { redirect: astro.redirect(publisherDenyRedirect({ locale })) };
    }
    if (!accommodationId) {
        return {
            redirect: await astro.rewrite(
                buildAccountNotFoundTarget({ locale, back: 'properties' })
            )
        };
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
        // HOS-2556: a missing id and somebody else's id are indistinguishable
        // and render the in-layout 404 (same as the conversation threads).
        return {
            redirect: await astro.rewrite(
                buildAccountNotFoundTarget({ locale, back: 'properties' })
            )
        };
    }

    return {
        data: result.data,
        locale,
        accommodationId,
        sectionId: section?.id ?? null
    };
}
