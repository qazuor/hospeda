/**
 * @file ToggleFilter.tsx
 * @description Boolean toggle switch filter for featured/highlighted items.
 */

import type { SupportedLocale } from '@/lib/i18n';
import styles from '../FilterSidebar.module.css';

/** Configuration for a toggle filter group. */
export interface ToggleFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'toggle';
}

interface ToggleFilterProps {
    readonly config: ToggleFilterConfig;
    readonly value: boolean;
    readonly onChange: (value: boolean) => void;
    readonly locale: SupportedLocale;
}

/**
 * Toggle switch filter component. Renders a styled checkbox acting as a switch.
 * Accessible via keyboard (Space to toggle). The `locale` prop is reserved for
 * future translated aria-labels.
 */
export function ToggleFilter({ config, value, onChange }: ToggleFilterProps) {
    const inputId = `toggle-filter-${config.id}`;

    return (
        <label
            htmlFor={inputId}
            className={styles.toggleLabel}
        >
            <span
                className={styles.toggleTrack}
                aria-hidden="true"
            >
                <span className={styles.toggleThumb} />
            </span>
            <input
                id={inputId}
                type="checkbox"
                className={styles.toggleInput}
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
                role="switch"
                aria-checked={value}
            />
            {config.label}
        </label>
    );
}
