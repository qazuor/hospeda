/**
 * @file support-edits.ts
 * SSR loader for row 26 of the owner's account (HOS-1493): the notice that
 * support edited the content of the owner's listing (administrative action 15).
 *
 * The notice exists because the owner is not watching, but it is enrichment
 * of the editor hub, never a precondition of it: any failure (no session,
 * a network error, an unexpected body) degrades to "no edits" and is logged,
 * so the hub keeps rendering.
 */

import { toBcp47Locale } from '@repo/i18n/web';
import type { ListingSupportEdit, SupportEditPart } from '@repo/schemas';
import { listingSupportEditsApi, type PublishVerticalSlug } from '../api/endpoints-protected';
import { formatDate } from '../format-utils';
import type { SupportedLocale, TranslationFn } from '../i18n';
import { webLogger } from '../logger';
import { buildUrl } from '../urls';

/** The market's time zone: the notice dates the edit as the owner lives it. */
const SITE_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** One literal i18n key per part, so the key guard can see every one. */
const PART_LABEL_KEY: Readonly<Record<SupportEditPart, string>> = {
    texts: 'listing.owner.supportEdit.parts.texts',
    photos: 'listing.owner.supportEdit.parts.photos',
    faq: 'listing.owner.supportEdit.parts.faq',
    hours: 'listing.owner.supportEdit.parts.hours',
    other: 'listing.owner.supportEdit.parts.other'
};

/** The copy of the row 26 notice, ready to render. */
export interface SupportEditNoticeCopy {
    /** Heading of the notice. */
    readonly title: string;
    /** "Support edited the content of this listing on {date}: {parts}." */
    readonly edited: string;
    /** "It was not published, featured or deleted because of this." */
    readonly unchanged: string;
    /** "If you did not ask for it, write to us." */
    readonly contact: string;
    /** Localized contact page URL. */
    readonly contactHref: string;
}

/**
 * Builds the row 26 notice for the most recent support edit, or `null` when
 * there is none (or its date cannot be read), in which case nothing renders.
 *
 * @param params.locale - The page locale.
 * @param params.items - Support edits of the listing.
 * @param params.t - Translation function bound to the locale.
 * @returns The notice copy, or `null`.
 */
export function buildSupportEditNotice({
    locale,
    items,
    t
}: {
    readonly locale: SupportedLocale;
    readonly items: readonly ListingSupportEdit[];
    readonly t: TranslationFn;
}): SupportEditNoticeCopy | null {
    const latest = items.reduce<ListingSupportEdit | null>(
        (best, item) =>
            best === null || Date.parse(item.occurredAt) > Date.parse(best.occurredAt)
                ? item
                : best,
        null
    );
    if (latest === null) return null;

    const occurredAt = new Date(latest.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return null;

    const date = formatDate({
        date: occurredAt,
        locale,
        options: { day: 'numeric', month: 'long', year: 'numeric', timeZone: SITE_TIME_ZONE }
    });
    const labels = [...new Set(latest.parts)].map((part) => t(PART_LABEL_KEY[part]));
    const parts = new Intl.ListFormat(toBcp47Locale(locale), {
        style: 'long',
        type: 'conjunction'
    }).format(labels);

    return {
        title: t('listing.owner.supportEdit.title'),
        edited: t('listing.owner.supportEdit.edited', undefined, { date, parts }),
        unchanged: t('listing.owner.supportEdit.unchanged'),
        contact: t('listing.owner.supportEdit.contact'),
        contactHref: buildUrl({ locale, path: 'contacto' })
    };
}

/** Result of {@link loadSupportEdits}. RO-RO. */
export interface SupportEditsLoadResult {
    /** Support edits of the listing, most recent first; empty on any failure. */
    readonly items: readonly ListingSupportEdit[];
}

/**
 * Loads the latest support edits of one listing the caller owns.
 *
 * @param params.vertical - The listing's vertical (from the page resolution).
 * @param params.listingId - The listing id.
 * @param params.cookieHeader - The SSR cookie header of the request.
 * @returns `{ items }`, never throws.
 */
export async function loadSupportEdits({
    vertical,
    listingId,
    cookieHeader
}: {
    readonly vertical: PublishVerticalSlug;
    readonly listingId: string;
    readonly cookieHeader?: string;
}): Promise<SupportEditsLoadResult> {
    if (!cookieHeader) return { items: [] };
    try {
        const result = await listingSupportEditsApi.list({ vertical, listingId, cookieHeader });
        if (!result.ok) {
            webLogger.warn('[support-edits] Could not load support edits', {
                vertical,
                listingId,
                status: result.error.status
            });
            return { items: [] };
        }
        return { items: Array.isArray(result.data?.items) ? result.data.items : [] };
    } catch (error) {
        webLogger.warn('[support-edits] Support edits request failed', {
            vertical,
            listingId,
            error: error instanceof Error ? error.message : String(error)
        });
        return { items: [] };
    }
}
