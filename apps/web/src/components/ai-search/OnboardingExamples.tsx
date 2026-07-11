/**
 * @file OnboardingExamples.tsx
 * @description Empty-state onboarding message + clickable example-query chips
 * for SearchChatPanel (SPEC-265 B1a/B1b). Extracted from
 * SearchChatPanel.client.tsx (HOS-111 follow-up) to keep that file under the
 * repo's 500-line limit.
 *
 * @module OnboardingExamples
 */

import type { createTranslations } from '@/lib/i18n';
import styles from './SearchChatPanel.module.css';
import { EXAMPLE_QUERY_KEYS, TYPE_EXAMPLE_KEY } from './search-chat-panel.constants';

/**
 * Props for {@link OnboardingExamples}.
 *
 * @property pageType - Active accommodation type from the page URL
 *   (SPEC-265 B1b). When set (e.g. `'CABIN'`) and a matching type-specific
 *   example exists, it's prepended to the generic example pool.
 * @property t - Bound translation function (from `createTranslations`).
 * @property onExampleClick - Called with the example query's translated text
 *   when a chip is clicked.
 */
export interface OnboardingExamplesProps {
    readonly pageType?: string;
    readonly t: ReturnType<typeof createTranslations>['t'];
    readonly onExampleClick: (query: string) => void;
}

/**
 * OnboardingExamples — shown in the message thread before the first turn
 * (SPEC-265 B1a). Clicking an example chip sends that query immediately.
 *
 * @example
 * ```tsx
 * <OnboardingExamples pageType={pageType} t={t} onExampleClick={handleExampleClick} />
 * ```
 */
export function OnboardingExamples({ pageType, t, onExampleClick }: OnboardingExamplesProps) {
    // Context-aware example keys (SPEC-265 B1b): when pageType is set and has
    // a matching type-specific example, prepend it to the generic pool.
    const typeKey = pageType ? TYPE_EXAMPLE_KEY[pageType] : undefined;
    const exampleKeys: readonly string[] = typeKey
        ? [typeKey, ...EXAMPLE_QUERY_KEYS]
        : EXAMPLE_QUERY_KEYS;

    return (
        <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
                {t(
                    'aiSearch.chat.emptyState',
                    'Hacé tu primera pregunta y te ayudo a encontrar el alojamiento ideal.'
                )}
            </p>
            <div
                className={styles.exampleChips}
                data-testid="ai-search-examples"
            >
                <span className={styles.exampleLabel}>
                    {t('aiSearch.examples.label', 'Probá con estos ejemplos:')}
                </span>
                {exampleKeys.map((key) => (
                    <button
                        key={key}
                        type="button"
                        className={styles.exampleChip}
                        onClick={() => onExampleClick(t(key, key))}
                    >
                        {t(key, key)}
                    </button>
                ))}
            </div>
        </div>
    );
}
