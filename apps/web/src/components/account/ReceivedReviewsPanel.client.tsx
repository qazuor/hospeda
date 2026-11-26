/**
 * @file ReceivedReviewsPanel.client.tsx
 * @description React island of `/mi-cuenta/resenas-recibidas/` (HOS-2199): the
 * reviews received on the host's accommodations, with the filter «Sin responder»
 * and the controls to answer them.
 *
 * Fetches `GET /api/v1/protected/users/me/received-reviews`. A review holds ONE
 * reply: write it, edit it (it is marked «editada» and passes the content
 * filter again) or delete it (and answer again). The reply publishes at once;
 * when the filter held it (PENDING) or an admin hid it (REJECTED) the host sees
 * a notice, because the public page does not show it.
 *
 * The plan gate is `canRespond`: without the `respond_reviews` entitlement the
 * reply controls are replaced by an upsell. The write routes enforce it too.
 *
 * Hydration: caller must use `client:load`.
 */

import { StarIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    AsyncRegion,
    type AsyncResult,
    Avatar,
    Button,
    DataList,
    EmptyState,
    ErrorState,
    FilterChips,
    LinkButton,
    Pagination,
    RatingStars,
    Section,
    Skeleton,
    Textarea,
    useConfirm
} from '@/components/account/ui';
import type { ReceivedReviewsPage } from '@/lib/api/endpoints-protected-review-replies';
import { reviewRepliesApi } from '@/lib/api/endpoints-protected-review-replies';
import type { SupportedLocale } from '@/lib/i18n';
import { createT, createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './ReceivedReviewsPanel.module.css';

const PAGE_SIZE = 10;
/** Mirrors `ACCOMMODATION_REVIEW_REPLY_MAX` (@repo/schemas); declared locally so the island does not pull the schemas barrel. The API enforces it. */
const ACCOMMODATION_REVIEW_REPLY_MAX = 1000;
const HELP_ID = 'section:reviews.received' as const;

type Filter = 'all' | 'unanswered';
type ReviewItem = ReceivedReviewsPage['items'][number];
type Reply = NonNullable<ReviewItem['reply']>;

interface ReceivedReviewsPanelProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
}

/** Maps a failed reply write to the translated message the host reads. */
function replyErrorKey({
    status,
    code
}: {
    readonly status: number;
    readonly code?: string;
}): string {
    if (code === 'ENTITLEMENT_REQUIRED') return 'account.receivedReviews.errors.noEntitlement';
    if (code === 'ALREADY_EXISTS') return 'account.receivedReviews.errors.alreadyReplied';
    if (status === 404) return 'account.receivedReviews.errors.notFound';
    return 'account.receivedReviews.errors.generic';
}

