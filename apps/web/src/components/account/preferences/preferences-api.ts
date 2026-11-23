/**
 * @file preferences-api.ts
 * @description Small fetch helpers shared by the Preferences sections
 * (HOS-2479). They reuse the endpoints each account page used before the
 * on/off settings moved here; no endpoint is new.
 */

import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';

/** Joins the API base URL and a path without doubling the slash. */
export function joinApi({ apiUrl, path }: { readonly apiUrl: string; readonly path: string }) {
    return `${apiUrl.replace(/\/$/, '')}${path}`;
}

/** Reads the `{ error }` envelope of a failed response, or `null`. */
export async function readApiError({
    res
}: {
    readonly res: Response;
}): Promise<ApiErrorShape | null> {
    try {
        const body = (await res.json()) as { readonly error?: ApiErrorShape };
        return body?.error ?? null;
    } catch {
        return null;
    }
}

/**
 * Sends a mutation and throws an `Error` with a translated message when the
 * API refuses it. Resolves with nothing on success.
 */
export async function sendMutation({
    url,
    method,
    body,
    locale,
    fallback
}: {
    readonly url: string;
    readonly method: 'POST' | 'PATCH' | 'DELETE';
    readonly body?: unknown;
    readonly locale: SupportedLocale;
    readonly fallback: string;
}): Promise<void> {
    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.ok) return;
    const error = await readApiError({ res });
    throw new Error(translateApiError({ error, locale, fallback }));
}
