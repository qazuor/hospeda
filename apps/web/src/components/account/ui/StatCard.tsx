/**
 * StatCard and StatGrid — the dashboard numbers of the Mi Cuenta kit
 * (HOS-2414, first consumer HOS-2473).
 *
 * A StatCard is one labelled number drawn through `AsyncRegion`, so each card
 * owns its five states: a Skeleton while loading, «—» plus «Reintentar» when
 * the read failed, «—» for a successful empty read, a `LockedState` when the
 * plan does not grant it, and the value when ready. A failed read can never
 * render as `0`: the error slot draws the dash, never a number.
 *
 * StatGrid lays the cards out by CONTAINER width (one column, two from 30rem,
 * four from 48rem), never by the viewport.
 *
 * Every card carries `data-widget` with its stable id, so a page test can list
 * the widgets a dashboard renders (HOS-2414 AC-11).
 *
 * @module components/account/ui/StatCard
 */

import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { AsyncRegion, type AsyncResult } from './AsyncRegion';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { LockedState } from './LockedState';
import { Skeleton } from './Skeleton';
import styles from './StatCard.module.css';
import { TextLink } from './TextLink';

/** What a ready StatCard shows. */
export interface StatValue {
    /** The number (or short word), already formatted by the caller. */
    readonly value: ReactNode;
    /** One short line under the value. */
    readonly hint?: ReactNode;
}

/** Props of {@link StatCard}. */
export interface StatCardProps {
    /** Stable widget id, rendered as `data-widget`. */
    readonly id: string;
    /** Translated label of the number. */
    readonly label: string;
    /** The card's own async state. */
    readonly state: AsyncResult<StatValue>;
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** Optional link to the page behind the number. */
    readonly link?: { readonly href: string; readonly label: string };
    /** Decorative icon (an `@repo/icons` element with `aria-hidden`). */
    readonly icon?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/** The dash a card shows when it has no number to show. */
function Dash({ locale }: { readonly locale: SupportedLocale }) {
    return (
        <p className={cx(styles.value, styles.dash)}>
            <span aria-hidden="true">—</span>
            <span className={styles.visuallyHidden}>
                {createT(locale)('account.ui.stat.unavailable')}
            </span>
        </p>
    );
}

/**
 * One dashboard number with its own loading, error, empty and locked states.
 *
 * @param props - See {@link StatCardProps}.
 * @returns A `<div>` card.
 */
export function StatCard({
    id,
    label,
    state,
    locale,
    link,
    icon,
    className,
    helpId
}: StatCardProps) {
    const t = createT(locale);
    return (
        <div
            {...helpAttr({ helpId })}
            data-widget={id}
            data-state={state.status}
            className={cx(styles.card, className)}
        >
            <div className={styles.head}>
                <p className={styles.label}>{label}</p>
                {icon ? (
                    <span
                        className={styles.icon}
                        aria-hidden="true"
                    >
                        {icon}
                    </span>
                ) : null}
            </div>
            <AsyncRegion
                state={state}
                loading={() => <Skeleton.Stat locale={locale} />}
                error={({ retry }) => (
                    <div
                        className={styles.error}
                        role="alert"
                    >
                        <Dash locale={locale} />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={retry}
                        >
                            {t('account.ui.error.retry')}
                        </Button>
                    </div>
                )}
                empty={() => <Dash locale={locale} />}
                locked={(reason) => (
                    <LockedState
                        reason={reason}
                        locale={locale}
                    />
                )}
                ready={(data) => (
                    <>
                        <p className={styles.value}>{data.value}</p>
                        {data.hint ? <p className={styles.hint}>{data.hint}</p> : null}
                    </>
                )}
            />
            {link && state.status !== 'locked' ? (
                <TextLink
                    href={link.href}
                    className={styles.link}
                >
                    {link.label}
                </TextLink>
            ) : null}
        </div>
    );
}

/** Props of {@link StatGrid}. */
export interface StatGridProps {
    /** The StatCards. */
    readonly children: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Lays StatCards out by container width.
 *
 * @param props - See {@link StatGridProps}.
 * @returns A `<div>` grid.
 */
export function StatGrid({ children, className, helpId }: StatGridProps) {
    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.container, className)}
        >
            <div className={styles.grid}>{children}</div>
        </div>
    );
}
