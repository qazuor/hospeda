/**
 * @file account-pagination.ts
 * @description Page-number helpers for the `/mi-cuenta/` list pages (HOS-2440).
 * Properties, events and posts used to request a fixed first page of 50 and
 * silently drop the rest. These pages are SSR, so the page lives in the URL
 * (`?page=N`) and the server asks the API for exactly that page.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Items per page on the account list pages. */
export const ACCOUNT_LIST_PAGE_SIZE = 20;

/** Upper bound for a requested page, so a hostile `?page=` cannot reach the API. */
const MAX_PAGE = 10_000;

/**
 * Parses a raw `?page=` value into a safe 1-based page number.
 *
 * @param params.value - Raw query value, possibly null.
 * @returns A positive integer; `1` for missing, non-numeric or non-positive input.
 */
export function parsePageParam({ value }: { readonly value: string | null | undefined }): number {
    if (!value || !/^\d+$/.test(value)) return 1;
    const parsed = Number.parseInt(value, 10);
    return parsed >= 1 ? Math.min(parsed, MAX_PAGE) : 1;
}

/** What the page needs to render its pager. */
export interface AccountPageState {
    /** The page being shown (clamped into range when the API reports a total). */
    readonly page: number;
    /** Total number of pages, at least 1. */
    readonly totalPages: number;
    /** `true` when the requested page is past the end and holds nothing. */
    readonly isPastEnd: boolean;
}

/**
 * Derives the pager state from the API's pagination envelope.
 *
 * @param params.requestedPage - The page that was asked for.
 * @param params.total - Total items reported by the API, or `null` when unknown.
 * @param params.pageSize - Page size that was requested.
 * @returns The pager state. With an unknown total the pager is a single page.
 */
export function resolveAccountPageState({
    requestedPage,
    total,
    pageSize = ACCOUNT_LIST_PAGE_SIZE
}: {
    readonly requestedPage: number;
    readonly total: number | null;
    readonly pageSize?: number;
}): AccountPageState {
    if (total === null || total <= 0) {
        return { page: requestedPage, totalPages: 1, isPastEnd: false };
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { page: requestedPage, totalPages, isPastEnd: requestedPage > totalPages };
}

/**
 * Builds the URL of one page of a list.
 *
 * @param params.locale - Active locale.
 * @param params.path - Page path below the locale, e.g. `mi-cuenta/propiedades`.
 * @param params.page - Target page; page 1 carries no query string.
 * @returns The page URL.
 */
export function buildAccountPageHref({
    locale,
    path,
    page
}: {
    readonly locale: SupportedLocale;
    readonly path: string;
    readonly page: number;
}): string {
    const base = buildUrl({ locale, path });
    return page <= 1 ? base : `${base}?page=${page}`;
}
