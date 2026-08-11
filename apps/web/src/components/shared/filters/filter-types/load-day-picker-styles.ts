/**
 * @file load-day-picker-styles.ts
 * @description Lazy loader for react-day-picker's stylesheet (HOS-369 W3-5).
 *
 * `DateRangeFilter.tsx` imported `react-day-picker/style.css` at the top level,
 * and it is re-exported through the `filter-types/index.ts` barrel — so every
 * consumer of that barrel dragged 8,845 B of calendar CSS onto the critical
 * path, render-blocking, including on the home where no date picker exists.
 *
 * Moving the import into a module of its own was NOT enough: Vite merges a
 * module whose only content is a CSS import back into its parent chunk, and
 * Astro then hoists the stylesheet into the page's `<head>` again. Verified in
 * the served HTML, not assumed. `?url` is what breaks the chain — see
 * `lib/ensure-stylesheet.ts` for the full explanation.
 *
 * The DayPicker component itself stays a static import: it is in the filter
 * island's bundle either way, and splitting it would change the popover's
 * behaviour. Only the stylesheet moves, which is the part blocking first paint.
 */
import dayPickerCssUrl from 'react-day-picker/style.css?url';
import { ensureStylesheet } from '@/lib/ensure-stylesheet';

/**
 * Attaches react-day-picker's stylesheet if it is not already present.
 *
 * Called on mount rather than on open, so the stylesheet is in place long
 * before a user can click the trigger — off the critical path, with no flash
 * of unstyled calendar.
 */
export function loadDayPickerStyles(): Promise<void> {
    return ensureStylesheet({ href: dayPickerCssUrl });
}
