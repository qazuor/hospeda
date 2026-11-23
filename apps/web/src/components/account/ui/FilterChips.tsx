/**
 * FilterChips — a row of toggle chips that filter a list (HOS-2502, spec §6.1).
 *
 * Each chip is a real `<button>` with `aria-pressed`, 44px tall, in a group
 * named by `label`. Selection is single: pressing a chip selects it, and
 * pressing the selected chip again clears the selection unless the item is
 * marked `exclusive` (the «All» chip, which can never be cleared). The row
 * wraps; it never scrolls the page sideways.
 *
 * Pure presentation: every string arrives translated.
 *
 * @module components/account/ui/FilterChips
 */
import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './FilterChips.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** One chip of {@link FilterChips}. */
export interface FilterChipItem {
    /** Stable value reported to `onChange`. */
    readonly value: string;
    /** Translated visible text. */
    readonly label: ReactNode;
    /** Optional count shown after the label. */
    readonly count?: number;
    /** An item that cannot be unselected by pressing it again (the «All» chip). */
    readonly exclusive?: boolean;
}

/** Props of {@link FilterChips}. */
export interface FilterChipsProps {
    /** REQUIRED translated accessible name of the group. */
    readonly label: string;
    /** The chips, in order. */
    readonly items: readonly FilterChipItem[];
    /** The selected value, or `null` when none is selected. */
    readonly value: string | null;
    /** Called with the new value (`null` when the selection is cleared). */
    readonly onChange: (value: string | null) => void;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit filter chips.
 *
 * @param props - See {@link FilterChipsProps}.
 * @returns A `<fieldset>` group of toggle buttons.
 */
export function FilterChips({
    label,
    items,
    value,
    onChange,
    className,
    helpId
}: FilterChipsProps) {
    return (
        <fieldset
            {...helpAttr({ helpId })}
            aria-label={label}
            className={cx(styles.root, className)}
        >
            {items.map((item) => {
                const pressed = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        className={styles.chip}
                        aria-pressed={pressed}
                        onClick={() => onChange(pressed && !item.exclusive ? null : item.value)}
                    >
                        <span>{item.label}</span>
                        {item.count === undefined ? null : (
                            <span className={styles.count}>{item.count}</span>
                        )}
                    </button>
                );
            })}
        </fieldset>
    );
}
