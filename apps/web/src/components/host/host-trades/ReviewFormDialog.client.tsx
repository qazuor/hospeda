/**
 * @file ReviewFormDialog.client.tsx
 * @description The host's review form for a provider (HOS-376 T-048, §8).
 *
 * Four shapes here are decisions, not styling:
 *
 *  - The stars are REAL radios with a textual label each. The directory's
 *    audience skews older and largely mobile, and a star widget that only
 *    answers a pointer and announces nothing is unusable for part of it.
 *    Native radios also give arrow-key navigation for free.
 *  - The benefit question has NO preselected answer. It is the single field the
 *    feature exists to capture — a provider is listed *because* of the benefit,
 *    so "excellent work, ignored the discount" is the failure this must expose —
 *    and a default collects the default instead of the answer.
 *  - The breakdown is a collapsed `<details>`. A host who only wants to leave
 *    stars must not be walked through three more decisions to do it.
 *  - An untouched breakdown is OMITTED from the body, not sent as an object of
 *    undefineds: the body schema is `.strict()`, and the aggregate reads a null
 *    breakdown differently from an empty one.
 *
 * Validation runs the shared Zod body schema through `safeParse` as the final
 * gate, but the three refusals a host can actually hit are checked first with
 * their own copy — the schema's messages are i18n KEYS for the API's own
 * translator, and surfacing `zodError.hostTradeReview.content.min` to a host
 * would be worse than no message.
 */

import { HostTradeReviewCreateBodySchema } from '@repo/schemas';
import { useEffect, useId, useRef, useState } from 'react';
import type { HostTradeReview, HostTradeReviewBreakdown } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ReviewFormDialog.module.css';

/** The 1-5 scale, as the radios render it. */
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/** Minimum length of the optional comment, mirroring the schema's floor. */
const CONTENT_MIN = 10;

/** Maximum length of the optional comment, mirroring the schema's ceiling. */
const CONTENT_MAX = 2000;

/** The three optional dimensions, in the order the spec lists them. */
const BREAKDOWN_DIMENSIONS = [
    { key: 'workQuality', fallback: 'Calidad del trabajo' },
    { key: 'punctuality', fallback: 'Puntualidad' },
    { key: 'treatment', fallback: 'Trato' }
] as const;

type BreakdownKey = (typeof BREAKDOWN_DIMENSIONS)[number]['key'];

interface ReviewFormDialogProps {
    readonly locale: SupportedLocale;
    /** The provider being reviewed. */
    readonly hostTradeId: string;
    /** Provider display name, for the heading and the confirmation copy. */
    readonly providerName: string;
    /** Called when the host dismisses the dialog without publishing. */
    readonly onClose: () => void;
    /** Called once the review is written, whatever moderation decided. */
    readonly onSaved: () => void;
}

/**
 * Renders the review dialog, then its confirmation.
 *
 * @param props - Locale, the provider, and the two lifecycle callbacks.
 * @returns The dialog element.
 */
