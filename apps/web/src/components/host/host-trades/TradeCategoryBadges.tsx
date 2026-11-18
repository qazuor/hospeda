/**
 * @file TradeCategoryBadges.tsx
 * @description The category badges of a provider (HOS-919 AC-5.1).
 *
 * One shared piece of markup for every place a provider's categories appear:
 * the directory card and the usage card cap it (`max`) and collapse the rest
 * into «+N»; the edit form and the two `mi-cuenta` provider pages show all.
 * Labels come from the multilang catalog name through
 * `@/lib/trade-category-labels`, in the order received (catalog order).
 *
 * Presentational and stateless, so the `.astro` pages render it with no client
 * directive and it ships no JavaScript there.
 */

import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    splitTradeCategoryBadges,
    type TradeCategoryLabelSource
} from '@/lib/trade-category-labels';
import styles from './TradeCategoryBadges.module.css';

/** Props for {@link TradeCategoryBadges}. */
export interface TradeCategoryBadgesProps {
    /** The provider's categories, in catalog order. */
    readonly categories: ReadonlyArray<TradeCategoryLabelSource>;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Badges to show before collapsing the rest into «+N». Omit to show all. */
    readonly max?: number;
    /** Extra class for the list (layout owned by the caller). */
    readonly className?: string;
}

/**
 * Renders a provider's categories as a list of pill badges.
 *
 * @param props - {@link TradeCategoryBadgesProps}
 * @returns The badge list, or `null` when there is nothing to show.
 */
export function TradeCategoryBadges({
    categories,
    locale,
    max = Number.POSITIVE_INFINITY,
    className
}: TradeCategoryBadgesProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const { visible, overflowCount } = splitTradeCategoryBadges({ categories, locale, max });

    if (visible.length === 0) return null;

    return (
        <ul
            className={cn(styles.list, className)}
            aria-label={t('host-trades.card.categoriesLabel', 'Rubros')}
        >
            {visible.map((badge) => (
                <li
                    key={badge.slug}
                    className={styles.badge}
                >
                    {badge.label}
                </li>
            ))}
            {overflowCount > 0 && (
                <li className={cn(styles.badge, styles.overflow)}>
                    <span aria-hidden="true">+{overflowCount}</span>
                    <span className={styles.srOnly}>
                        {t('host-trades.card.moreCategories', '{{count}} rubros más', {
                            count: String(overflowCount)
                        })}
                    </span>
                </li>
            )}
        </ul>
    );
}
