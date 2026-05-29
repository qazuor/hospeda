/**
 * Pure helpers for global announcement display
 * (SPEC-156 PR-4 T-041).
 *
 * The Astro component (`GlobalAnnouncements.astro`) re-uses these from the
 * server-side render path; the inline client script in the component
 * intentionally re-implements `filterActiveByDate` in vanilla JS so it can
 * run without a hydrated island bundle. The TypeScript copy is the source
 * of truth for the unit tests.
 *
 * @module lib/announcements
 */

import type { AnnouncementItem } from '@repo/schemas';

/**
 * Filter an array of announcements to those whose `[startsAt, endsAt]`
 * window contains `now`. Open-ended bounds count as active.
 *
 * The endpoint already filters server-side, but the response is cached for
 * 5 minutes; re-running the date filter at render time hides items whose
 * `endsAt` passed during the cache window so the user never sees stale
 * banners.
 */
export function filterActiveByDate(
    items: ReadonlyArray<AnnouncementItem>,
    now: Date
): ReadonlyArray<AnnouncementItem> {
    const result: AnnouncementItem[] = [];
    for (const item of items) {
        const starts = item.startsAt ? new Date(item.startsAt) : null;
        const ends = item.endsAt ? new Date(item.endsAt) : null;
        if (starts && starts > now) continue;
        if (ends && ends < now) continue;
        result.push(item);
    }
    return result;
}

/**
 * Pick the announcement text for the requested locale with a fallback
 * chain that prefers the requested locale, then Spanish (operator default),
 * then any non-empty translation. Returns an empty string only when all
 * three locales are blank.
 */
export function pickAnnouncementText(item: AnnouncementItem, locale: string): string {
    if (locale === 'en' && item.text.en) return item.text.en;
    if (locale === 'pt' && item.text.pt) return item.text.pt;
    if (item.text.es) return item.text.es;
    if (item.text.en) return item.text.en;
    if (item.text.pt) return item.text.pt;
    return '';
}
