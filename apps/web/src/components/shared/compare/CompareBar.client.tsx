/**
 * @file CompareBar.client.tsx
 * @description Floating comparison bar (SPEC-288 T-010). A fixed bar pinned to
 * the bottom of the viewport that surfaces the current client-only comparison
 * selection: a thumbnail strip with per-item remove, a clear-all action, and a
 * "Comparar ahora" CTA linking to the comparison page.
 *
 * Reads the {@link useCompareStore} `items` (id + name + thumbnail metadata
 * supplied by the CompareButton). Renders nothing when the selection is empty.
 * The CTA stays disabled until at least {@link MIN_TO_COMPARE} items are
 * selected (the comparison endpoint requires a minimum of two).
 *
 * @module components/shared/compare/CompareBar
 */

import { createTranslations } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { clearCompare, removeFromCompare, useCompareStore } from '@/store/compare-store';
import { XIcon } from '@repo/icons';
import type { FC, MouseEvent } from 'react';
import styles from './CompareBar.module.css';

/** Minimum number of selected accommodations required to open the comparison. */
const MIN_TO_COMPARE = 2;

/** Props for the floating compare bar. */
export interface CompareBarProps {
    /** Locale for labels and the comparison page link. Defaults to `es`. */
    readonly locale?: SupportedLocale;
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
    const { t, tPlural } = createTranslations(locale);

    // Hidden entirely when nothing is selected.
    if (items.length === 0) {
        return null;
    }

    const canCompare = items.length >= MIN_TO_COMPARE;
    const comparePageHref = `/${locale}/alojamientos/comparar/`;

    const handleCtaClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        // Block navigation until the minimum selection is reached.
        if (!canCompare) {
            event.preventDefault();
        }
    };

    return (
        <section
            className={styles.bar}
            aria-label={t('accommodations.comparison.bar.title', 'Comparar alojamientos')}
        >
            <div className={styles.inner}>
                <p className={styles.count}>
                    {tPlural('accommodations.comparison.bar.count', items.length)}
                </p>

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
                        {t('accommodations.comparison.bar.compareNow', 'Comparar ahora')}
                    </a>
                </div>
            </div>
        </section>
    );
};
