/**
 * MessageBubble — one message of a {@link ConversationThread} (HOS-2481).
 *
 * The side is decided by the THREAD from the viewer, never by the sender type
 * alone (HOS-2419): `mine` aligns right in both inboxes, `theirs` left and
 * `system` centred. The sender is always spoken (a visually hidden prefix),
 * because alignment and color alone tell a screen-reader user nothing.
 *
 * An optimistic message carries `delivery`: `sending` shows a quiet note,
 * `failed` shows an alert with a retry button wired to `onRetry`.
 *
 * @module components/account/ui/MessageBubble
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './MessageBubble.module.css';

/** Where a bubble sits, relative to the person looking at the thread. */
export type MessageBubbleSide = 'mine' | 'theirs' | 'system';

/** Delivery state of an optimistic message. Absent once the server has it. */
export type MessageDelivery = 'sending' | 'failed';

/** Props of {@link MessageBubble}. */
export interface MessageBubbleProps {
    /** Side of the bubble. */
    readonly side: MessageBubbleSide;
    /** Message text (plain text, line breaks kept). */
    readonly body: string;
    /** Translated sender name, spoken before the text (visually hidden). */
    readonly senderLabel: string;
    /** ISO instant of the message. */
    readonly sentAt: string;
    /** Formatted instant shown under the text. */
    readonly sentAtLabel: string;
    /** Locale for the delivery notes. */
    readonly locale: SupportedLocale;
    /** Delivery state of an optimistic message. */
    readonly delivery?: MessageDelivery;
    /** Resends a failed message. Required for the retry button to show. */
    readonly onRetry?: () => void;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit message bubble. Render it inside a {@link ConversationThread}.
 *
 * @param props - See {@link MessageBubbleProps}.
 * @returns A `<li>` aligned by `side`.
 */
export function MessageBubble({
    side,
    body,
    senderLabel,
    sentAt,
    sentAtLabel,
    locale,
    delivery,
    onRetry,
    className,
    helpId
}: MessageBubbleProps) {
    const t = createT(locale);
    return (
        <li
            {...helpAttr({ helpId })}
            className={cx(styles.item, styles[side], className)}
            data-side={side}
            data-delivery={delivery}
        >
            <div className={cx(styles.bubble, delivery === 'failed' && styles.failed)}>
                <p className={styles.body}>
                    <span className={styles.visuallyHidden}>{`${senderLabel}: `}</span>
                    {body}
                </p>
                <time
                    dateTime={sentAt}
                    className={styles.time}
                >
                    {sentAtLabel}
                </time>
            </div>
            {delivery === 'sending' && (
                <p className={styles.delivery}>{t('account.ui.thread.sending')}</p>
            )}
            {delivery === 'failed' && (
                <div
                    className={styles.delivery}
                    role="alert"
                >
                    <span className={styles.failedNote}>{t('account.ui.thread.failed')}</span>
                    {onRetry && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRetry}
                        >
                            {t('account.ui.thread.retry')}
                        </Button>
                    )}
                </div>
            )}
        </li>
    );
}
