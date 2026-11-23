/**
 * OptionCard — one choice in a picking step, as a big button (HOS-2485, spec
 * HOS-2414 §6.2). First consumer: the add-on purchase (which add-on, which
 * listing, which subscription).
 *
 * The whole card is ONE native `<button>`: a title, an optional description
 * and meta line, and a `badge` (e.g. «Activo»). `disabled` uses the native
 * attribute. Pass `data-*` attributes through (the e2e suite reads them).
 * Every text arrives translated; catalog names come from the catalog.
 *
 * @module components/account/ui/OptionCard
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './OptionCard.module.css';

type NativeButtonProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'className' | 'type' | 'title'
>;

/** Props of {@link OptionCard}. */
export type OptionCardProps = NativeButtonProps & {
    /** The option name. */
    readonly title: ReactNode;
    /** One or two lines about the option. */
    readonly description?: ReactNode;
    /** A short secondary fact (a status, a vertical). */
    readonly meta?: ReactNode;
    /** A small element in the corner (e.g. a StatusPill «Activo»). */
    readonly badge?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
};

/**
 * The kit option card.
 *
 * @param props - See {@link OptionCardProps}.
 * @returns A `<button type="button">`.
 */
export function OptionCard({
    title,
    description,
    meta,
    badge,
    className,
    helpId,
    ...rest
}: OptionCardProps) {
    return (
        <button
            {...rest}
            {...helpAttr({ helpId })}
            type="button"
            className={cx(styles.root, className)}
        >
            <span className={styles.heading}>
                <strong className={styles.title}>{title}</strong>
                {badge}
            </span>
            {description === undefined || description === null ? null : (
                <span className={styles.description}>{description}</span>
            )}
            {meta === undefined || meta === null ? null : (
                <span className={styles.meta}>{meta}</span>
            )}
        </button>
    );
}

/** Props of {@link OptionCardGrid}. */
export interface OptionCardGridProps {
    /** The `OptionCard`s. */
    readonly children: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/**
 * Lays OptionCards out by its own width: one column, two from 30rem, three
 * from 48rem.
 *
 * @param props - See {@link OptionCardGridProps}.
 * @returns A `<div>` grid.
 */
export function OptionCardGrid({ children, className }: OptionCardGridProps) {
    return (
        <div className={styles.gridWrap}>
            <div className={cx(styles.grid, className)}>{children}</div>
        </div>
    );
}
