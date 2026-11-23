/**
 * ConversationThread — the messages of one conversation, for BOTH inboxes
 * (HOS-2481 / HOS-2482, spec G-4).
 *
 * One component serves the guest and the owner: `viewer` says who is looking,
 * and each bubble's side is resolved from it (HOS-2419). The same conversation
 * rendered with `viewer="guest"` and `viewer="owner"` is therefore a mirror:
 * own messages on the right in both.
 *
 * The thread draws messages only. Sending lives in `Composer`, and the
 * optimistic state (a message still `sending`, or `failed` with a retry) is
 * the caller's: it passes `delivery` on the message and `onRetry`.
 *
 * Times are formatted in the product's time zone, so the server render and the
 * hydrated island print the same text.
 *
 * @module components/account/ui/ConversationThread
 */

import type { ReactNode } from 'react';
import {
    type ConversationViewerRole,
    resolveConversationBubbleSide
} from '@/lib/conversation-bubble-side';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './ConversationThread.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { MessageBubble, type MessageDelivery } from './MessageBubble';

/** Product time zone: server and browser print the same instant. */
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** BCP 47 tag per app locale for date formatting. */
const INTL_LOCALE: Readonly<Record<SupportedLocale, string>> = {
    es: 'es-AR',
    en: 'en-US',
    pt: 'pt-BR'
};

/** Who is looking at the thread. */
export type ThreadViewer = ConversationViewerRole;

/** One message of a {@link ConversationThread}. */
export interface ThreadMessage {
    /** Stable id (a temporary one while an optimistic message is in flight). */
    readonly id: string;
    /** Message text. */
    readonly body: string;
    /** `guest`, `owner` or `system` (any case). */
    readonly senderType: string;
    /** ISO instant. */
    readonly createdAt: string;
    /** Delivery state of an optimistic message; absent once delivered. */
    readonly delivery?: MessageDelivery;
}

/** Props of {@link ConversationThread}. */
export interface ConversationThreadProps {
    /** Who is looking: decides which messages are «mine». */
    readonly viewer: ThreadViewer;
    /** Messages, oldest first. */
    readonly messages: readonly ThreadMessage[];
    /** Locale for labels and dates. */
    readonly locale: SupportedLocale;
    /** Translated accessible name of the message list. */
    readonly label?: string;
    /** Resends a failed optimistic message. */
    readonly onRetry?: (input: { readonly id: string }) => void;
    /** Slot above the messages (e.g. «load older»). */
    readonly before?: ReactNode;
    /** Slot below the messages (e.g. a read receipt). */
    readonly after?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Formats a message instant as a short date and time in the product time zone.
 *
 * @param input - Options object.
 * @param input.iso - ISO instant.
 * @param input.locale - App locale.
 * @returns The formatted text, or the raw value when it is not a date.
 */
export function formatMessageTime({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: SupportedLocale;
}): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIME_ZONE
    }).format(date);
}

/**
 * The kit conversation thread.
 *
 * @param props - See {@link ConversationThreadProps}.
 * @returns The labelled, ordered list of messages with its slots.
 */
export function ConversationThread({
    viewer,
    messages,
    locale,
    label,
    onRetry,
    before,
    after,
    className,
    helpId
}: ConversationThreadProps) {
    const t = createT(locale);
    const counterpart: ThreadViewer = viewer === 'guest' ? 'owner' : 'guest';
    const senderLabel = {
        mine: t('account.ui.thread.you'),
        theirs: t(`account.ui.thread.sender.${counterpart}`),
        system: t('account.ui.thread.sender.system')
    } as const;

    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.container, className)}
            data-viewer={viewer}
        >
            {before}
            <ol
                className={styles.list}
                aria-label={label ?? t('account.ui.thread.label')}
            >
                {messages.map((message) => {
                    const side = resolveConversationBubbleSide({
                        senderType: message.senderType,
                        viewerRole: viewer
                    });
                    return (
                        <MessageBubble
                            key={message.id}
                            side={side}
                            body={message.body}
                            senderLabel={senderLabel[side]}
                            sentAt={message.createdAt}
                            sentAtLabel={formatMessageTime({ iso: message.createdAt, locale })}
                            locale={locale}
                            delivery={message.delivery}
                            onRetry={onRetry ? () => onRetry({ id: message.id }) : undefined}
                        />
                    );
                })}
            </ol>
            {after}
        </div>
    );
}
