/**
 * @file CompareBar.client.tsx
 * @description Floating comparison bar (SPEC-288 T-010, redesigned HOS-85 T-007
 * to teach the user how the feature works). A fixed bar pinned to the bottom of
 * the viewport that surfaces the current client-only comparison selection:
 *
 * - A "Comparás N de M" counter (falls back to a simple pluralized count while
 *   the per-plan cap is still loading/unknown).
 * - A thumbnail strip with the selected items PLUS dashed empty-slot
 *   placeholders up to the plan cap, so the user sees at a glance how many
 *   more accommodations they can add.
 * - A guidance subtitle shown only when exactly one item is selected, nudging
 *   the user to add a second one.
 * - Per-item remove and a clear-all action.
 * - An explicit "Ver comparación" CTA (with a decorative arrow icon) linking
 *   to the comparison page, disabled until {@link MIN_TO_COMPARE} items are
 *   selected.
 *
 * Reads the {@link useCompareStore} `items` (id + name + thumbnail metadata
 * supplied by the CompareButton) for the selection itself, and
 * {@link useCompareGuard} for the per-plan `maxItems` cap used to size the
 * empty-slot strip and the counter. Renders nothing when the selection is
 * empty.
 *
 * Post-review fix (HOS-85): while visible, this bar publishes a
 * `data-compare-bar-visible` flag on `<html>` (cleared on unmount / when the
 * selection empties) so unrelated global UI can react without importing the
 * compare store directly. Mirrors the existing `data-mobile-menu-open` /
 * `data-filters-drawer-open` conventions in `feedback-overrides.css`. Today
 * only `ToastViewport.module.css` reacts to it — moving the toast viewport to
 * the top of the screen so this bottom-anchored bar never covers a toast.
 *
 * @module components/shared/compare/CompareBar
 */

import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import { createTranslations } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { clearCompare, removeFromCompare, useCompareStore } from '@/store/compare-store';
import { ArrowRightIcon, XIcon } from '@repo/icons';
import type { FC, MouseEvent } from 'react';
import { useEffect } from 'react';
import styles from './CompareBar.module.css';

/** `<html>` dataset flag published while the bar is visible. See the file header. */
const COMPARE_BAR_VISIBLE_ATTR = 'compareBarVisible';

/** Minimum number of selected accommodations required to open the comparison. */
const MIN_TO_COMPARE = 2;

/** Selection size at which the guidance subtitle nudges the user to add one more. */
const GUIDANCE_THRESHOLD = 1;

/** Props for the floating compare bar. */
export interface CompareBarProps {
    /** Locale for labels and the comparison page link. Defaults to `es`. */
    readonly locale?: SupportedLocale;
}

/**
 * Whether the per-plan comparison cap is a known, positive, finite number
 * right now. `false` while entitlements are still loading, or when a
 * misconfigured plan reports the `-1` unlimited sentinel / `0` — in either
 * case the UI cannot size the empty-slot strip or show a "N de M" counter.
 *
 * @param params - The guard's current `maxItems` and `isLoading` values.
 * @returns `true` when `maxItems` can be used to size the UI.
 */
function hasKnownCap({
    maxItems,
    isLoading
}: {
    readonly maxItems: number;
    readonly isLoading: boolean;
}): boolean {
    return !isLoading && Number.isFinite(maxItems) && maxItems >= 1;
}

/**
 * Number of empty (not-yet-selected) slots to render in the thumbnail strip,
 * given the current selection size and the per-plan cap.
 *
 * Returns `0` whenever {@link hasKnownCap} is `false` — the strip then shows
 * only the filled thumbnails, never a negative or unbounded placeholder count.
 *
 * @param params - Current selection size, the per-plan cap, and whether the
 *   cap is known.
 * @returns Number of empty slots to render (always `>= 0`).
 */
function computeEmptySlotCount({
    count,
    maxItems,
    capIsKnown
}: {
    readonly count: number;
    readonly maxItems: number;
    readonly capIsKnown: boolean;
}): number {
    if (!capIsKnown) {
        return 0;
    }
    return Math.max(0, maxItems - count);
}

/**
 * Floating comparison bar island.
 *
 * @param props - {@link CompareBarProps}
 * @returns The bar, or `null` when the comparison selection is empty.
 *
 * @example
 * ```astro
 * <CompareBar locale={locale} client:idle />
 * ```
 */
