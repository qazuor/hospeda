/**
 * @file resolve-authored-editor-item.ts
 * @description Loads the item behind an author's own event or post editor
 * (`mi-cuenta/eventos/[id]/editar`, `mi-cuenta/publicaciones/[id]/editar`), or the
 * in-layout 404 the page should return instead (HOS-2556).
 *
 * The event/post counterpart of `resolve-editor-page.ts`: a missing id, an id
 * that does not exist and an id that belongs to another author all answer the
 * SAME rewrite. Telling them apart would confirm the existence of another
 * author's content to someone who may not read it.
 */

import type { AstroGlobal } from 'astro';
import { type AccountNotFoundBackKey, buildAccountNotFoundTarget } from '@/lib/account-not-found';
import type { ApiResult } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { webLogger as logger } from '@/lib/logger';

/** The slice of the Astro global this resolver reads. */
export type AuthoredEditorAstro = Pick<AstroGlobal, 'params' | 'request' | 'rewrite'> & {
    readonly locals: { readonly locale?: unknown };
};

/** Exactly one of `notFound` / `item` is set. */
export type AuthoredEditorItemResolution<T> =
    | { readonly notFound: Response; readonly item?: undefined }
    | { readonly notFound?: undefined; readonly item: T };

/**
 * Reads the route id and fetches the author-scoped item, or resolves the in-layout 404.
 *
 * @param params.astro - The page's Astro global.
 * @param params.back - Which account section the 404's back link leads to.
 * @param params.fetchById - The protected, author-scoped read (e.g. `eventEditApi.getById`).
 * @param params.logTag - Prefix for the failure log line.
 * @returns The fetched item, or the rewrite Response the page must return.
 */
export async function resolveAuthoredEditorItem<T>({
    astro,
    back,
    fetchById,
    logTag
}: {
    readonly astro: AuthoredEditorAstro;
    readonly back: Extract<AccountNotFoundBackKey, 'events' | 'posts'>;
    readonly fetchById: (input: {
        readonly id: string;
        readonly cookieHeader?: string;
    }) => Promise<ApiResult<T>>;
    readonly logTag: string;
}): Promise<AuthoredEditorItemResolution<T>> {
    const locale = astro.locals.locale as SupportedLocale;
    const notFound = async (): Promise<AuthoredEditorItemResolution<T>> => ({
        notFound: await astro.rewrite(buildAccountNotFoundTarget({ locale, back }))
    });

    const id = astro.params.id;
    if (!id) return notFound();

    const cookieHeader = astro.request.headers.get('cookie') ?? undefined;
    const result = await fetchById({ id, cookieHeader });
    if (!result.ok) {
        // 403 (not the author) and 404 (no such item) land in the same place on purpose.
        logger.error(`${logTag} Failed to fetch item`, result.error.message);
        return notFound();
    }
    return { item: result.data };
}
