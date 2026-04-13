/**
 * @file StarsFilter.tsx
 * @description Star rating selector filter. Click to select a minimum rating.
 * Clicking the same star again deselects (resets to 0).
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from '../FilterSidebar.module.css';

/** Configuration for a stars filter group. */
export interface StarsFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'stars';
    readonly maxStars?: number;
    /** Label for the optional "include null" checkbox shown below the stars row. */
    readonly includeNullLabel?: string;
    /** URL param name for the include-null toggle (e.g. 'includeNoReviews'). */
    readonly includeNullParam?: string;
}

interface StarsFilterProps {
    readonly config: StarsFilterConfig;
    readonly value: number;
    readonly onChange: (value: number) => void;
    readonly locale: SupportedLocale;
    /** Whether to include items without a rating value. */
    readonly includeNull?: boolean;
    /** Callback when the include-null checkbox changes. */
    readonly onIncludeNullChange?: (value: boolean) => void;
}

/**
 * Star rating selector. Supports keyboard navigation (arrow keys and Enter/Space).
 * Value represents the minimum required rating (0 = no filter active).
 * Uses native radio inputs hidden visually to satisfy semantic HTML requirements.
 */
export function StarsFilter({
    config,
    value,
    onChange,
    locale,
    includeNull,
    onIncludeNullChange
}: StarsFilterProps) {
    const { t } = createTranslations(locale);
    const maxStars = config.maxStars ?? 5;
    const groupName = `stars-filter-${config.id}`;

    return (
        <fieldset className={styles.starsFieldset}>
            <legend className={styles.visuallyHidden}>{config.label}</legend>
            <div
                className={styles.starsRow}
                role="presentation"
            >
                {Array.from({ length: maxStars }, (_, i) => {
                    const star = i + 1;
                    const isFilled = star <= value;
                    const inputId = `${groupName}-${star}`;
                    return (
                        <label
                            key={star}
                            htmlFor={inputId}
                            className={cn(styles.starBtn, isFilled && styles.starBtnFilled)}
                            aria-label={`${star} ${t('ui.filter.stars', 'estrellas')}`}
                        >
                            {isFilled ? '★' : '☆'}
                            <input
                                id={inputId}
                                type="radio"
                                name={groupName}
                                className={styles.visuallyHidden}
                                value={String(star)}
                                checked={star === value}
                                onChange={() => onChange(value === star ? 0 : star)}
                            />
                        </label>
                    );
                })}
            </div>
            {config.includeNullLabel && onIncludeNullChange && (
                <label className={styles.includeNullLabel}>
                    <input
                        type="checkbox"
                        className={styles.includeNullCheckbox}
                        checked={includeNull ?? false}
                        onChange={(e) => onIncludeNullChange(e.target.checked)}
                    />
                    {config.includeNullLabel}
                </label>
            )}
        </fieldset>
    );
}