export function ReviewFormDialog({
    locale,
    hostTradeId,
    providerName,
    onClose,
    onSaved
}: ReviewFormDialogProps) {
    const { t } = createTranslations(locale);

    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const overallGroupId = useId();
    const benefitGroupId = useId();
    const contentId = useId();
    const groupName = useId();

    const [overallRating, setOverallRating] = useState<number | null>(null);
    const [respectedBenefit, setRespectedBenefit] = useState<boolean | null>(null);
    const [breakdown, setBreakdown] = useState<HostTradeReviewBreakdown>({});
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [published, setPublished] = useState<'APPROVED' | 'PENDING' | null>(null);
    const [loading, setLoading] = useState(true);
    /** The review already on file, or null. Decides create vs edit. */
    const [existing, setExisting] = useState<HostTradeReview | null>(null);

    // Opened imperatively so the browser supplies the focus trap and Escape.
    // `showModal` is guarded because jsdom does not implement it, and an
    // unguarded call takes every test of this component down.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }, []);

    // Reads back whatever the host already wrote, which is what decides between
    // publishing and editing. A FAILED read falls through to the create form
    // rather than blocking: refusing to open would leave the host unable to say
    // anything at all, and if a review does exist the create call still answers
    // 409 REVIEW_ALREADY_EXISTS with its own copy.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await hostTradesApi.getMyReview({ hostTradeId });
            if (cancelled) return;

            const review = result.ok ? result.data.review : null;
            if (review) {
                setExisting(review);
                setOverallRating(review.overallRating);
                setRespectedBenefit(review.respectedBenefit);
                setBreakdown(review.rating ?? {});
                setContent(review.content ?? '');
            }
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [hostTradeId]);

    function setDimension(key: BreakdownKey, value: number) {
        setBreakdown((current) => ({ ...current, [key]: value }));
    }

    /**
     * Sends an edit as a DIFF — only the fields the host actually changed.
     *
     * This is the load-bearing half of edit mode. Changing the TEXT re-runs
     * moderation and can pull the review out of the directory until it is
     * approved again, so resending an untouched `content` would turn a
     * star-only edit into a rewrite, and could hand back as APPROVED a text a
     * moderator had already rejected.
     */
    async function saveEdit(input: {
        existing: HostTradeReview;
        overallRating: number;
        respectedBenefit: boolean;
        scored: Record<string, number>;
        trimmed: string;
    }) {
        const previousBreakdown = input.existing.rating ?? {};
        const patch: Record<string, unknown> = {};

        if (input.overallRating !== input.existing.overallRating) {
            patch.overallRating = input.overallRating;
        }
        if (input.respectedBenefit !== input.existing.respectedBenefit) {
            patch.respectedBenefit = input.respectedBenefit;
        }
        if (JSON.stringify(input.scored) !== JSON.stringify(previousBreakdown)) {
            patch.rating = Object.keys(input.scored).length > 0 ? input.scored : null;
        }
        if (input.trimmed !== (input.existing.content ?? '')) {
            // An emptied comment is a deletion, not an absence: `null` clears
            // the column, whereas omitting the key would leave the old text up.
            patch.content = input.trimmed.length > 0 ? input.trimmed : null;
        }

        if (Object.keys(patch).length === 0) {
            setErrorMessage(
                t('host-trades.review.errors.noChanges', 'No cambiaste nada de tu valoración.')
            );
            return;
        }

        setSubmitting(true);
        const result = await hostTradesApi.updateReview({
            reviewId: input.existing.id,
            body: patch
        });
        setSubmitting(false);

        if (!result.ok) {
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.review.errors.generic',
                        'No pudimos publicar tu valoración. Probá de nuevo en un momento.'
                    )
                })
            );
            return;
        }

        setPublished(result.data.review.moderationState === 'PENDING' ? 'PENDING' : 'APPROVED');
        onSaved();
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        setErrorMessage(null);

        if (overallRating === null) {
            setErrorMessage(
                t('host-trades.review.errors.ratingRequired', 'Elegí una puntuación general.')
            );
            return;
        }
        if (respectedBenefit === null) {
            setErrorMessage(
                t(
                    'host-trades.review.errors.benefitRequired',
                    'Contanos si el proveedor respetó el beneficio.'
                )
            );
            return;
        }

        const trimmed = content.trim();
        if (trimmed.length > 0 && trimmed.length < CONTENT_MIN) {
            setErrorMessage(
                t(
                    'host-trades.review.errors.contentTooShort',
                    'El comentario tiene que tener al menos {{min}} caracteres, o podés dejarlo vacío.',
                    { min: String(CONTENT_MIN) }
                )
            );
            return;
        }

        // Only the dimensions actually scored travel. An untouched breakdown is
        // absent from the body entirely.
        const scored = Object.fromEntries(
            Object.entries(breakdown).filter(([, value]) => typeof value === 'number')
        );

        if (existing) {
            await saveEdit({ existing, overallRating, respectedBenefit, scored, trimmed });
            return;
        }

        const body = {
            overallRating,
            respectedBenefit,
            ...(Object.keys(scored).length > 0 ? { rating: scored } : {}),
            ...(trimmed.length > 0 ? { content: trimmed } : {})
        };

        // The shared schema is the last gate, so this form can never publish a
        // shape the API would reject for a reason the checks above missed.
        const parsed = HostTradeReviewCreateBodySchema.safeParse(body);
        if (!parsed.success) {
            setErrorMessage(
                t(
                    'host-trades.review.errors.invalid',
                    'Revisá los datos de la valoración antes de publicarla.'
                )
            );
            return;
        }

        setSubmitting(true);
        const result = await hostTradesApi.createReview({ hostTradeId, body: parsed.data });
        setSubmitting(false);

        if (!result.ok) {
            // NO_CONFIRMED_USAGE, SELF_REVIEW_FORBIDDEN, REVIEW_ALREADY_EXISTS
            // and PROVIDER_REVOKED all carry localized copy under
            // `common.apiError.<CODE>`, so no branch per code is needed here.
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.review.errors.generic',
                        'No pudimos publicar tu valoración. Probá de nuevo en un momento.'
                    )
                })
            );
            return;
        }

        setPublished(result.data.review.moderationState === 'PENDING' ? 'PENDING' : 'APPROVED');
        onSaved();
    }

    return (
        <dialog
            aria-labelledby={titleId}
            className={styles.dialog}
            onCancel={onClose}
            onClose={onClose}
            ref={dialogRef}
        >
            <h2
                className={styles.title}
                id={titleId}
            >
                {existing
                    ? t('host-trades.review.editTitle', 'Editar tu valoración de {{name}}', {
                          name: providerName
                      })
                    : t('host-trades.review.title', 'Valorar a {{name}}', { name: providerName })}
            </h2>

            {loading ? (
                <p className={styles.successBody}>
                    {t('host-trades.review.loading', 'Buscando si ya lo valoraste…')}
                </p>
            ) : published ? (
                <div
                    className={styles.success}
                    role="status"
                >
                    <p className={styles.successBody}>
                        {published === 'PENDING'
                            ? t(
                                  'host-trades.review.success.pending',
                                  'Guardamos tu valoración y quedó en revisión. Se publica en el directorio cuando la aprueben.'
                              )
                            : t(
                                  'host-trades.review.success.published',
                                  'Listo, tu valoración ya está publicada en el directorio.'
                              )}
                    </p>
                    <button
                        className={styles.primaryAction}
                        onClick={onClose}
                        type="button"
                    >
                        {t('host-trades.review.success.close', 'Cerrar')}
                    </button>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {/* A plain <fieldset> + <legend>: with NATIVE radios inside,
                        that IS the radio group. `role="radiogroup"` on top adds
                        nothing a screen reader does not already get from the
                        markup, and puts an interactive role on a
                        non-interactive element. */}
                    <fieldset className={styles.starGroup}>
                        <legend
                            className={styles.legend}
                            id={overallGroupId}
                        >
                            {t('host-trades.review.overall.legend', 'Puntuación general')}
                        </legend>
                        {STAR_VALUES.map((value) => (
                            <label
                                className={styles.star}
                                key={value}
                            >
                                <input
                                    aria-label={t(
                                        value === 1
                                            ? 'host-trades.review.overall.one'
                                            : 'host-trades.review.overall.many',
                                        value === 1 ? '1 estrella' : '{{count}} estrellas',
                                        { count: String(value) }
                                    )}
                                    checked={overallRating === value}
                                    className={styles.starInput}
                                    name={`${groupName}-overall`}
                                    onChange={() => setOverallRating(value)}
                                    type="radio"
                                    value={value}
                                />
                                <span
                                    aria-hidden="true"
                                    className={styles.starGlyph}
                                >
                                    ★
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={styles.starValue}
                                >
                                    {value}
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    <fieldset className={styles.benefitGroup}>
                        <legend
                            className={styles.legend}
                            id={benefitGroupId}
                        >
                            {t(
                                'host-trades.review.benefit.legend',
                                '¿Te respetó el beneficio para anfitriones?'
                            )}
                        </legend>
                        <label className={styles.choice}>
                            <input
                                checked={respectedBenefit === true}
                                name={`${groupName}-benefit`}
                                onChange={() => setRespectedBenefit(true)}
                                type="radio"
                            />
                            {t('host-trades.review.benefit.yes', 'Sí')}
                        </label>
                        <label className={styles.choice}>
                            <input
                                checked={respectedBenefit === false}
                                name={`${groupName}-benefit`}
                                onChange={() => setRespectedBenefit(false)}
                                type="radio"
                            />
                            {t('host-trades.review.benefit.no', 'No')}
                        </label>
                    </fieldset>

                    <details className={styles.breakdown}>
                        <summary className={styles.breakdownSummary}>
                            {t(
                                'host-trades.review.breakdown.summary',
                                'Detalle por aspecto (opcional)'
                            )}
                        </summary>
                        {BREAKDOWN_DIMENSIONS.map((dimension) => {
                            const label = t(
                                `host-trades.review.breakdown.${dimension.key}`,
                                dimension.fallback
                            );
                            return (
                                <div
                                    className={styles.dimension}
                                    key={dimension.key}
                                >
                                    <span className={styles.dimensionLabel}>{label}</span>
                                    <div className={styles.starRow}>
                                        {STAR_VALUES.map((value) => (
                                            <label
                                                className={styles.star}
                                                key={value}
                                            >
                                                <input
                                                    aria-label={`${label}: ${value}`}
                                                    checked={breakdown[dimension.key] === value}
                                                    className={styles.starInput}
                                                    name={`${groupName}-${dimension.key}`}
                                                    onChange={() =>
                                                        setDimension(dimension.key, value)
                                                    }
                                                    type="radio"
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className={styles.starGlyph}
                                                >
                                                    ★
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </details>

                    <label
                        className={styles.contentLabel}
                        htmlFor={contentId}
                    >
                        {t('host-trades.review.content.label', 'Comentario (opcional)')}
                    </label>
                    <textarea
                        className={styles.textarea}
                        id={contentId}
                        maxLength={CONTENT_MAX}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder={t(
                            'host-trades.review.content.placeholder',
                            'Contá cómo fue el trabajo. Lo van a leer otros anfitriones.'
                        )}
                        rows={4}
                        value={content}
                    />

                    {errorMessage ? (
                        <p
                            className={cn(styles.error)}
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    ) : null}

                    <div className={styles.actions}>
                        <button
                            className={styles.secondaryAction}
                            onClick={onClose}
                            type="button"
                        >
                            {t('host-trades.review.cancel', 'Cancelar')}
                        </button>
                        <button
                            className={styles.primaryAction}
                            disabled={submitting}
                            type="submit"
                        >
                            {submitting
                                ? t('host-trades.review.submitting', 'Publicando…')
                                : existing
                                  ? t('host-trades.review.save', 'Guardar cambios')
                                  : t('host-trades.review.submit', 'Publicar valoración')}
                        </button>
                    </div>
                </form>
            )}
        </dialog>
    );
}