function formatDate(iso: string | Date, locale: SupportedLocale): string {
    const map: Record<SupportedLocale, string> = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };
    return new Date(iso).toLocaleDateString(map[locale], {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/** Received reviews of the host, with the reply controls. */
export function ReceivedReviewsPanel({ locale }: ReceivedReviewsPanelProps) {
    const t = createT(locale);
    const { tPlural } = createTranslations(locale);
    const [filter, setFilter] = useState<Filter>('all');
    const [page, setPage] = useState(1);
    const [state, setState] = useState<AsyncResult<ReceivedReviewsPage>>({ status: 'loading' });

    const load = useCallback(async () => {
        setState({ status: 'loading' });
        const result = await reviewRepliesApi.listReceived({
            page,
            pageSize: PAGE_SIZE,
            unanswered: filter === 'unanswered'
        });
        if (!result.ok) {
            setState({ status: 'error', retry: () => void load() });
            return;
        }
        setState(
            result.data.items.length === 0
                ? { status: 'empty' }
                : { status: 'ready', data: result.data }
        );
    }, [filter, page]);

    useEffect(() => {
        void load();
    }, [load]);

    /** Replaces one review's reply in place, without refetching the page. */
    const setReply = useCallback((input: { reviewId: string; reply: Reply | null }) => {
        setState((current) =>
            current.status === 'ready'
                ? {
                      status: 'ready',
                      data: {
                          ...current.data,
                          items: current.data.items.map((item) =>
                              item.id === input.reviewId ? { ...item, reply: input.reply } : item
                          )
                      }
                  }
                : current
        );
    }, []);

    return (
        <Section
            title={t('account.receivedReviews.sectionTitle')}
            description={
                state.status === 'ready'
                    ? tPlural('account.receivedReviews.total', state.data.total, {
                          count: state.data.total
                      })
                    : undefined
            }
            helpId={HELP_ID}
        >
            <FilterChips
                label={t('account.receivedReviews.filterLabel')}
                value={filter}
                onChange={(next) => {
                    setFilter((next as Filter | null) ?? 'all');
                    setPage(1);
                }}
                items={[
                    {
                        value: 'all',
                        label: t('account.receivedReviews.filterAll'),
                        exclusive: true
                    },
                    {
                        value: 'unanswered',
                        label: t('account.receivedReviews.filterUnanswered'),
                        exclusive: true
                    }
                ]}
            />
            <AsyncRegion
                state={state}
                loading={() => (
                    <Skeleton
                        locale={locale}
                        lines={4}
                    />
                )}
                error={({ retry }) => (
                    <ErrorState
                        locale={locale}
                        onRetry={retry}
                        title={t('account.receivedReviews.loadError.title')}
                        description={t('account.receivedReviews.loadError.body')}
                    />
                )}
                empty={() => (
                    <EmptyState
                        icon={
                            <StarIcon
                                size={28}
                                aria-hidden={true}
                            />
                        }
                        title={t(
                            filter === 'unanswered'
                                ? 'account.receivedReviews.emptyUnansweredTitle'
                                : 'account.receivedReviews.emptyTitle'
                        )}
                        description={t(
                            filter === 'unanswered'
                                ? 'account.receivedReviews.emptyUnanswered'
                                : 'account.receivedReviews.empty'
                        )}
                    />
                )}
                locked={() => null}
                ready={(data) => {
                    const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
                    return (
                        <>
                            <DataList label={t('account.receivedReviews.listLabel')}>
                                {data.items.map((review) => (
                                    <ReviewCard
                                        key={review.id}
                                        review={review}
                                        locale={locale}
                                        canRespond={data.canRespond}
                                        onReplyChange={setReply}
                                    />
                                ))}
                            </DataList>
                            {pageCount > 1 && (
                                <Pagination
                                    page={page}
                                    pageCount={pageCount}
                                    onPageChange={setPage}
                                    locale={locale}
                                />
                            )}
                        </>
                    );
                }}
            />
        </Section>
    );
}

interface ReviewCardProps {
    readonly review: ReviewItem;
    readonly locale: SupportedLocale;
    readonly canRespond: boolean;
    readonly onReplyChange: (input: { reviewId: string; reply: Reply | null }) => void;
}

/** One received review and its reply area. */
function ReviewCard({ review, locale, canRespond, onReplyChange }: ReviewCardProps) {
    const t = createT(locale);
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const [mode, setMode] = useState<'idle' | 'composing'>('idle');
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const reply = review.reply;
    const reviewer = review.reviewerName ?? t('account.receivedReviews.anonymous');

    const startComposing = () => {
        setDraft(reply?.content ?? '');
        setErrorKey(null);
        setMode('composing');
    };

    const submit = async () => {
        const content = draft.trim();
        if (content.length === 0) {
            setErrorKey('account.receivedReviews.errors.required');
            return;
        }
        if (content.length > ACCOMMODATION_REVIEW_REPLY_MAX) {
            setErrorKey('account.receivedReviews.errors.tooLong');
            return;
        }
        setBusy(true);
        setErrorKey(null);
        const args = { accommodationId: review.accommodationId, reviewId: review.id, content };
        const result = reply
            ? await reviewRepliesApi.update(args)
            : await reviewRepliesApi.create(args);
        setBusy(false);
        if (!result.ok) {
            setErrorKey(replyErrorKey(result.error));
            return;
        }
        onReplyChange({ reviewId: review.id, reply: result.data });
        setMode('idle');
    };

    const remove = async () => {
        await askConfirm({
            title: t('account.receivedReviews.delete'),
            description: t('account.receivedReviews.deleteConfirm'),
            confirmLabel: t('account.receivedReviews.delete'),
            onConfirm: async () => {
                setBusy(true);
                const result = await reviewRepliesApi.remove({
                    accommodationId: review.accommodationId,
                    reviewId: review.id
                });
                setBusy(false);
                if (!result.ok) {
                    setErrorKey(replyErrorKey(result.error));
                    throw new Error('reply-delete-failed');
                }
                onReplyChange({ reviewId: review.id, reply: null });
            }
        });
    };

    return (
        <article
            className={styles.card}
            data-testid="received-review"
        >
            <header className={styles.header}>
                <Avatar
                    name={reviewer}
                    decorative
                />
                <div className={styles.headerText}>
                    <span className={styles.reviewer}>{reviewer}</span>
                    <span className={styles.meta}>
                        <a
                            className={styles.listingLink}
                            href={buildUrl({
                                locale,
                                path: `alojamientos/${review.accommodationSlug}`
                            })}
                        >
                            {review.accommodationName}
                        </a>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={new Date(review.createdAt).toISOString()}>
                            {formatDate(review.createdAt, locale)}
                        </time>
                    </span>
                </div>
                <RatingStars
                    value={review.averageRating}
                    showValue
                    label={t('account.receivedReviews.ratingAria', undefined, {
                        value: review.averageRating,
                        max: 5
                    })}
                />
            </header>
            {review.title ? <strong className={styles.title}>{review.title}</strong> : null}
            {review.content ? <p className={styles.content}>{review.content}</p> : null}

            {reply && mode === 'idle' ? (
                <div className={styles.reply}>
                    <p className={styles.replyLabel}>
                        {t('account.receivedReviews.replyLabel')}
                        {reply.editedAt ? (
                            <span className={styles.edited}>
                                {' '}
                                · {t('account.receivedReviews.edited')}
                            </span>
                        ) : null}
                    </p>
                    <p className={styles.replyText}>{reply.content}</p>
                    {reply.moderationState === 'PENDING' ? (
                        <Alert
                            tone="info"
                            locale={locale}
                        >
                            {t('account.receivedReviews.pendingNotice')}
                        </Alert>
                    ) : null}
                    {reply.moderationState === 'REJECTED' ? (
                        <Alert
                            tone="warning"
                            locale={locale}
                        >
                            {t('account.receivedReviews.hiddenNotice')}
                        </Alert>
                    ) : null}
                    {errorKey ? (
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {t(errorKey)}
                        </Alert>
                    ) : null}
                    <div className={styles.actions}>
                        {/* Delete needs no plan: a downgraded host can still take their reply down. */}
                        {!canRespond || reply.moderationState === 'REJECTED' ? null : (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={startComposing}
                                disabled={busy}
                            >
                                {t('account.receivedReviews.edit')}
                            </Button>
                        )}
                        <Button
                            variant="danger-ghost"
                            size="sm"
                            onClick={() => void remove()}
                            disabled={busy}
                        >
                            {t('account.receivedReviews.delete')}
                        </Button>
                    </div>
                </div>
            ) : null}

            {mode === 'composing' ? (
                <form
                    className={styles.reply}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <label
                        className={styles.replyLabel}
                        htmlFor={`reply-${review.id}`}
                    >
                        {t('account.receivedReviews.replyLabel')}
                    </label>
                    <Textarea
                        id={`reply-${review.id}`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t('account.receivedReviews.replyPlaceholder')}
                        limit={ACCOMMODATION_REVIEW_REPLY_MAX}
                        locale={locale}
                        rows={4}
                        invalid={errorKey !== null}
                    />
                    {errorKey ? (
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {t(errorKey, undefined, { max: ACCOMMODATION_REVIEW_REPLY_MAX })}
                        </Alert>
                    ) : null}
                    <div className={styles.actions}>
                        <Button
                            type="submit"
                            size="sm"
                            loading={busy}
                        >
                            {busy
                                ? t('account.receivedReviews.saving')
                                : t(
                                      reply
                                          ? 'account.receivedReviews.save'
                                          : 'account.receivedReviews.publish'
                                  )}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode('idle')}
                            disabled={busy}
                        >
                            {t('account.receivedReviews.cancel')}
                        </Button>
                    </div>
                </form>
            ) : null}

            {!reply && mode === 'idle' ? (
                canRespond ? (
                    <div className={styles.actions}>
                        <Button
                            size="sm"
                            onClick={startComposing}
                        >
                            {t('account.receivedReviews.respond')}
                        </Button>
                    </div>
                ) : (
                    <Alert
                        tone="info"
                        locale={locale}
                        title={t('account.receivedReviews.upsell.title')}
                        action={
                            <LinkButton
                                href={buildUrl({ locale, path: 'planes/anfitriones' })}
                                variant="secondary"
                            >
                                {t('account.receivedReviews.upsell.cta')}
                            </LinkButton>
                        }
                    >
                        {t('account.receivedReviews.upsell.body')}
                    </Alert>
                )
            ) : null}
            {confirmDialog}
        </article>
    );
}
