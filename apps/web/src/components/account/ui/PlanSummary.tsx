/**
 * PlanSummary — one subscription at a glance (HOS-2485, spec HOS-2414 §6.2).
 *
 * The plan name as a heading with its status beside it (a StatusPill: the
 * word, never color alone), then the lines a person checks first — which
 * area of the account it covers, what it costs, when it renews — and a free
 * body (`children`) for the details, notices and actions of that state.
 *
 * Catalog-driven by contract: the caller passes the plan name and the price
 * line already resolved from the catalog and translated. The piece owns no
 * copy and never formats a price (G7 `check:commercial-values`).
 *
 * @module components/account/ui/PlanSummary
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './PlanSummary.module.css';

/** Props of {@link PlanSummary}. */
export interface PlanSummaryProps {
    /** The plan name, read from the catalog. */
    readonly name: ReactNode;
    /** A StatusPill with the subscription status. */
    readonly status?: ReactNode;
    /** The area of the account the plan covers (e.g. «Alojamientos»). */
    readonly scope?: ReactNode;
    /** The price line, already resolved from the catalog and formatted. */
    readonly price?: ReactNode;
    /** The renewal / next charge line. */
    readonly renewal?: ReactNode;
    /** Details, notices and the actions of this state. */
    readonly children?: ReactNode;
    /** Heading level of the plan name. @default 3 */
    readonly headingLevel?: 2 | 3;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit plan summary.
 *
 * @param props - See {@link PlanSummaryProps}.
 * @returns An `<article>`.
 */
export function PlanSummary({
    name,
    status,
    scope,
    price,
    renewal,
    children,
    headingLevel = 3,
    className,
    helpId
}: PlanSummaryProps) {
    const Heading = headingLevel === 2 ? 'h2' : 'h3';
    const lines = [scope, price, renewal].filter((line) => line !== undefined && line !== null);
    return (
        <article
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
        >
            <div className={styles.heading}>
                <Heading className={styles.name}>{name}</Heading>
                {status}
            </div>
            {lines.length > 0 ? (
                <div className={styles.lines}>
                    {scope === undefined ? null : <p className={styles.scope}>{scope}</p>}
                    {price === undefined || price === null ? null : (
                        <p className={styles.price}>{price}</p>
                    )}
                    {renewal === undefined || renewal === null ? null : (
                        <p className={styles.line}>{renewal}</p>
                    )}
                </div>
            ) : null}
            {children === undefined ? null : <div className={styles.body}>{children}</div>}
        </article>
    );
}
