/**
 * @file ContactHost.client.tsx
 * @description React island for contacting the accommodation host.
 * Renders in three modes based on auth state and existing conversation:
 *   - Mode A: Anonymous visitor — full form (name, email, phone, message)
 *   - Mode B: Authenticated user without existing conversation — message-only form
 *   - Mode C: Authenticated user with existing conversation — link to existing thread
 *
 * Only renders when accommodation.lifecycleState === 'ACTIVE' && !accommodation.deletedAt.
 */

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { useEffect, useRef, useState } from 'react';
import styles from './ContactHost.module.css';

/**
 * Resolve the API base URL for client-side fetches. Astro injects
 * `PUBLIC_*` env vars into the client bundle. When unset (build-time
 * misconfiguration), the empty string makes fetches resolve relative to the
 * current origin — which is wrong, so we fail loudly via console for diagnosis.
 */
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Accommodation data required by the island */
interface ContactHostAccommodation {
    readonly id: string;
    readonly lifecycleState: string;
    readonly deletedAt: string | null | undefined;
}

/** Authenticated user data (optional — absent when anonymous) */
interface ContactHostUser {
    readonly id: string;
    readonly name?: string | null;
    readonly email?: string | null;
}

interface ContactHostProps {
    readonly accommodation: ContactHostAccommodation;
    readonly currentUser: ContactHostUser | null;
    readonly existingConversationId: string | null;
    readonly locale: SupportedLocale;
    /**
     * Optional pre-filled text for the message textarea. Used when the visitor
     * arrived from the hero search with dates/guests selected, so the message
     * starts with that context already typed.
     * Ignored in Mode C (existing conversation), since no form is rendered.
     */
    readonly initialMessage?: string;
}

type SubmitState =
    | { readonly phase: 'idle' }
    | { readonly phase: 'submitting' }
    | { readonly phase: 'success'; readonly message: string }
    | { readonly phase: 'duplicate' }
    | { readonly phase: 'error'; readonly message: string }
    | { readonly phase: 'fieldError'; readonly field: 'message'; readonly message: string }
    | { readonly phase: 'rateLimit'; readonly retryAfter: number };

const MAX_MESSAGE_LENGTH = 5000;

/**
 * ContactHost island — renders a contact form or link depending on auth state.
 */
export function ContactHost({
    accommodation,
    currentUser,
    existingConversationId,
    locale,
    initialMessage
}: ContactHostProps) {
    const { t } = createTranslations(locale);

    // Only render for active, non-deleted accommodations
    if (accommodation.lifecycleState !== 'ACTIVE' || accommodation.deletedAt) {
        return null;
    }

    // --- Mode C: authenticated user with an existing conversation ---
    if (currentUser && existingConversationId) {
        const threadUrl = buildUrl({
            locale,
            path: `mi-cuenta/consultas/${existingConversationId}`
        });
        return (
            <div className={styles.root}>
                <a
                    href={threadUrl}
                    className={styles.viewExistingLink}
                >
                    {t('conversations.form.viewExisting')}
                </a>
            </div>
        );
    }

    // --- Mode A or Mode B: show the contact form ---
    return (
        <ContactForm
            accommodation={accommodation}
            currentUser={currentUser}
            locale={locale}
            t={t}
            initialMessage={initialMessage}
        />
    );
}

// ---------------------------------------------------------------------------
// Internal form component
// ---------------------------------------------------------------------------

interface ContactFormProps {
    readonly accommodation: ContactHostAccommodation;
    readonly currentUser: ContactHostUser | null;
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
    readonly initialMessage?: string;
}

