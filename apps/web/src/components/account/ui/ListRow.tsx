/**
 * ListRow — one row of a list of things: an entry point, a conversation, a
 * listing (HOS-2414, first consumer HOS-2473; `DataList` follows in HOS-2481).
 *
 * Anatomy: optional leading `media` (an icon or an Avatar), a title, an
 * optional description, optional trailing `meta` (a CountPill, a StatusPill)
 * and at most two `actions`. A row with more than two actions belongs in a
 * `Menu` (HOS-2483), so the type refuses a third.
 *
 * With `href` the whole row is clickable: the title is the real link and a
 * stretched pseudo-element covers the row, while actions sit above it and stay
 * clickable on their own. Layout responds to the row's container: a grid from
 * 40rem, stacked below.
 *
 * @module components/account/ui/ListRow
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './ListRow.module.css';

/** At most two row actions; more go in a Menu. */
export type ListRowActions = readonly [ReactNode] | readonly [ReactNode, ReactNode];

/** Props of {@link ListRow}. */
export interface ListRowProps {
    /** The row's title. Becomes the link text when `href` is set. */
    readonly title: ReactNode;
    /** One supporting line. */
    readonly description?: ReactNode;
    /** Makes the whole row a link to this target. */
    readonly href?: string;
    /** Leading icon or Avatar (decorative). */
    readonly media?: ReactNode;
    /** Trailing information (a CountPill, a StatusPill). */
    readonly meta?: ReactNode;
    /** At most two actions, rendered above the row link. */
    readonly actions?: ListRowActions;
    /** `li` inside a list, `div` elsewhere. @default 'li' */
    readonly as?: 'li' | 'div';
    /** Stable id rendered as `data-row`, for tests and analytics. */
    readonly rowId?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * One list row.
 *
 * @param props - See {@link ListRowProps}.
 * @returns An `<li>` (or `<div>`) row.
 */
export function ListRow({
    title,
    description,
    href,
    media,
    meta,
    actions,
    as = 'li',
    rowId,
    className,
    helpId
}: ListRowProps) {
    const Root = as;
    return (
        <Root
            {...helpAttr({ helpId })}
            data-row={rowId}
            className={cx(styles.container, className)}
        >
            <div className={cx(styles.row, href && styles.linked)}>
                {media ? (
                    <span
                        className={styles.media}
                        aria-hidden="true"
                    >
                        {media}
                    </span>
                ) : null}
                <div className={styles.text}>
                    <p className={styles.title}>
                        {href ? (
                            <a
                                href={href}
                                className={styles.link}
                            >
                                {title}
                            </a>
                        ) : (
                            title
                        )}
                    </p>
                    {description ? <p className={styles.description}>{description}</p> : null}
                </div>
                {meta || (actions && actions.length > 0) ? (
                    <div className={styles.trailing}>
                        {meta ? <span className={styles.meta}>{meta}</span> : null}
                        {actions && actions.length > 0 ? (
                            <div className={styles.actions}>{actions}</div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Root>
    );
}
