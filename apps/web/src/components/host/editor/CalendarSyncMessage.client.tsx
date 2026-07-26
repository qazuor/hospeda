/**
 * @file CalendarSyncMessage.client.tsx
 * @description Status message shown inside the calendar-sync dialog (HOS-320).
 *
 * One component for both message sources — the panel-level OAuth banner and
 * the per-provider row results (iCal and Google alike) — so a success in one
 * place cannot look different from a success in the other.
 *
 * @module CalendarSyncMessage
 */

import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from '@repo/icons';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import styles from './CalendarSyncMessage.module.css';

export type CalendarSyncMessageKind = 'success' | 'error' | 'warning' | 'info';

interface CalendarSyncMessageProps {
    readonly kind: CalendarSyncMessageKind;
    readonly children: React.ReactNode;
    /** Renders the compact variant used inside a provider row. */
    readonly compact?: boolean;
    readonly className?: string;
}

const ICONS = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: InfoIcon
} as const;

/**
 * A status message with an icon, a tinted surface, and text that meets WCAG AA
 * against it in both themes.
 *
 * The icon is not decoration: colour alone was the only thing separating the
 * four kinds, which fails for anyone who cannot rely on it. It is marked
 * `aria-hidden` because the `role` already carries the urgency to assistive
 * tech — errors and warnings interrupt (`alert`), the rest do not (`status`).
 */
export function CalendarSyncMessage({
    kind,
    children,
    compact = false,
    className
}: CalendarSyncMessageProps): JSX.Element {
    const Icon = ICONS[kind];
    return (
        <div
            className={cn(styles.message, compact && styles.compact, className)}
            data-kind={kind}
            role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
        >
            <Icon
                size={compact ? 14 : 16}
                weight="fill"
                className={styles.icon}
                aria-hidden="true"
            />
            <span className={styles.text}>{children}</span>
        </div>
    );
}
