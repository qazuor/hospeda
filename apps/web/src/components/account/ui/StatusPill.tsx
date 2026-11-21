/**
 * StatusPill and CountPill — the status vocabulary of the Mi Cuenta kit
 * (HOS-2413 T-010).
 *
 * StatusPill takes `domain` + `status` (tone and word come from
 * `status-tone.ts` and i18n) or `tone` + `children`. It ALWAYS renders the
 * word; `dot` is an optional extra. CountPill renders a number capped at
 * `max` («99+») and requires a translated `label` for its accessible name.
 *
 * @module components/account/ui/StatusPill
 */

import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './StatusPill.module.css';
import { type StatusDomain, type StatusTone, statusLabelKey, toneFor } from './status-tone';

type StatusPillBase = {
    /** Adds a small solid dot before the word. */
    readonly dot?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
};

/** Props of {@link StatusPill}: a domain status, or an explicit tone + text. */
export type StatusPillProps = StatusPillBase &
    (
        | {
              readonly domain: StatusDomain;
              /** A status of the domain (the enum wire value). */
              readonly status: string;
              /** Locale for the status word. */
              readonly locale: SupportedLocale;
              readonly tone?: undefined;
              readonly children?: undefined;
          }
        | {
              readonly tone: StatusTone;
              readonly children: ReactNode;
              readonly domain?: undefined;
              readonly status?: undefined;
              readonly locale?: undefined;
          }
    );

/**
 * A pill that says a status in words.
 *
 * @param props - See {@link StatusPillProps}.
 * @returns A `<span>` pill.
 */
export function StatusPill(props: StatusPillProps) {
    const { dot, className, helpId } = props;
    const tone: StatusTone =
        props.domain === undefined
            ? props.tone
            : toneFor({ domain: props.domain, status: props.status });
    const text: ReactNode =
        props.domain === undefined
            ? props.children
            : createT(props.locale)(statusLabelKey({ domain: props.domain, status: props.status }));

    return (
        <span
            {...helpAttr({ helpId })}
            data-tone={tone}
            className={cx(styles.pill, styles[tone], className)}
        >
            {dot ? (
                <span
                    className={styles.dot}
                    aria-hidden="true"
                />
            ) : null}
            {text}
        </span>
    );
}

/** Props of {@link CountPill}. */
export interface CountPillProps {
    /** The count to show. */
    readonly count: number;
    /** Shown as `max+` above this value. @default 99 */
    readonly max?: number;
    /** REQUIRED translated accessible name, with the FULL count (e.g. «120 sin leer»). */
    readonly label: string;
    /** `solid` for attention, `muted` for information. @default 'muted' */
    readonly variant?: 'solid' | 'muted';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * A small numeric pill.
 *
 * @param props - See {@link CountPillProps}.
 * @returns A `<span role="img">` named by `label`.
 */
export function CountPill({
    count,
    max = 99,
    label,
    variant = 'muted',
    className,
    helpId
}: CountPillProps) {
    return (
        <span
            {...helpAttr({ helpId })}
            role="img"
            aria-label={label}
            className={cx(
                styles.pill,
                styles.count,
                variant === 'solid' ? styles.countSolid : styles.countMuted,
                className
            )}
        >
            {count > max ? `${max}+` : count}
        </span>
    );
}
