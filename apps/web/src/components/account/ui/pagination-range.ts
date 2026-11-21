/**
 * Page-range helper for the kit Pagination (HOS-2413 T-014).
 *
 * Pure: no DOM, no React.
 *
 * @module components/account/ui/pagination-range
 */

/** One slot of a numbered paginator. */
export type PageSlot = number | 'ellipsis';

/**
 * Builds the slots of a numbered paginator: always the first and last page,
 * the current page with `siblings` on each side, and an ellipsis for each gap.
 * A gap of exactly one page is shown as that page, never as an ellipsis.
 *
 * @param input - Options object.
 * @param input.page - Current page, 1-based. Clamped into range.
 * @param input.pageCount - Total pages.
 * @param input.siblings - Pages shown on each side of the current one. @default 1
 * @returns The slots in display order. Empty when `pageCount < 1`.
 */
export function buildPageRange({
    page,
    pageCount,
    siblings = 1
}: {
    readonly page: number;
    readonly pageCount: number;
    readonly siblings?: number;
}): readonly PageSlot[] {
    if (pageCount < 1) return [];
    const current = Math.min(Math.max(page, 1), pageCount);
    const wanted = new Set<number>([1, pageCount]);
    for (let p = current - siblings; p <= current + siblings; p++) {
        if (p >= 1 && p <= pageCount) wanted.add(p);
    }
    const sorted = [...wanted].sort((a, b) => a - b);
    const slots: PageSlot[] = [];
    let previous = 0;
    for (const p of sorted) {
        const gap = p - previous;
        if (previous !== 0 && gap === 2) slots.push(previous + 1);
        else if (previous !== 0 && gap > 2) slots.push('ellipsis');
        slots.push(p);
        previous = p;
    }
    return slots;
}