function ContactForm({ accommodation, currentUser, locale, t, initialMessage }: ContactFormProps) {
    const isAuthenticated = Boolean(currentUser);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState(initialMessage ?? '');
    const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' });
    const [requestAccessSent, setRequestAccessSent] = useState(false);

    const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [retryCountdown, setRetryCountdown] = useState(0);

    // Countdown tick for rate-limit state
    useEffect(() => {
        if (submitState.phase === 'rateLimit') {
            setRetryCountdown(submitState.retryAfter);
            retryTimerRef.current = setInterval(() => {
                setRetryCountdown((prev) => {
                    if (prev <= 1) {
                        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
                        setSubmitState({ phase: 'idle' });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        };
    }, [submitState]);

    const _remaining = MAX_MESSAGE_LENGTH - message.length;
    const isOverLimit = message.length > MAX_MESSAGE_LENGTH;
    const isRequiredEmpty = isAuthenticated
        ? message.trim().length === 0
        : name.trim().length === 0 || email.trim().length === 0 || message.trim().length === 0;
    const isSubmitDisabled =
        isOverLimit ||
        isRequiredEmpty ||
        submitState.phase === 'submitting' ||
        submitState.phase === 'rateLimit';

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isSubmitDisabled) return;

        setSubmitState({ phase: 'submitting' });
        trackEvent(WebEvents.BookingInitiated, {
            accommodation_id: accommodation.id,
            is_authenticated: isAuthenticated,
            locale
        });

        try {
            if (isAuthenticated) {
                // Mode B: protected endpoint
                const res = await fetch(`${API_BASE}/api/v1/protected/conversations/initiate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        accommodationId: accommodation.id,
                        message: message.trim()
                    })
                });

                if (res.status === 429) {
                    const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
                    setSubmitState({ phase: 'rateLimit', retryAfter });
                    return;
                }

                const body = (await res.json()) as {
                    data?: { conversationId?: string };
                    error?: { reason?: string };
                };

                if (!res.ok) {
                    setSubmitState({
                        phase: 'error',
                        message: t('conversations.errors.conversationNotFound')
                    });
                    return;
                }

                const conversationId = body.data?.conversationId;
                if (conversationId) {
                    window.location.href = buildUrl({
                        locale,
                        path: `mi-cuenta/consultas/${conversationId}`
                    });
                }
            } else {
                // Mode A: public endpoint
                const res = await fetch(`${API_BASE}/api/v1/public/conversations/initiate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accommodationId: accommodation.id,
                        guestName: name.trim(),
                        guestEmail: email.trim(),
                        guestPhone: phone.trim() || undefined,
                        message: message.trim()
                    })
                });

                if (res.status === 429) {
                    const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
                    setSubmitState({ phase: 'rateLimit', retryAfter });
                    return;
                }

                const body = (await res.json()) as {
                    data?: { status?: string };
                    error?: { reason?: string };
                };

                if (res.status === 409 && body.error?.reason === 'CONVERSATION_DUPLICATE') {
                    setSubmitState({ phase: 'duplicate' });
                    return;
                }

                if (res.status === 422) {
                    setSubmitState({
                        phase: 'fieldError',
                        field: 'message',
                        message: t('conversations.errors.messageContentBlocked')
                    });
                    return;
                }

                if (!res.ok) {
                    setSubmitState({
                        phase: 'error',
                        message: t('conversations.errors.conversationNotFound')
                    });
                    return;
                }

                setSubmitState({
                    phase: 'success',
                    message: t('conversations.notifications.verificationSent')
                });
            }
        } catch {
            setSubmitState({
                phase: 'error',
                message: t('conversations.errors.conversationNotFound')
            });
        }
    }

    async function handleRequestAccess() {
        const addr = isAuthenticated ? (currentUser?.email ?? email) : email;
        if (!addr) return;

        await fetch(`${API_BASE}/api/v1/public/conversations/request-access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: addr })
        });

        // Always show the same confirmation regardless of response (anti-enumeration)
        setRequestAccessSent(true);
    }

    const messageDescId = 'contact-host-message-desc';
    const messageErrorId = 'contact-host-message-error';

    return (
        <div className={styles.root}>
            {/* --- Success state --- */}
            {submitState.phase === 'success' && (
                <p
                    className={styles.successNotice}
                    aria-live="polite"
                >
                    {submitState.message}
                </p>
            )}

            {/* --- Rate limit state --- */}
            {submitState.phase === 'rateLimit' && (
                <p
                    className={styles.errorNotice}
                    role="alert"
                >
                    {t('conversations.errors.rateLimitExceeded')} ({retryCountdown}s)
                </p>
            )}

            {/* --- Duplicate state --- */}
            {submitState.phase === 'duplicate' && (
                <div
                    className={styles.duplicateNotice}
                    role="alert"
                >
                    <p>{t('conversations.errors.conversationDuplicate')}</p>
                    {requestAccessSent ? (
                        <p
                            aria-live="polite"
                            className={styles.requestAccessSent}
                        >
                            {t('conversations.form.requestAccessSent')}
                        </p>
                    ) : (
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleRequestAccess}
                        >
                            {t('conversations.actions.requestAccess')}
                        </button>
                    )}
                </div>
            )}

            {/* --- General error state --- */}
            {submitState.phase === 'error' && (
                <p
                    className={styles.errorNotice}
                    role="alert"
                >
                    {submitState.message}
                </p>
            )}

            {/* --- Form (hidden on terminal success) --- */}
            {submitState.phase !== 'success' && (
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className={styles.form}
                >
                    {/* Mode A fields: name, email, phone */}
                    {!isAuthenticated && (
                        <>
                            <div className={styles.field}>
                                <label
                                    htmlFor="contact-name"
                                    className={styles.label}
                                >
                                    {t('conversations.form.name')}
                                    <span
                                        aria-hidden="true"
                                        className={styles.required}
                                    >
                                        {' '}
                                        *
                                    </span>
                                </label>
                                <input
                                    id="contact-name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('conversations.form.namePlaceholder')}
                                    className={styles.input}
                                    autoComplete="name"
                                />
                            </div>

                            <div className={styles.field}>
                                <label
                                    htmlFor="contact-email"
                                    className={styles.label}
                                >
                                    {t('conversations.form.email')}
                                    <span
                                        aria-hidden="true"
                                        className={styles.required}
                                    >
                                        {' '}
                                        *
                                    </span>
                                </label>
                                <input
                                    id="contact-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('conversations.form.emailPlaceholder')}
                                    className={styles.input}
                                    autoComplete="email"
                                />
                            </div>

                            <div className={styles.field}>
                                <label
                                    htmlFor="contact-phone"
                                    className={styles.label}
                                >
                                    {t('conversations.form.phone')}
                                </label>
                                <input
                                    id="contact-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={t('conversations.form.phonePlaceholder')}
                                    className={styles.input}
                                    autoComplete="tel"
                                />
                            </div>
                        </>
                    )}

                    {/* Message field — always visible */}
                    <div className={styles.field}>
                        <label
                            htmlFor="contact-message"
                            className={styles.label}
                        >
                            {t('conversations.form.message')}
                            <span
                                aria-hidden="true"
                                className={styles.required}
                            >
                                {' '}
                                *
                            </span>
                        </label>
                        <textarea
                            id="contact-message"
                            required
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('conversations.form.messagePlaceholder')}
                            className={`${styles.textarea} ${isOverLimit ? styles.textareaError : ''} ${
                                submitState.phase === 'fieldError' ? styles.textareaError : ''
                            }`}
                            rows={5}
                            aria-describedby={`${messageDescId} ${
                                submitState.phase === 'fieldError' ? messageErrorId : ''
                            }`}
                        />
                        <span
                            id={messageDescId}
                            className={`${styles.charCount} ${isOverLimit ? styles.charCountOver : ''}`}
                            aria-live="polite"
                        >
                            {t('conversations.form.charCount', undefined, {
                                current: message.length,
                                max: MAX_MESSAGE_LENGTH
                            })}
                        </span>
                        {submitState.phase === 'fieldError' && submitState.field === 'message' && (
                            <p
                                id={messageErrorId}
                                className={styles.fieldError}
                                role="alert"
                            >
                                {submitState.message}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className={styles.submitButton}
                    >
                        {submitState.phase === 'submitting'
                            ? '...'
                            : t('conversations.form.submit')}
                    </button>
                </form>
            )}
        </div>
    );
}
