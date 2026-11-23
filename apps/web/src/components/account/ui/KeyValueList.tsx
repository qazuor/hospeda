/**
 * KeyValueList — a read-only list of labelled facts (HOS-2472).
 *
 * Renders a real `<dl>` (one `<div>` group per fact, valid HTML) for the data
 * a person reads but does not edit: a provider's schedule, a plan's limits.
 * Label above value below 30rem of container width, label beside value from
 * there. Pure presentation: every label and value arrives already translated,
 * so the piece owns no copy.
 *
 * @module components/account/ui/KeyValueList
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './KeyValueList.module.css';

/** One fact of a {@link KeyValueList}. */
export interface KeyValueItem {
    /** Stable key of the fact. */
    readonly key: string;
    /** Translated label (the `<dt>`). */
    readonly label: ReactNode;
    /** Value (the `<dd>`): text, a pill, a link. */
    readonly value: ReactNode;
}

/** Props of {@link KeyValueList}. */
export interface KeyValueListProps {
    /** The facts, in reading order. */
    readonly items: readonly KeyValueItem[];
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit key/value list.
 *
 * @param props - See {@link KeyValueListProps}.
 * @returns A `<dl>`, or `null` when there is nothing to show.
 */
export function KeyValueList({ items, className, helpId }: KeyValueListProps) {
    if (items.length === 0) return null;
    return (
        <div className={styles.container}>
            <dl
                {...helpAttr({ helpId })}
                className={cx(styles.root, className)}
            >
                {items.map((item) => (
                    <div
                        key={item.key}
                        className={styles.row}
                    >
                        <dt className={styles.label}>{item.label}</dt>
                        <dd className={styles.value}>{item.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
