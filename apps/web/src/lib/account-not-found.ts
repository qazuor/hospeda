/**
 * @file account-not-found.ts
 * @description Single entry point for "this account resource does not exist"
 * (HOS-2434). A bare `new Response(null, { status: 404 })` rendered a blank
 * page with no header, sidebar or way out. Pages now REWRITE to
 * `/{locale}/mi-cuenta/no-encontrado/`, which renders inside `AccountLayout`
 * with a link back and sets the 404 status itself, so the status is kept.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Where the "back" link of the not-found page points, keyed by a closed set. */
export const ACCOUNT_NOT_FOUND_BACK_TARGETS = {
    account: { path: 'mi-cuenta', labelKey: 'account.notFound.back.account' },
    messages: { path: 'mi-cuenta/consultas', labelKey: 'account.notFound.back.messages' },
    ownerMessages: {
        path: 'mi-cuenta/consultas-propietario',
        labelKey: 'account.notFound.back.ownerMessages'
    },
    listings: { path: 'mi-cuenta/comercio', labelKey: 'account.notFound.back.listings' },
    properties: { path: 'mi-cuenta/propiedades', labelKey: 'account.notFound.back.properties' },
    events: { path: 'mi-cuenta/eventos', labelKey: 'account.notFound.back.events' },
    posts: { path: 'mi-cuenta/publicaciones', labelKey: 'account.notFound.back.posts' }
} as const;

/** One of the allowed back-link keys. */
export type AccountNotFoundBackKey = keyof typeof ACCOUNT_NOT_FOUND_BACK_TARGETS;

/**
 * Narrows an untrusted query value to an allowed back-link key.
 *
 * @param params.value - Raw `?back=` value, possibly null.
 * @returns The key, or `'account'` when the value is missing or unknown.
 */
export function resolveAccountNotFoundBackKey({
    value
}: {
    readonly value: string | null | undefined;
}): AccountNotFoundBackKey {
    return value && Object.hasOwn(ACCOUNT_NOT_FOUND_BACK_TARGETS, value)
        ? (value as AccountNotFoundBackKey)
        : 'account';
}

/**
 * Builds the rewrite target for the in-layout 404 page.
 *
 * @param params.locale - Active locale.
 * @param params.back - Which section the back link should lead to.
 * @returns A path to pass to `Astro.rewrite()`.
 */
export function buildAccountNotFoundTarget({
    locale,
    back = 'account'
}: {
    readonly locale: SupportedLocale;
    readonly back?: AccountNotFoundBackKey;
}): string {
    return `${buildUrl({ locale, path: 'mi-cuenta/no-encontrado' })}?back=${back}`;
}
