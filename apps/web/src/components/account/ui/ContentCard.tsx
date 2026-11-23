/**
 * ContentCard — one card for an item the user authored: an event, a post or a
 * promotion (HOS-2505, spec HOS-2416 §6.1).
 *
 * Replaces `EditableContentCard.astro` and its duplicated `<style>` blocks.
 * Anatomy: the title (a real link to the editor when `href` is given), an
 * optional `meta` line, a list of labelled statuses (each one a word, never
 * only a color), a free body slot and a footer of `actions`.
 *
 * The card holds no copy of its own beyond the accessible name of the status
 * list. It sits inside the `MyContentList` grid as an `<li>`.
 *
 * @module components/account/ui/ContentCard
 */

import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './ContentCard.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** One labelled status of a {@link ContentCard}. */
export interface ContentCardStatus {
    /** Stable key (e.g. `moderation`). */
    readonly key: string;
    /** Translated label of the axis (e.g. «Moderación»). */
    readonly label: string;
    /** The value, usually a `StatusPill`. */
    readonly value: ReactNode;
}

/** Props of {@link ContentCard}. */
export interface ContentCardProps {
    /** Visible title. */
    readonly title: ReactNode;
    /** Locale for the fixed copy (the status list name). */
    readonly locale: SupportedLocale;
    /** Destination of the title link (the editor). Without it the title is plain text. */
    readonly href?: string;
    /** One short line under the title (a date range, a benefit). */
    readonly meta?: ReactNode;
    /** Labelled statuses, in reading order. */
    readonly statuses?: readonly ContentCardStatus[];
    /** Free body content. */
    readonly children?: ReactNode;
    /** Footer actions. Keep them to one or two. */
    readonly actions?: ReactNode;
    /** Root element: `li` inside a list, `div` alone. @default 'li' */
    readonly as?: 'li' | 'div';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit content card.
 *
 * @param props - See {@link ContentCardProps}.
 * @returns An `<li>` (default) or `<div>` card.
 */
export function ContentCard({
    title,
    locale,
    href,
    meta,
    statuses,
    children,
    actions,
    as = 'li',
    className,
    helpId
}: ContentCardProps) {
    const t = createT(locale);
    const Root = as;

    return (
        <Root
            {...helpAttr({ helpId })}
            className={cx(styles.card, className)}
        >
            <div className={styles.body}>
                <h3 className={styles.title}>
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
                </h3>
                {meta === undefined ? null : <p className={styles.meta}>{meta}</p>}
                {statuses && statuses.length > 0 ? (
                    <dl
                        className={styles.statuses}
                        aria-label={t('account.ui.contentCard.statuses')}
                    >
                        {statuses.map((status) => (
                            <div
                                key={status.key}
                                className={styles.status}
                            >
                                <dt className={styles.statusLabel}>{status.label}</dt>
                                <dd className={styles.statusValue}>{status.value}</dd>
                            </div>
                        ))}
                    </dl>
                ) : null}
                {children}
            </div>
            {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
        </Root>
    );
}
