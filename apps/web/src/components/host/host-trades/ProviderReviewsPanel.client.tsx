/**
 * @file ProviderReviewsPanel.client.tsx
 * @description The provider's "Valoraciones" tab (HOS-376 T-050, §8).
 *
 * What a provider reads about his own listing: every published review, and his
 * own answer WITH ITS MODERATION STATE.
 *
 * That state is the reason this panel does not reuse the directory listing. A
 * reply is born PENDING (§6.4 — it is written by someone with a wounded
 * commercial interest who has been inside the host's home, so it is the doxxing
 * vector the review itself is not), and the directory hides an unapproved one.
 * Shown that way to its own author, a reply he wrote yesterday simply is not
 * there — which reads as "it was lost", the exact reaction the spec says to
 * avoid. Here it reads "in review", and a rejected one carries its reason.
 *
 * The reply FORM is {@link ReviewReplyForm} (T-051), opened one row at a time.
 * This panel owns where each answer stands, and restates it after every write.
 */

import { useState } from 'react';
import type {
    OwnerReviewReply,
    OwnerReviewRow,
    SavedReviewReply
} from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { mergeSavedReply } from './merge-saved-reply';
import styles from './ProviderPanels.module.css';
import { ReviewReplyForm } from './ReviewReplyForm';

/** Badge class per reply moderation state. */
const REPLY_BADGE: Readonly<Record<string, string>> = {
    PENDING: 'badgePending',
    APPROVED: 'badgeConfirmed',
    REJECTED: 'badgeRejected'
};

/** Fallback copy per reply state, so an untranslated key never surfaces raw. */
const REPLY_FALLBACK: Readonly<Record<string, string>> = {
    PENDING: 'En revisión',
    APPROVED: 'Publicada',
    REJECTED: 'Rechazada'
};

interface ProviderReviewsPanelProps {
    readonly locale: SupportedLocale;
    /** The reviews of this listing, as the page read them. */
    readonly initialReviews: readonly OwnerReviewRow[];
    readonly initialTotal: number;
}

/**
 * Renders the reviews written about the caller's listing.
 *
 * @param props - Locale and the server-read page.
 * @returns The panel element.
 */
