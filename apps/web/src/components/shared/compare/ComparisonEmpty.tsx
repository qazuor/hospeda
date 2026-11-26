import type { AccommodationCardData } from '@/data/types';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './ComparisonMatrix.module.css';
import { comparisonBenefit } from './comparison-benefit';

/** Public fields used by the empty-state suggestion links. */
export type ComparisonSuggestion = Pick<AccommodationCardData, 'id' | 'slug' | 'name'>;

/** Explain comparison and point the visitor to plans or to places to compare. */
export function ComparisonEmpty({
    locale,
    planName,
    planCapacity,
    canCompare,
    isLoading,
    suggestions
}: {
    readonly locale: SupportedLocale;
    readonly planName?: string | null;
    readonly planCapacity?: number;
    readonly canCompare: boolean;
    readonly isLoading: boolean;
    readonly suggestions: readonly ComparisonSuggestion[];
}) {
    const { t, tPlural } = createTranslations(locale);
    const ctaPath = canCompare ? 'alojamientos' : PRICING_PAGE_PATH_BY_AUDIENCE.tourist;
    return (
        <div
            className={styles.panel}
            aria-busy={isLoading}
        >
            <h2 className={styles.panelTitle}>
                {t('accommodations.comparison.empty.title', 'No hay alojamientos para comparar')}
            </h2>
            <p className={styles.panelMessage}>
                {comparisonBenefit({ t, tPlural, planName, planCapacity })}
            </p>
            {canCompare && (
                <p className={styles.panelMessage}>
                    {t('accommodations.comparison.empty.message')}
                </p>
            )}
            {!isLoading && (
                <a
                    className={styles.panelCta}
                    href={buildUrl({ locale, path: ctaPath })}
                >
                    {canCompare
                        ? t('accommodations.comparison.empty.cta', 'Explorar alojamientos')
                        : t('accommodations.comparison.gate.upsellCta', 'Ver planes')}
                </a>
            )}
            {suggestions.length > 0 && (
                <section>
                    <h3>{t('accommodations.comparison.empty.suggestions')}</h3>
                    <ul className={styles.suggestions}>
                        {suggestions.map(({ id, slug, name }) => (
                            <li key={id}>
                                <a
                                    className={styles.panelCta}
                                    href={buildUrl({
                                        locale,
                                        path: `alojamientos/${encodeURIComponent(slug)}`
                                    })}
                                >
                                    {name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
