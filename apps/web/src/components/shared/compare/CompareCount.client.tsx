/**
 * @file CompareCount.client.tsx
 * @description Live "Comparás N alojamientos" label for the comparison page
 * (HOS-85 follow-up). Reads the client-only compare-store selection so the
 * count always reflects the exact set the matrix renders. Mounted with
 * `client:only="react"` (no SSR output) to avoid a hydration mismatch on the
 * localStorage-backed count — mirrors how {@link ComparisonMatrix} is mounted.
 *
 * @module components/shared/compare/CompareCount
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCompareStore } from '@/store/compare-store';
import styles from './CompareCount.module.css';

/** Props for the live comparison-count label. */
export interface CompareCountProps {
    /** Locale for the pluralized label. */
    readonly locale: SupportedLocale;
}

/**
 * Renders the live "Comparás N alojamientos" label, or nothing when the
 * selection is empty.
 *
 * @param props - {@link CompareCountProps}
 * @returns The pluralized count label, or `null` when no accommodation is selected.
 */
export function CompareCount({ locale }: CompareCountProps) {
    const { tPlural } = createTranslations(locale);
    const { ids } = useCompareStore();
    const count = ids.length;

    if (count === 0) {
        return null;
    }

    return <p className={styles.count}>{tPlural('accommodations.comparison.page.count', count)}</p>;
}
