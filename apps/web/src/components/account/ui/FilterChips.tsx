/**
 * FilterChips — a row of toggle chips that filter a list (HOS-2502, spec §6.1).
 *
 * Each chip is a real `<button>` with `aria-pressed`, 44px tall, in a fieldset
 * named by `label`. Two modes:
 *
 * - `single` (default): one chip is selected; pressing it again clears the
 *   selection unless the item is `exclusive`.
 * - `multiple`: any number of chips are selected. An `exclusive` item (the
 *   «All» chip) is pressed while nothing else is, and pressing it clears the
 *   selection.
 *
 * The row wraps; it never scrolls the page sideways.
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

type FilterChipsBase = {
    /** REQUIRED translated accessible name of the group. */
    readonly label: string;
    /** The chips, in order. */
    readonly items: readonly FilterChipItem[];
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
};

/** Props of {@link FilterChips}. */
export type FilterChipsProps = FilterChipsBase &
    (
        | {
              readonly mode?: 'single';
              /** The selected value, or `null` when none is selected. */
              readonly value: string | null;
              /** Called with the new value (`null` when the selection is cleared). */
              readonly onChange: (value: string | null) => void;
          }
        | {
              readonly mode: 'multiple';
              /** The selected values; empty means no filter. */
              readonly value: readonly string[];
              /** Called with the new selection. */
              readonly onChange: (value: readonly string[]) => void;
          }
    );

/**
 * Whether a chip is pressed in the current selection.
 *
 * @param input - Options object.
 * @param input.item - The chip.
 * @param input.props - The component props.
 * @returns True when the chip is pressed.
 */
function isPressed({
    item,
    props
}: {
    readonly item: FilterChipItem;
    readonly props: FilterChipsProps;
}): boolean {
    if (props.mode === 'multiple') {
        return item.exclusive ? props.value.length === 0 : props.value.includes(item.value);
    }
    return item.value === props.value;
}

/**
 * Reports the selection a press produces.
 *
 * @param input - Options object.
 * @param input.item - The pressed chip.
 * @param input.props - The component props.
 * @returns Nothing; calls `onChange`.
 */
function press({
    item,
    props
}: {
    readonly item: FilterChipItem;
    readonly props: FilterChipsProps;
}): void {
    if (props.mode === 'multiple') {
        if (item.exclusive) {
            props.onChange([]);
            return;
        }
        const next = props.value.includes(item.value)
            ? props.value.filter((value) => value !== item.value)
            : [...props.value, item.value];
        props.onChange(next);
        return;
    }
    const pressed = item.value === props.value;
    props.onChange(pressed && !item.exclusive ? null : item.value);
}

/**
 * The kit filter chips.
 *
 * @param props - See {@link FilterChipsProps}.
 * @returns A `<fieldset>` group of toggle buttons.
 */
export function FilterChips(props: FilterChipsProps) {
    const { label, items, className, helpId } = props;
    return (
        <fieldset
            {...helpAttr({ helpId })}
            aria-label={label}
            className={cx(styles.root, className)}
        >
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    className={styles.chip}
                    aria-pressed={isPressed({ item, props })}
                    onClick={() => press({ item, props })}
                >
                    <span>{item.label}</span>
                    {item.count === undefined ? null : (
                        <span className={styles.count}>{item.count}</span>
                    )}
                </button>
            ))}
        </fieldset>
    );
}
