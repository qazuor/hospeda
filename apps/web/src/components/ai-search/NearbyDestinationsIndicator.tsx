/**
 * @file NearbyDestinationsIndicator.tsx
 * @description Renders which nearby destinations were included in the search
 * when the last turn expanded to "destinos cercanos" (HOS-111 T-014, G-9).
 * Reads `nearbyDestinations` from the `filters` SSE frame (via `useSearchChat`)
 * — see `apps/api/.../search-chat.ts` (T-013) for how the set is resolved, and
 * `AiSearchChatFiltersEventSchema.nearbyDestinations` for the wire shape.
 *
 * Renders nothing when the array is empty (the normal, non-expanded case) —
 * following the extraction pattern used by `OnboardingExamples` / `LoginCta`.
 *
 * @module NearbyDestinationsIndicator
 */

import type { NearbyDestinationSummary } from '@repo/schemas';
import type { createTranslations } from '@/lib/i18n';
import styles from './SearchChatPanel.module.css';

/**
 * Props for {@link NearbyDestinationsIndicator}.
 *
 * @property nearbyDestinations - The resolved neighbor destinations from the
 *   last `filters` event. Empty array (or absent) renders nothing.
 * @property t - Bound translation function (from `createTranslations`).
 */
export interface NearbyDestinationsIndicatorProps {
    readonly nearbyDestinations: ReadonlyArray<NearbyDestinationSummary>;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

/**
 * NearbyDestinationsIndicator — "incluyendo Pueblo Liebig, San José, C. del
 * Uruguay" line shown above the results when the search expanded to nearby
 * destinations (spec HOS-111 §8: "should make it clear which destinations
 * were searched").
 *
 * @example
 * ```tsx
 * <NearbyDestinationsIndicator nearbyDestinations={chat.nearbyDestinations} t={t} />
 * ```
 */
export function NearbyDestinationsIndicator({
    nearbyDestinations,
    t
}: NearbyDestinationsIndicatorProps) {
    if (nearbyDestinations.length === 0) {
        return null;
    }

    const names = nearbyDestinations.map((d) => d.name).join(', ');

    return (
        <output
            className={styles.nearbyIndicator}
            data-testid="ai-search-nearby-destinations"
            aria-live="polite"
        >
            <span className={styles.nearbyIndicatorLabel}>
                {t('aiSearch.nearbyDestinations.label', 'Incluyendo destinos cercanos:')}
            </span>{' '}
            {names}
        </output>
    );
}
