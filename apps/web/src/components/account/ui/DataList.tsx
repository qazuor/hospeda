/**
 * DataList — a labelled list of {@link ListRow}s (HOS-2481, spec §6.2).
 *
 * It is the CONTAINER the rows adapt to: rows stack below 40rem of its own
 * width and become one grid line from there, whatever the viewport. It draws
 * no box of its own beyond the row separators, so it lives inside a `Section`
 * (D5 «nunca una caja dentro de otra»).
 *
 * The list is a real `<ul>` named by `label`, so a screen reader
 * announces «Tus consultas, lista, 12 elementos».
 *
 * @module components/account/ui/DataList
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './DataList.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link DataList}. */
export interface DataListProps {
    /** REQUIRED translated accessible name of the list. */
    readonly label: string;
    /** The rows: {@link ListRow} elements. */
    readonly children: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit data list.
 *
 * @param props - See {@link DataListProps}.
 * @returns A container wrapping a labelled `<ul>`.
 */
export function DataList({ label, children, className, helpId }: DataListProps) {
    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.container, className)}
        >
            <ul
                aria-label={label}
                className={styles.list}
            >
                {children}
            </ul>
        </div>
    );
}
