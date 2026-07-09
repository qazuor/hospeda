/**
 * @file ResultsSection.tsx
 * @description Results header + skeleton/grid/empty-state block for
 * SearchChatPanel (SPEC-212 T-010). Extracted from SearchChatPanel.client.tsx
 * (HOS-111 follow-up) to keep that file under the repo's 500-line limit —
 * this section has no closure over parent state beyond what's passed as
 * props, so it lifts out cleanly.
 *
 * Callers are responsible for the `showResults` visibility decision (whether
 * to mount this component at all) — see `SearchChatPanel.client.tsx`.
 *
 * @module ResultsSection
 */

import type { AccommodationPublic } from '@repo/schemas';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import { ResultCard } from './ResultCard';
import styles from './SearchChatPanel.module.css';

/** Number of skeleton cards to show while results are loading. */
const SKELETON_COUNT = 3;

/** Stable keys for the decorative loading skeletons (avoids array-index keys). */
const SKELETON_KEYS: readonly string[] = Array.from(
    { length: SKELETON_COUNT },
    (_unused, index) => `skeleton-${index}`
);

/**
 * Props for {@link ResultsSection}.
 *
 * @property resultsLoading - True while the accommodations GET is in flight.
 * @property results - Accommodation results from the last successful search.
 * @property locale - Active locale for card price formatting and detail links.
 * @property t - Bound translation function (from `createTranslations`).
 */
export interface ResultsSectionProps {
    readonly resultsLoading: boolean;
    readonly results: ReadonlyArray<AccommodationPublic>;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

/**
 * ResultsSection — results count header + skeleton/grid/empty-state body.
 *
 * HOS-111 T-003: the results container gets a subtle themed background
 * (`resultsSurface`) so it reads as distinct from the chat thread above it.
 * HOS-111 T-004: the match count renders as a prominent pill badge.
 * HOS-111 T-003/T-008: the zero-results state renders as a bordered card
 * (never a bare full-width paragraph), so it never reads as "the grid
 * collapsed to one column" (the original Bug #8 report).
 *
 * @example
 * ```tsx
 * <ResultsSection
 *   resultsLoading={chat.resultsLoading}
 *   results={chat.results}
 *   locale={locale}
 *   t={t}
 * />
 * ```
 */
export function ResultsSection({ resultsLoading, results, locale, t }: ResultsSectionProps) {
    return (
        <div
            className={`${styles.results} ${styles.resultsSurface}`}
            data-testid="ai-search-results"
        >
            <div className={styles.resultsHeader}>
                <span className={styles.resultsLabel}>
                    {t('aiSearch.chat.resultsLabel', 'Resultados')}
                </span>
                {!resultsLoading && (
                    <span
                        className={styles.resultsCount}
                        data-testid="ai-search-results-count"
                    >
                        {results.length}
                    </span>
                )}
            </div>

            {resultsLoading ? (
                /* Skeleton grid while the accommodations GET is in flight.
                   D-9: resultsLoading and isStreaming can both be true at once
                   (filters event arrives before the reply finishes). */
                <output
                    className={styles.skeletonGrid}
                    aria-label={t('aiSearch.chat.resultsLoading', 'Buscando alojamientos…')}
                >
                    {SKELETON_KEYS.map((key) => (
                        <div
                            key={key}
                            className={styles.skeletonCard}
                            aria-hidden="true"
                        />
                    ))}
                </output>
            ) : results.length > 0 ? (
                <ul
                    className={styles.resultsGrid}
                    aria-label={t('aiSearch.chat.resultsLabel', 'Resultados encontrados')}
                >
                    {results.map((item) => (
                        <li key={item.id}>
                            <ResultCard
                                item={item}
                                locale={locale}
                                t={t}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <p
                    className={styles.resultsEmpty}
                    data-testid="ai-search-results-empty"
                >
                    {t(
                        'aiSearch.chat.resultsEmpty',
                        'No encontré alojamientos con esos filtros. Probá aflojar algún criterio.'
                    )}
                </p>
            )}
        </div>
    );
}
