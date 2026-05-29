/**
 * Pure helpers shared by the announcement editor pages
 * (list T-038 / create T-039 / edit T-040).
 *
 * Keeping these out of the page modules makes the threshold logic + label
 * mapping testable in isolation and avoids cross-page divergence on
 * cosmetic concerns like window descriptions or variant tones.
 *
 * @module features/announcements/helpers
 */

import type { AnnouncementItem, AnnouncementVariant } from '@repo/schemas';

export type AnnouncementWindowState = 'alwaysOn' | 'startsAt' | 'endsAt' | 'between';

/**
 * Classify an announcement's publication window so the UI can render a
 * single label instead of branching on optional dates inline. Returns:
 *
 *   - `alwaysOn`  when neither bound is set
 *   - `startsAt`  when only the lower bound is set
 *   - `endsAt`    when only the upper bound is set
 *   - `between`   when both bounds are set
 */
export function classifyWindow(item: AnnouncementItem): AnnouncementWindowState {
    const hasStart = Boolean(item.startsAt);
    const hasEnd = Boolean(item.endsAt);
    if (hasStart && hasEnd) return 'between';
    if (hasStart) return 'startsAt';
    if (hasEnd) return 'endsAt';
    return 'alwaysOn';
}

/**
 * Pick the Badge variant for a given announcement variant tag. The mapping
 * mirrors the variant -> tone palette used by `<UsageProgressBar>` (T-035)
 * and the rest of the admin so the palette stays consistent across pages.
 */
export function pickVariantBadgeVariant(
    variant: AnnouncementVariant
): 'default' | 'destructive' | 'outline' {
    switch (variant) {
        case 'info':
            return 'outline';
        case 'warning':
            return 'default';
        case 'danger':
            return 'destructive';
        default:
            return 'outline';
    }
}

/**
 * Format an ISO-8601 date string for display in the announcement window
 * row. Returns `null` when the input is missing or invalid so callers can
 * short-circuit. Uses `dateStyle: 'short'` for compact list rendering.
 */
export function formatWindowDate(iso: string | undefined, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(date);
    } catch {
        return iso.slice(0, 10);
    }
}

/**
 * Returns a short preview of an announcement's text in the operator's
 * default locale (`es`). Falls back through `en` -> `pt` -> the first
 * available locale to avoid blank cells when one locale is missing.
 */
export function pickPreviewText(item: AnnouncementItem): string {
    const candidates = [item.text.es, item.text.en, item.text.pt].filter(
        (s): s is string => typeof s === 'string' && s.length > 0
    );
    if (candidates.length === 0) return '';
    const first = candidates[0] ?? '';
    if (first.length <= 80) return first;
    return `${first.slice(0, 77).trimEnd()}…`;
}
