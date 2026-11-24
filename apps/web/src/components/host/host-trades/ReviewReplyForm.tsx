/**
 * @file ReviewReplyForm.tsx
 * @description The provider's right of reply (HOS-376 T-051, §6.4).
 *
 * Rendered INSIDE the review card it answers, not in a dialog. A reply is
 * written against a specific complaint, and a modal would cover the text the
 * provider is answering at the moment he has to answer it.
 *
 * The form serves both write paths, and the difference between them is the
 * whole reason the copy branches:
 *
 *  - ANSWERING creates a reply that is born PENDING. Unwarned, a provider sends
 *    one, does not find it in the directory, and concludes it was lost — the
 *    reaction §6.4 exists to prevent.
 *  - EDITING returns an already-moderated reply to PENDING and discards the
 *    previous decision (AC-23). For a published answer that means leaving the
 *    directory. A provider fixing a typo has to know that before he commits,
 *    not after.
 *
 * The length bounds are mirrored literals, matching the sibling
 * `ReviewFormDialog`: importing them would pull `@repo/schemas` — and Zod with
 * it — into a panel that ships neither today. `ReviewReplyForm.bounds.test.ts`
 * is the guard that keeps the mirror honest.
 */

import { useId, useState } from 'react';
import type { SavedReviewReply } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ProviderPanels.module.css';

/** Minimum reply length, mirroring `HOST_TRADE_REVIEW_REPLY_MIN`. */
const REPLY_MIN = 10;

/** Maximum reply length, mirroring `HOST_TRADE_REVIEW_REPLY_MAX`. */
const REPLY_MAX = 1000;

interface ReviewReplyFormProps {
    readonly locale: SupportedLocale;
    /** The review being answered. */
    readonly reviewId: string;
    /**
     * The reply already on the row, when there is one.
     *
     * Its presence is what decides between POST and PATCH — and between the two
     * warnings, since only an edit can pull a published answer down.
     */
    readonly existingReply: { readonly id: string; readonly content: string } | null;
    /** Hands the saved reply to the panel so the row can restate its state. */
    readonly onSaved: (reply: SavedReviewReply) => void;
    readonly onCancel: () => void;
}

/**
 * Renders the reply editor for one review.
 *
 * @param props - Locale, the review being answered, the existing reply if any,
 * and the panel's save/cancel callbacks.
 * @returns The form element.
 */
export function ReviewReplyForm({
    locale,
    reviewId,
    existingReply,
    onSaved,
    onCancel
}: ReviewReplyFormProps) {
    const { t } = createTranslations(locale);
    const fieldId = useId();

    const [content, setContent] = useState(existingReply?.content ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isEdit = existingReply !== null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(null);

        const trimmed = content.trim();
        if (trimmed.length < REPLY_MIN) {
            setErrorMessage(
                t(
                    'host-trades.provider.reviews.reply.errors.tooShort',
                    'Tu respuesta tiene que tener al menos {{min}} caracteres.',
                    { min: String(REPLY_MIN) }
                )
            );
            return;
        }

        setSubmitting(true);
        const result = isEdit
            ? await hostTradesApi.updateReply({
                  replyId: existingReply.id,
                  body: { content: trimmed }
              })
            : await hostTradesApi.replyToReview({ reviewId, body: { content: trimmed } });
        setSubmitting(false);

        if (!result.ok) {
            // The text stays in the field: a provider who just lost a written
            // answer to a transient failure has to write it twice.
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.provider.reviews.reply.errors.generic',
                        'No pudimos guardar tu respuesta. Probá de nuevo en un momento.'
                    )
                })
            );
            return;
        }

        onSaved(result.data.reply);
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
        >
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={fieldId}
                >
                    {t('host-trades.provider.reviews.reply.label', 'Tu respuesta')}
                </label>
                <textarea
                    className={styles.textarea}
                    disabled={submitting}
                    id={fieldId}
                    maxLength={REPLY_MAX}
                    onChange={(event) => setContent(event.target.value)}
                    rows={4}
                    value={content}
                />
                <p className={styles.hint}>
                    {t(
                        'host-trades.provider.reviews.reply.counter',
                        '{{count}}/{{max}} · mínimo {{min}} caracteres',
                        {
                            count: String(content.trim().length),
                            max: String(REPLY_MAX),
                            min: String(REPLY_MIN)
                        }
                    )}
                </p>
            </div>

            <p className={styles.hint}>
                {isEdit
                    ? t(
                          'host-trades.provider.reviews.reply.editNotice',
                          'Si la editás, tu respuesta vuelve a revisión y deja de verse en el directorio hasta que la aprobemos de nuevo.'
                      )
                    : t(
                          'host-trades.provider.reviews.reply.createNotice',
                          'La revisamos antes de publicarla, así que no aparece en el directorio enseguida.'
                      )}
            </p>

            {errorMessage ? (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {errorMessage}
                </p>
            ) : null}

            <div className={styles.actions}>
                <button
                    className={styles.secondaryAction}
                    disabled={submitting}
                    onClick={onCancel}
                    type="button"
                >
                    {t('host-trades.provider.reviews.reply.cancel', 'Cancelar')}
                </button>
                <button
                    className={styles.primaryAction}
                    disabled={submitting}
                    type="submit"
                >
                    {isEdit
                        ? t('host-trades.provider.reviews.reply.save', 'Guardar respuesta')
                        : t('host-trades.provider.reviews.reply.send', 'Enviar respuesta')}
                </button>
            </div>
        </form>
    );
}
