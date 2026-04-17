/**
 * @file StepperFilter.tsx
 * @description Number stepper filter with +/- buttons for capacity, bedrooms, etc.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './StepperFilter.module.css';

/** Configuration for a stepper filter group. */
export interface StepperFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'stepper';
    readonly min?: number;
    readonly max?: number;
    readonly defaultValue?: number;
    readonly suffix?: string;
}

interface StepperFilterProps {
    readonly config: StepperFilterConfig;
    readonly value: number;
    readonly onChange: (value: number) => void;
    readonly locale: SupportedLocale;
}

/**
 * Stepper filter component with increment/decrement buttons.
 * Enforces min/max bounds and shows an optional suffix label.
 */
export function StepperFilter({ config, value, onChange, locale }: StepperFilterProps) {
    const { t } = createTranslations(locale);
    const min = config.min ?? 0;
    const max = config.max ?? 99;

    const decrement = () => {
        if (value > min) onChange(value - 1);
    };

    const increment = () => {
        if (value < max) onChange(value + 1);
    };

    return (
        <div className={styles.stepperRow}>
            <button
                type="button"
                className={cn(styles.stepperBtn, value <= min && styles.stepperBtnDisabled)}
                onClick={decrement}
                disabled={value <= min}
                aria-label={`${t('ui.filter.min', 'Disminuir')} ${config.label}`}
            >
                &minus;
            </button>
            <span
                className={styles.stepperValue}
                aria-live="polite"
                aria-atomic="true"
            >
                {value}
                {config.suffix && (
                    <span className={styles.stepperSuffix}>&nbsp;{config.suffix}</span>
                )}
            </span>
            <button
                type="button"
                className={cn(styles.stepperBtn, value >= max && styles.stepperBtnDisabled)}
                onClick={increment}
                disabled={value >= max}
                aria-label={`${t('ui.filter.max', 'Aumentar')} ${config.label}`}
            >
                &#43;
            </button>
        </div>
    );
}
