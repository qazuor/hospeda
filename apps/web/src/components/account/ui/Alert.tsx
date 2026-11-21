/**
 * Alert — inline messages for the Mi Cuenta kit (HOS-2413 T-024).
 *
 * Tones `info`, `success`, `warning` and `danger`, and the full-bleed `banner`
 * variant. `danger` is `role="alert"` (assertive); the others are
 * `role="status"` (polite). The tone is also said in words (a hidden prefix)
 * and by icon, never by color alone.
 *
 * @module components/account/ui/Alert
 */

import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './Alert.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Alert tones. */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ICONS = {
    info: InfoIcon,
    success: CheckCircleIcon,
    warning: AlertCircleIcon,
    danger: XCircleIcon
} as const;

/** Props of {@link Alert}. */
export interface AlertProps {
    /** Tone. @default 'info' */
    readonly tone?: AlertTone;
    /** `banner` is a full-bleed strip. @default 'inline' */
    readonly variant?: 'inline' | 'banner';
    /** Locale for the hidden tone prefix. */
    readonly locale: SupportedLocale;
    /** Optional bold title line. */
    readonly title?: ReactNode;
    /** Optional action (a Button or LinkButton). */
    readonly action?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Message body. */
    readonly children?: ReactNode;
}

/**
 * The kit inline alert.
 *
 * @param props - See {@link AlertProps}.
 * @returns A `<div role="alert|status">`.
 */
export function Alert({
    tone = 'info',
    variant = 'inline',
    locale,
    title,
    action,
    className,
    helpId,
    children
}: AlertProps) {
    const Icon = ICONS[tone];
    const prefix = createT(locale)(`account.ui.alertTone.${tone}`);
    return (
        <div
            {...helpAttr({ helpId })}
            role={tone === 'danger' ? 'alert' : 'status'}
            data-tone={tone}
            className={cx(
                styles.alert,
                styles[tone],
                variant === 'banner' && styles.banner,
                className
            )}
        >
            <Icon
                size="md"
                className={styles.icon}
                aria-hidden="true"
            />
            <div className={styles.body}>
                <span className={styles.visuallyHidden}>{prefix} </span>
                {title ? <p className={styles.title}>{title}</p> : null}
                {children ? <div className={styles.text}>{children}</div> : null}
            </div>
            {action ? <div className={styles.action}>{action}</div> : null}
        </div>
    );
}
