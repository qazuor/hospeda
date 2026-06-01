/**
 * @file CommentThreadIsland.client.tsx
 * @description Combined comment thread React island: renders the list of
 * APPROVED comments and the submit form (or a guest login CTA) in a single
 * component so that optimistic prepend after a successful submit is trivial
 * (shared local state, no cross-island messaging needed).
 *
 * Hydration directive: client:visible (lazy, below the fold).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useState } from 'react';
import styles from './CommentThreadIsland.module.css';

// API base URL — must be absolute: the web (host A) and API (host B) live on
// different origins in dev (port 4321 vs 3001) and in production.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Maximum allowed comment length (mirrors COMMENT_CONTENT_MAX_LENGTH from @repo/schemas). */
const COMMENT_CONTENT_MAX_LENGTH = 2000;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single approved comment as passed from the SSR container.
 * `createdAt` is an ISO string because Date objects do not survive JSON
 * serialization across the SSR/island boundary.
 */
export interface CommentItem {
    readonly id: string;
    readonly authorName: string;
    readonly content: string;
    /** ISO 8601 string — format it inside the island, never on the server. */
    readonly createdAt: string;
}

/**
 * Props for the CommentThreadIsland.
 * entityType / entityId are used to call the correct POST endpoint.
 * Only 'POST' is wired for T-014; 'EVENT' is ready for T-015.
 */