export function ProviderReviewsPanel({
    locale,
    initialReviews,
    initialTotal
}: ProviderReviewsPanelProps) {
    const { t } = createTranslations(locale);

    // Seeded from the server read, so the SSR output already carries every
    // reply and its state — hydration only makes them editable.
    const [replyByReviewId, setReplyByReviewId] = useState<
        Readonly<Record<string, OwnerReviewReply | null>>
    >(() => Object.fromEntries(initialReviews.map((row) => [row.review.id, row.reply])));

    /** The one row whose form is open — one at a time, never a page of editors. */
    const [openReviewId, setOpenReviewId] = useState<string | null>(null);

    /** Folds a saved reply back into its row and closes the editor. */
    function handleSaved(reviewId: string, saved: SavedReviewReply) {
        setReplyByReviewId((previous) =>
            mergeSavedReply({ replyByReviewId: previous, reviewId, saved })
        );
        setOpenReviewId(null);
    }

    if (initialReviews.length === 0) {
        return (
            <p className={styles.empty}>
                {t(
                    'host-trades.provider.reviews.empty',
                    'Todavía no hay valoraciones sobre tu ficha. Aparecen cuando un anfitrión con un uso confirmado te valora.'
                )}
            </p>
        );
    }

    return (
        <div className={styles.panel}>
            <h3 className={styles.sectionTitle}>
                {t('host-trades.provider.reviews.title', 'Valoraciones')}
                {initialTotal > 0 ? ` (${initialTotal})` : ''}
            </h3>

            <ul className={styles.list}>
                {initialReviews.map(({ review, author }) => {
                    const reply = replyByReviewId[review.id] ?? null;
                    const isOpen = openReviewId === review.id;

                    return (
                        <li
                            className={styles.reviewCard}
                            key={review.id}
                        >
                            <div className={styles.rowHeader}>
                                <p className={styles.rowTitle}>
                                    {author?.displayName ??
                                        t('host-trades.provider.reviews.anonymous', 'Un anfitrión')}
                                </p>
                                <span
                                    className={styles.stars}
                                    aria-hidden="true"
                                >
                                    {'★'.repeat(review.overallRating)}
                                    {'☆'.repeat(5 - review.overallRating)}
                                </span>
                                <span className={styles.srOnly}>
                                    {t(
                                        'host-trades.provider.reviews.rating',
                                        '{{count}} de 5 estrellas',
                                        { count: String(review.overallRating) }
                                    )}
                                </span>
                            </div>

                            <p className={styles.rowMeta}>
                                {formatDate({ date: review.createdAt, locale })}
                                {' · '}
                                {review.respectedBenefit
                                    ? t(
                                          'host-trades.provider.reviews.benefitYes',
                                          'Dice que respetaste el beneficio'
                                      )
                                    : t(
                                          'host-trades.provider.reviews.benefitNo',
                                          'Dice que NO respetaste el beneficio'
                                      )}
                            </p>

                            {review.content ? (
                                <p className={styles.rowBody}>{review.content}</p>
                            ) : null}

                            {reply ? (
                                <div className={styles.replyBlock}>
                                    <div className={styles.rowHeader}>
                                        <p className={styles.replyLabel}>
                                            {t(
                                                'host-trades.provider.reviews.yourReply',
                                                'Tu respuesta'
                                            )}
                                        </p>
                                        <span
                                            className={cn(
                                                styles.badge,
                                                styles[
                                                    REPLY_BADGE[reply.moderationState] ??
                                                        'badgeExpired'
                                                ]
                                            )}
                                        >
                                            {t(
                                                `host-trades.provider.reviews.replyState.${reply.moderationState}`,
                                                REPLY_FALLBACK[reply.moderationState] ??
                                                    reply.moderationState
                                            )}
                                        </span>
                                    </div>
                                    <p className={styles.rowBody}>{reply.content}</p>

                                    {reply.moderationState === 'PENDING' ? (
                                        <p className={styles.rowMeta}>
                                            {t(
                                                'host-trades.provider.reviews.pendingHelp',
                                                'La revisamos antes de publicarla. Todavía no se ve en el directorio.'
                                            )}
                                        </p>
                                    ) : null}

                                    {reply.moderationState === 'REJECTED' &&
                                    reply.moderationReason ? (
                                        <p className={styles.rowMeta}>
                                            {t(
                                                'host-trades.provider.reviews.rejectedReason',
                                                'Motivo: {{reason}}',
                                                { reason: reply.moderationReason }
                                            )}
                                        </p>
                                    ) : null}

                                    {reply.reviewEditedAfterReply ? (
                                        <p className={styles.rowMeta}>
                                            {t(
                                                'host-trades.provider.reviews.editedAfterReply',
                                                'El anfitrión editó su valoración después de tu respuesta.'
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <p className={styles.rowMeta}>
                                    {t(
                                        'host-trades.provider.reviews.noReply',
                                        'Todavía no respondiste esta valoración.'
                                    )}
                                </p>
                            )}

                            {isOpen ? (
                                <ReviewReplyForm
                                    existingReply={
                                        reply ? { id: reply.id, content: reply.content } : null
                                    }
                                    locale={locale}
                                    onCancel={() => setOpenReviewId(null)}
                                    onSaved={(saved) => handleSaved(review.id, saved)}
                                    reviewId={review.id}
                                />
                            ) : (
                                <button
                                    className={styles.secondaryAction}
                                    onClick={() => setOpenReviewId(review.id)}
                                    type="button"
                                >
                                    {reply
                                        ? t(
                                              'host-trades.provider.reviews.reply.edit',
                                              'Editar tu respuesta'
                                          )
                                        : t('host-trades.provider.reviews.reply.open', 'Responder')}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
