/**
 * @file ConversationReply.client.tsx
 * @description React island for the reply form in authenticated and guest conversation threads.
 * Supports both protected (authenticated) and public (anonymous token-based) endpoints.
 */

import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import styles from './ConversationReply.module.css';

/** Mode A: authenticated user replying via protected endpoint */
interface AuthReplyProps {
    readonly mode: 'auth';
    readonly conversationId: string;
}

/** Mode B: anonymous guest replying via token endpoint */
interface GuestReplyProps {
    readonly mode: 'guest';
    readonly token: string;
}

type ConversationReplyProps = (AuthReplyProps | GuestReplyProps) & {
    readonly locale: SupportedLocale;
    readonly onMessageSent?: () => void;
    /**
     * Optional override for the reply endpoint URL.
     * When provided, this URL is used instead of the default constructed URL.
     * Useful for owner-side replies that need a different endpoint path.
     */
    readonly replyUrl?: string;
};

const MAX_MESSAGE_LENGTH = 5000;

/**
 * Reply form island for conversation threads.
 */
export function ConversationReply(props: ConversationReplyProps) {
    const { locale, onMessageSent } = props;
    const { t } = createTranslations(locale);

    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const _remaining = MAX_MESSAGE_LENGTH - body.length;
    const isOverLimit = body.length > MAX_MESSAGE_LENGTH;
    const isDisabled = sending || isOverLimit || body.trim().length === 0;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isDisabled) return;

        setSending(true);
        setError(null);

        try {
            // The web (4321) and API (3001) live on different origins in
            // dev, so the request must hit the API base — relative URLs
            // would hit the Astro server instead and return 404.
            const apiBase = getApiUrl().replace(/\/$/, '');
            const url = props.replyUrl
                ? props.replyUrl
                : props.mode === 'auth'
                  ? `${apiBase}/api/v1/protected/conversations/${props.conversationId}/messages`
                  : `${apiBase}/api/v1/public/conversations/guest/${props.token}/messages`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ body: body.trim() })
            });

            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After') ?? '60';
                setError(`${t('conversations.errors.rateLimitExceeded')} (${retryAfter}s)`);
                return;
            }

            const data = (await res.json()) as { error?: { reason?: string } };

            if (!res.ok) {
                if (data.error?.reason === 'MESSAGE_CONTENT_BLOCKED') {
                    setError(t('conversations.errors.messageContentBlocked'));
                } else if (data.error?.reason === 'CONVERSATION_BLOCKED') {
                    setError(t('conversations.errors.conversationBlocked'));
                } else if (res.status === 404) {
                    setError(t('conversations.errors.conversationNotFound'));
                } else {
                    setError(t('conversations.errors.messageSendFailed'));
                }
                return;
            }

            setBody('');
            setSuccess(true);
            onMessageSent?.();
            // The thread is SSR-rendered, so the new message only shows on
            // reload. Let the success state render briefly, then refresh so
            // the user sees their reply in context.
            setTimeout(() => {
                if (typeof window !== 'undefined') window.location.reload();
            }, 600);
        } catch {
            setError(t('conversations.errors.messageSendFailed'));
        } finally {
            setSending(false);
        }
    }

    const textareaDescId = 'reply-textarea-desc';
    const errorId = 'reply-error';

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className={styles.form}
        >
            {error && (
                <p
                    id={errorId}
                    className={styles.error}
                    role="alert"
                >
                    {error}
                </p>
            )}
            {success && (
                <p
                    className={styles.success}
                    aria-live="polite"
                >
                    {t('conversations.notifications.messageSent')}
                </p>
            )}
            <div className={styles.field}>
                <label
                    htmlFor="reply-body"
                    className={styles.srOnly}
                >
                    {t('conversations.form.message')}
                </label>
                <textarea
                    id="reply-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={t('conversations.thread.replyPlaceholder')}
                    className={`${styles.textarea} ${isOverLimit ? styles.textareaError : ''}`}
                    rows={3}
                    aria-describedby={`${textareaDescId} ${error ? errorId : ''}`}
                />
                <span
                    id={textareaDescId}
                    className={`${styles.charCount} ${isOverLimit ? styles.charCountOver : ''}`}
                    aria-live="polite"
                >
                    {t('conversations.form.charCount', undefined, {
                        current: body.length,
                        max: MAX_MESSAGE_LENGTH
                    })}
                </span>
            </div>
            <button
                type="submit"
                disabled={isDisabled}
                className={styles.submitButton}
            >
                {sending ? '...' : t('conversations.thread.send')}
            </button>
        </form>
    );
}
