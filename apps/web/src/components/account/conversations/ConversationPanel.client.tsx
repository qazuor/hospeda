/**
 * @file ConversationPanel.client.tsx
 * @description One conversation on the account kit, for BOTH inboxes
 * (HOS-2481 guest, HOS-2482 owner): the kit `ConversationThread` with the
 * viewer as a parameter, and the kit `Composer` when the conversation admits a
 * reply.
 *
 * Replying is optimistic and never reloads the page (HOS-2439): the message is
 * appended at once as `sending`, confirmed when the API answers, or marked
 * `failed` with a retry and the reason shown above the composer. The page
 * hands in the first page of messages it already read on the server.
 *
 * The thread lives in a `Section`; the composer sits AFTER it, outside the
 * box, so it can stick to the bottom of the viewport (a Section clips its
 * overflow, which would keep a sticky child from sticking).
 */

import { type ReactNode, useRef, useState } from 'react';
import {
    Composer,
    ConversationThread,
    formatMessageTime,
    Section,
    TextLink,
    type ThreadMessage,
    type ThreadViewer
} from '@/components/account/ui';
import {
    type ConversationMessageItem,
    ownerConversationsApi,
    protectedConversationsApi
} from '@/lib/api/endpoints-protected';
import type { ApiError, ApiResult } from '@/lib/api/types';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './ConversationPanel.module.css';

/** Props of {@link ConversationPanel}. */
export interface ConversationPanelProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Who is looking at the thread. */
    readonly viewer: ThreadViewer;
    /** The conversation id. */
    readonly conversationId: string;
    /** First page of messages, oldest first, as the page read them. */
    readonly initialMessages: readonly ConversationMessageItem[];
    /** Whether the composer is shown (open conversation, listing available). */
    readonly canReply: boolean;
    /** Link to the previous page of messages, when there is one. */
    readonly olderHref?: string;
    /** ISO instant the other party read the thread (guest view only). */
    readonly readAt?: string;
    /**
     * What stands where the composer would be when there is no reply: the
     * page's `ListingGoneNotice` or the closed notice (static Astro children).
     */
    readonly children?: ReactNode;
}

/** Help anchor of each thread section. */
const THREAD_HELP_ID = {
    guest: 'section:messages.thread',
    owner: 'section:messages.owner-thread'
} as const;

/**
 * Translates a failed send into the reason shown above the composer.
 *
 * @param input - Options object.
 * @param input.error - The API error.
 * @param input.locale - App locale.
 * @returns The translated reason.
 */
export function sendErrorMessage({
    error,
    locale
}: {
    readonly error: ApiError;
    readonly locale: SupportedLocale;
}): string {
    const t = createT(locale);
    if (error.status === 429) return t('conversations.errors.rateLimitExceeded');
    if (error.reason === 'MESSAGE_CONTENT_BLOCKED')
        return t('conversations.errors.messageContentBlocked');
    if (error.reason === 'CONVERSATION_BLOCKED')
        return t('conversations.errors.conversationBlocked');
    if (error.status === 404) return t('conversations.errors.conversationNotFound');
    return t('conversations.errors.messageSendFailed');
}

/**
 * The thread and its composer, with optimistic sending.
 *
 * @param props - See {@link ConversationPanelProps}.
 * @returns The conversation island.
 */
export function ConversationPanel({
    locale,
    viewer,
    conversationId,
    initialMessages,
    canReply,
    olderHref,
    readAt,
    children
}: ConversationPanelProps) {
    const t = createT(locale);
    const [messages, setMessages] = useState<readonly ThreadMessage[]>(initialMessages);
    const [error, setError] = useState<string | undefined>(undefined);
    const [sentHere, setSentHere] = useState(false);
    const nextLocalId = useRef(0);

    const patch = (id: string, next: (message: ThreadMessage) => ThreadMessage) =>
        setMessages((current) => current.map((m) => (m.id === id ? next(m) : m)));

    const deliver = async ({ id, body }: { readonly id: string; readonly body: string }) => {
        const result: ApiResult<ConversationMessageItem> =
            viewer === 'guest'
                ? await protectedConversationsApi.sendMessage({ id: conversationId, body })
                : await ownerConversationsApi.reply({ id: conversationId, message: body });
        if (result.ok) {
            const saved = result.data;
            patch(id, (m) => ({
                id: typeof saved?.id === 'string' ? saved.id : m.id,
                body: m.body,
                senderType: viewer,
                createdAt: typeof saved?.createdAt === 'string' ? saved.createdAt : m.createdAt
            }));
            setError(undefined);
            return;
        }
        patch(id, (m) => ({ ...m, delivery: 'failed' }));
        setError(sendErrorMessage({ error: result.error, locale }));
    };

    const handleSend = ({ body }: { readonly body: string }) => {
        nextLocalId.current += 1;
        const id = `local-${nextLocalId.current}`;
        setSentHere(true);
        setMessages((current) => [
            ...current,
            {
                id,
                body,
                senderType: viewer,
                createdAt: new Date().toISOString(),
                delivery: 'sending'
            }
        ]);
        void deliver({ id, body });
    };

    const handleRetry = ({ id }: { readonly id: string }) => {
        const message = messages.find((m) => m.id === id);
        if (!message) return;
        patch(id, (m) => ({ ...m, delivery: 'sending' }));
        void deliver({ id, body: message.body });
    };

    // A read receipt describes the thread as the page loaded it; once the
    // viewer writes again it no longer covers the newest message.
    const showReadReceipt = readAt !== undefined && !sentHere;

    return (
        <div className={styles.panel}>
            <Section
                title={t('conversations.thread.sectionTitle')}
                helpId={THREAD_HELP_ID[viewer]}
            >
                <ConversationThread
                    viewer={viewer}
                    messages={messages}
                    locale={locale}
                    onRetry={handleRetry}
                    before={
                        olderHref ? (
                            <p className={styles.older}>
                                <TextLink href={olderHref}>
                                    {t('conversations.thread.older')}
                                </TextLink>
                            </p>
                        ) : undefined
                    }
                    after={
                        showReadReceipt ? (
                            <p className={styles.receipt}>
                                {t('conversations.thread.readByOwner')}{' '}
                                <time dateTime={readAt}>
                                    {formatMessageTime({ iso: readAt, locale })}
                                </time>
                            </p>
                        ) : undefined
                    }
                />
                {children}
            </Section>
            {canReply && (
                <Composer
                    locale={locale}
                    onSend={handleSend}
                    placeholder={t('conversations.thread.replyPlaceholder')}
                    error={error}
                />
            )}
        </div>
    );
}