export interface CommentThreadIslandProps {
    /** Determines which protected POST endpoint to call. */
    readonly entityType: 'POST' | 'EVENT';
    /** UUID of the post or event. */
    readonly entityId: string;
    /** Initial list of approved comments loaded SSR-side (oldest-first). */
    readonly initialComments: readonly CommentItem[];
    /** Active UI locale for i18n. */
    readonly locale: SupportedLocale;
    /** Whether the requesting user has an active session. Passed from SSR — islands cannot read Astro.locals. */
    readonly isAuthenticated: boolean;
    /** Full sign-in URL with returnUrl already appended (built server-side). */
    readonly signinUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format an ISO date string to a locale-aware short date.
 * Safe to call during React render (no window dependency).
 */
function formatDate(iso: string, locale: SupportedLocale): string {
    try {
        return new Date(iso).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return iso;
    }
}

/**
 * Build the POST URL for the comment create endpoint based on entity type.
 * Supports POST and EVENT; extend here for T-015.
 */
function buildCreateUrl(entityType: 'POST' | 'EVENT', entityId: string): string {
    const segment = entityType === 'EVENT' ? 'events' : 'posts';
    return `${API_BASE}/api/v1/protected/${segment}/${entityId}/comments`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CommentThreadIsland — list + form in one island.
 *
 * Design rationale: housing the list and form in a single island makes
 * optimistic prepend trivial: the new comment is added to `comments` state
 * immediately on success without cross-island event buses or callbacks.
 *
 * AC-27: renders APPROVED comments oldest-first.
 * AC-28: shows a dedicated rate-limit message on 429; preserves input.
 * AC-29: authenticated users see the submit form; guests see a login CTA.
 * Empty state: rendered when `comments.length === 0`.
 */
export function CommentThreadIsland({
    entityType,
    entityId,
    initialComments,
    locale,
    isAuthenticated,
    signinUrl
}: CommentThreadIslandProps) {
    const { t } = createTranslations(locale);

    // AC-27: list state (starts with SSR-seeded comments; new ones are appended)
    const [comments, setComments] = useState<readonly CommentItem[]>(initialComments);

    // Form state
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const charCount = content.length;
    const isOverLimit = charCount > COMMENT_CONTENT_MAX_LENGTH;
    const canSubmit = !isSubmitting && !isOverLimit && content.trim().length > 0;

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const url = buildCreateUrl(entityType, entityId);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: content.trim() })
            });

            // AC-28: check 429 BEFORE res.ok; read Retry-After; preserve input
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                const baseMsg = t(
                    'comments.form.errorRateLimit',
                    'Demasiados comentarios, esperá un momento.'
                );
                setErrorMsg(retryAfter ? `${baseMsg} (${retryAfter}s)` : baseMsg);
                return;
            }

            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                throw new Error(
                    body.error?.message ??
                        t(
                            'comments.form.errorNetwork',
                            'No se pudo enviar tu comentario. Intentá de nuevo.'
                        )
                );
            }

            const created = (await res.json()) as {
                data?: {
                    id?: string;
                    content?: string;
                    createdAt?: string;
                    author?: { displayName?: string | null };
                };
                id?: string;
                content?: string;
                createdAt?: string;
                author?: { displayName?: string | null };
            };

            // Unwrap envelope if present (API may wrap in { data: ... })
            const item = 'data' in created && created.data ? created.data : created;

            // Optimistic append: prepend is wrong — oldest-first means new ones go at the end
            const newComment: CommentItem = {
                id: item.id ?? String(Date.now()),
                authorName: item.author?.displayName ?? '',
                content: item.content ?? content.trim(),
                createdAt: item.createdAt ?? new Date().toISOString()
            };
            setComments((prev) => [...prev, newComment]);
            setContent('');
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'comments.form.errorNetwork',
                          'No se pudo enviar tu comentario. Intentá de nuevo.'
                      );
            setErrorMsg(msg);
            // Input is NOT cleared on error — AC-28 requirement
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section
            className={styles.thread}
            aria-label={t('comments.thread.header', 'Comentarios')}
        >
            {/* Section header */}
            <h2 className={styles.header}>
                {t('comments.thread.header', 'Comentarios')}
                {comments.length > 0 && <span className={styles.count}>{comments.length}</span>}
            </h2>

            {/* Comment list */}
            {comments.length === 0 ? (
                <p className={styles.empty}>
                    {t('comments.thread.empty', 'Sé el primero en comentar')}
                </p>
            ) : (
                <ol className={styles.list}>
                    {comments.map((comment) => (
                        <li
                            key={comment.id}
                            className={styles.item}
                        >
                            <div className={styles.itemMeta}>
                                <span className={styles.author}>{comment.authorName}</span>
                                <time
                                    className={styles.date}
                                    dateTime={comment.createdAt}
                                >
                                    {formatDate(comment.createdAt, locale)}
                                </time>
                            </div>
                            <p className={styles.content}>{comment.content}</p>
                        </li>
                    ))}
                </ol>
            )}

            {/* Divider before the form / CTA */}
            <div
                className={styles.divider}
                aria-hidden="true"
            />

            {/* AC-29: authenticated → form; guest → login CTA */}
            {isAuthenticated ? (
                <form
                    className={styles.form}
                    onSubmit={(e) => void handleSubmit(e)}
                    noValidate
                    aria-label={t('comments.form.placeholder', 'Escribí tu comentario...')}
                >
                    <label
                        className={styles.srOnly}
                        htmlFor="comment-input"
                    >
                        {t('comments.form.placeholder', 'Escribí tu comentario...')}
                    </label>
                    <textarea
                        id="comment-input"
                        className={`${styles.textarea}${isOverLimit ? ` ${styles.textareaError}` : ''}`}
                        value={content}
                        onChange={(e) => {
                            setContent(e.currentTarget.value);
                            setErrorMsg(null);
                        }}
                        placeholder={t('comments.form.placeholder', 'Escribí tu comentario...')}
                        maxLength={COMMENT_CONTENT_MAX_LENGTH}
                        aria-describedby={errorMsg ? 'comment-error' : 'comment-char-count'}
                        aria-invalid={isOverLimit}
                        rows={4}
                        disabled={isSubmitting}
                    />

                    {/* Char counter */}
                    <p
                        id="comment-char-count"
                        className={`${styles.charCount}${isOverLimit ? ` ${styles.charCountError}` : ''}`}
                        aria-live="polite"
                    >
                        {t('comments.form.charCount', '{{count}}/{{max}}')
                            .replace('{{count}}', String(charCount))
                            .replace('{{max}}', String(COMMENT_CONTENT_MAX_LENGTH))}
                    </p>

                    {/* Inline error (rate-limit or network) */}
                    {errorMsg && (
                        <p
                            id="comment-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {errorMsg}
                        </p>
                    )}

                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={!canSubmit}
                        aria-busy={isSubmitting}
                    >
                        {isSubmitting
                            ? t('comments.form.submitting', 'Enviando...')
                            : t('comments.form.submit', 'Comentar')}
                    </button>
                </form>
            ) : (
                <p className={styles.loginCta}>
                    <a
                        href={signinUrl}
                        className={styles.loginLink}
                    >
                        {t('comments.form.errorAuthCta', 'Iniciá sesión para comentar')}
                    </a>
                </p>
            )}
        </section>
    );
}