export const CompareBar: FC<CompareBarProps> = ({ locale = 'es' }) => {
    const { items } = useCompareStore();
    const { maxItems, isLoading } = useCompareGuard();
    const { t, tPlural } = createTranslations(locale);
    const isVisible = items.length > 0;

    // Publish/clear the `<html>` flag whenever visibility changes, and clean
    // up on unmount so a stale flag never survives this island going away
    // (e.g. navigating off an accommodation page while the selection is
    // non-empty is not possible today — selection persists across the
    // section — but the cleanup keeps the contract correct regardless).
    useEffect(() => {
        if (!isVisible) {
            return;
        }
        document.documentElement.dataset[COMPARE_BAR_VISIBLE_ATTR] = '';
        return () => {
            delete document.documentElement.dataset[COMPARE_BAR_VISIBLE_ATTR];
        };
    }, [isVisible]);

    // Hidden entirely when nothing is selected.
    if (!isVisible) {
        return null;
    }

    const count = items.length;
    const canCompare = count >= MIN_TO_COMPARE;
    const comparePageHref = `/${locale}/alojamientos/comparar/`;

    const capIsKnown = hasKnownCap({ maxItems, isLoading });
    const emptySlotCount = computeEmptySlotCount({ count, maxItems, capIsKnown });

    const counterLabel = capIsKnown
        ? t('accommodations.comparison.bar.counter', 'Comparás {{current}} de {{max}}', {
              current: count,
              max: maxItems
          })
        : tPlural('accommodations.comparison.bar.count', count);

    const handleCtaClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        // Block navigation until the minimum selection is reached.
        if (!canCompare) {
            event.preventDefault();
        }
    };

    return (
        <section
            // `.barMobile` is the mobile-specific class (HOS-85 T-007): it carries
            // the `<= 640px` overrides that keep the bar bottom-anchored above the
            // site's own sticky navigation AND the mobile filters/list-map floating
            // controls (see the CSS module for the z-index and safe-area
            // rationale). It is always applied; the overrides themselves are gated
            // by the media query, not by a runtime viewport check.
            className={cn(styles.bar, styles.barMobile)}
            aria-label={t('accommodations.comparison.bar.title', 'Comparar alojamientos')}
        >
            <div className={styles.inner}>
                <div className={styles.info}>
                    <p className={styles.count}>{counterLabel}</p>
                    {count === GUIDANCE_THRESHOLD && (
                        <p className={styles.guidance}>
                            {t(
                                'accommodations.comparison.bar.guidance',
                                'Sumá al menos uno más para comparar'
                            )}
                        </p>
                    )}
                </div>

                <ul className={styles.thumbs}>
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className={styles.thumb}
                        >
                            {item.thumbnailUrl ? (
                                <img
                                    src={item.thumbnailUrl}
                                    alt={item.name ?? ''}
                                    className={styles.thumbImg}
                                    loading="lazy"
                                />
                            ) : (
                                <span
                                    className={styles.thumbPlaceholder}
                                    aria-hidden="true"
                                />
                            )}
                            <button
                                type="button"
                                className={styles.removeBtn}
                                onClick={() => removeFromCompare(item.id)}
                                aria-label={t(
                                    'accommodations.comparison.bar.removeItemAriaLabel',
                                    'Quitar de la comparación',
                                    { name: item.name ?? '' }
                                )}
                            >
                                <XIcon
                                    size={14}
                                    weight="bold"
                                    aria-hidden="true"
                                />
                            </button>
                        </li>
                    ))}

                    {Array.from({ length: emptySlotCount }, (_, index) => (
                        <li
                            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder list with no identity beyond position
                            key={`empty-slot-${index}`}
                            className={styles.emptySlot}
                        >
                            <span className="sr-only">
                                {t('accommodations.comparison.bar.emptySlot', 'Vacío')}
                            </span>
                        </li>
                    ))}
                </ul>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={() => clearCompare()}
                    >
                        {t('accommodations.comparison.bar.clear', 'Limpiar')}
                    </button>
                    <a
                        href={comparePageHref}
                        className={styles.cta}
                        aria-disabled={!canCompare}
                        data-disabled={canCompare ? undefined : 'true'}
                        title={
                            canCompare
                                ? undefined
                                : t(
                                      'accommodations.comparison.bar.minRequired',
                                      'Elegí al menos 2 para comparar',
                                      { min: MIN_TO_COMPARE }
                                  )
                        }
                        onClick={handleCtaClick}
                    >
                        {t('accommodations.comparison.bar.viewComparison', 'Ver comparación')}
                        <ArrowRightIcon
                            size={16}
                            weight="bold"
                            aria-hidden="true"
                            className={styles.ctaIcon}
                        />
                    </a>
                </div>
            </div>
        </section>
    );
};
