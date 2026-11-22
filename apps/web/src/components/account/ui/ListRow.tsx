/**
 * ListRow — one row of a {@link DataList} (HOS-2481, spec §6.2).
 *
 * A row reads like a line of an inbox or a listing table: an optional
 * `leading` piece (an avatar, an icon), the `title` with a `meta` line and a
 * `description`, a `trailing` piece (a date, a `CountPill`) and up to two
 * `actions`. Stacked below 40rem of CONTAINER width (the `DataList`), one grid
 * line from there.
 *
 * - `href` turns the title into a link whose hit area covers the whole row.
 *   Actions sit above that hit area, so they stay separately clickable and
 *   the row never nests one interactive element inside another.
 * - At most TWO actions (the type allows no more). A row that needs more
 *   belongs in an overflow `Menu`, which the kit does not have yet: until it
 *   does, pick the two that matter and move the rest to the detail page.
 * - `emphasis` marks the row as needing attention (an unread conversation):
 *   stronger title and an accent rail. It is visual only; say WHY in the
 *   content (a `CountPill` with its own label), never by color alone.
 *
 * Pure presentation: every string arrives translated.
 *
 * @module components/account/ui/ListRow
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './ListRow.module.css';

/** Zero, one or two row actions. More than two belong in an overflow Menu. */
export type ListRowActions = readonly [] | readonly [ReactNode] | readonly [ReactNode, ReactNode];

/** Props of {@link ListRow}. */
export interface ListRowProps {
    /** Main line: who or what the row is about. */
    readonly title: ReactNode;
    /** When given, the title links here and the whole row is the hit area. */
    readonly href?: string;
    /** Piece before the text (avatar, icon). Decorative pieces need `aria-hidden`. */
    readonly leading?: ReactNode;
    /** Secondary line under the title (e.g. the listing). */
    readonly meta?: ReactNode;
    /** Longer text, clamped to one line (e.g. the last message). */
    readonly description?: ReactNode;
    /** Piece at the end (a date, a `CountPill`). */
    readonly trailing?: ReactNode;
    /** Up to two actions (buttons or links). */
    readonly actions?: ListRowActions;
    /** Marks the row as needing attention (visual only). */
    readonly emphasis?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit list row. Render it inside a {@link DataList}.
 *
 * @param props - See {@link ListRowProps}.
 * @returns A `<li>`.
 */
export function ListRow({
    title,
    href,
    leading,
    meta,
    description,
    trailing,
    actions = [],
    emphasis = false,
    className,
    helpId
}: ListRowProps) {
    return (
        <li
            {...helpAttr({ helpId })}
            className={cx(styles.row, emphasis && styles.emphasis, className)}
            data-emphasis={emphasis ? '' : undefined}
        >
            {leading !== undefined && <div className={styles.leading}>{leading}</div>}
            <div className={styles.body}>
                <p className={styles.title}>
                    {href === undefined ? (
                        title
                    ) : (
                        <a
                            href={href}
                            className={styles.link}
                        >
                            {title}
                        </a>
                    )}
                </p>
                {meta !== undefined && <p className={styles.meta}>{meta}</p>}
                {description !== undefined && <p className={styles.description}>{description}</p>}
            </div>
            {trailing !== undefined && <div className={styles.trailing}>{trailing}</div>}
            {actions.length > 0 && (
                <div className={styles.actions}>
                    {actions[0]}
                    {actions[1]}
                </div>
            )}
        </li>
    );
}
