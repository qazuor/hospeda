/**
 * @file UserReviewsList.client.tsx
 * @description React island that lists the authenticated user's reviews.
 *
 * Fetches GET /api/v1/protected/users/me/reviews on mount.
 * Renders the kit `DataList` of the user's reviews: entity link, `RatingStars`,
 * date, type, moderation `StatusPill` and the text. Read-only. 10 per page.
 * Loading, error with retry, empty and ready go through `AsyncRegion`.
 *
 * Hydration: caller must use `client:load`.
 */

import { StarIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import {
    AsyncRegion,
    type AsyncResult,
    Avatar,
    DataList,
    EmptyState,
    ErrorState,
    LinkButton,
    ListRow,
    Pagination,
    RatingStars,
    Section,
    Skeleton,
    StatusPill
} from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createT, createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './UserReviewsList.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
/** Per-type fetch size. Matches the API's max pageSize so a single request
 * returns the full set this island then paginates client-side. */
const API_FETCH_SIZE = 100;
const API_PATH = '/api/v1/protected/users/me/reviews';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Moderation state of a review. Mirrors @repo/schemas ModerationStatusEnum;
 * declared locally to avoid pulling a schemas import into client island code. */
type ModerationState = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A single review item (accommodation or destination) */
interface ReviewItem {
    readonly id: string;
    /** Average rating 0-5 computed from the multi-aspect rating object. */
    readonly rating?: number | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly entityId?: string | null;
    readonly entityName?: string | null;
    readonly entityUrl?: string | null;
    readonly entityGone?: boolean;
    readonly type: 'accommodation' | 'destination';
    readonly moderationState?: ModerationState | null;
}

/** Raw accommodation review from API */
interface RawAccommodationReview {
    readonly id: string;
    readonly rating?: {
        readonly cleanliness?: number;
        readonly hospitality?: number;
        readonly services?: number;
        readonly accuracy?: number;
        readonly communication?: number;
        readonly location?: number;
    } | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly accommodationId?: string | null;
    readonly accommodationName?: string | null;
    readonly accommodationSlug?: string | null;
    readonly accommodationGone?: boolean | null;
    readonly moderationState?: ModerationState | null;
}

/** Raw destination review from API */
interface RawDestinationReview {
    readonly id: string;
    /** Multi-aspect rating object (0-5 per dimension), same shape as accommodation. */
    readonly rating?: Record<string, number> | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly destinationId?: string | null;
    readonly destinationName?: string | null;
    readonly destinationSlug?: string | null;
    readonly moderationState?: ModerationState | null;
}

/** API response for me/reviews */
interface ReviewsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly accommodationReviews: readonly RawAccommodationReview[];
        readonly destinationReviews: readonly RawDestinationReview[];
        readonly totals: {
            readonly accommodationReviews: number;
            readonly destinationReviews: number;
            readonly total: number;
        };
    };
    readonly error?: { readonly message: string };
}

interface UserReviewsListProps {
    /** Active locale for i18n strings */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute average rating from a multi-aspect object. Each aspect is 0-5, so the
 * average is also 0-5 (rounded to 1 decimal). */
function computeAverageRating(ratingObj: Record<string, number> | null | undefined): number | null {
    if (!ratingObj) return null;
    const values = Object.values(ratingObj).filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

/** Format ISO date string to locale-friendly short date. */
function formatDate(iso: string | null | undefined, locale: SupportedLocale): string {
    if (!iso) return '';
    try {
        const localeMap: Record<SupportedLocale, string> = {
            es: 'es-AR',
            en: 'en-US',
            pt: 'pt-BR'
        };
        return new Date(iso).toLocaleDateString(localeMap[locale], {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return iso;
    }
}

/** Normalise raw API reviews into a flat ReviewItem list sorted by date desc. */
function normaliseReviews(data: ReviewsApiResponse['data'], locale: SupportedLocale): ReviewItem[] {
    if (!data) return [];
    const acc: ReviewItem[] = (data.accommodationReviews ?? []).map((r) => ({
        id: r.id,
        rating: computeAverageRating(r.rating as Record<string, number> | null | undefined),
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        entityId: r.accommodationId,
        entityName: r.accommodationName,
        entityGone: r.accommodationGone === true,
        entityUrl:
            r.accommodationGone !== true && r.accommodationSlug
                ? buildUrl({ locale, path: `alojamientos/${r.accommodationSlug}` })
                : null,
        type: 'accommodation' as const,
        moderationState: r.moderationState
    }));

    const dst: ReviewItem[] = (data.destinationReviews ?? []).map((r) => ({
        id: r.id,
        rating: computeAverageRating(r.rating),
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        entityId: r.destinationId,
        entityName: r.destinationName,
        entityGone: false,
        entityUrl: r.destinationSlug
            ? buildUrl({ locale, path: `destinos/${r.destinationSlug}` })
            : null,
        type: 'destination' as const,
        moderationState: r.moderationState
    }));

    return [...acc, ...dst].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Anchor of the reviews list section. */
const HELP_ID = 'section:reviews.list' as const;

/** Reviews list island. Read-only: no inline edit or delete. */
export function UserReviewsList({ locale, apiUrl }: UserReviewsListProps) {
    const t = createT(locale);
    const { tPlural } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    const [state, setState] = useState<AsyncResult<readonly ReviewItem[]>>({ status: 'loading' });
    // `total` is the real count from the API (full DB count, ignoring page size);
    // the loaded set is capped at API_FETCH_SIZE per type and paginated here.
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const fetchReviews = useCallback(async () => {
        setState({ status: 'loading' });
        try {
            // The max page size per type: this island paginates client-side after
            // merging both review types, so it needs the full set in one shot.
            const res = await fetch(`${base}${API_PATH}?type=all&pageSize=${API_FETCH_SIZE}`, {
                credentials: 'include'
            });
            if (!res.ok) throw new Error(String(res.status));
            const body = (await res.json()) as ReviewsApiResponse;
            if (!body.success) throw new Error(body.error?.message ?? 'reviews');
            const items = normaliseReviews(body.data, locale);
            setTotal(body.data?.totals?.total ?? 0);
            setState(items.length === 0 ? { status: 'empty' } : { status: 'ready', data: items });
        } catch {
            setState({ status: 'error', retry: () => void fetchReviews() });
        }
    }, [base, locale]);

    useEffect(() => {
        void fetchReviews();
    }, [fetchReviews]);

    return (
        <Section
            title={t('account.reviews.sectionTitle')}
            description={
                state.status === 'ready'
                    ? tPlural('account.reviews.total', total, { count: total })
                    : undefined
            }
            helpId={HELP_ID}
        >
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
                        title={t('account.reviews.loadError.title')}
                        description={t('account.reviews.loadError.body')}
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
                        title={t('account.reviews.emptyTitle')}
                        description={t('account.reviews.empty')}
                        action={
                            <LinkButton
                                href={buildUrl({ locale, path: 'alojamientos' })}
                                variant="secondary"
                            >
                                {t('account.reviews.emptyCta')}
                            </LinkButton>
                        }
                    />
                )}
                locked={() => null}
                ready={(reviews) => {
                    const pageCount = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
                    const pageReviews = reviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                    return (
                        <>
                            <DataList label={t('account.reviews.listLabel')}>
                                {pageReviews.map((review) => (
                                    <ReviewRow
                                        key={review.id}
                                        review={review}
                                        locale={locale}
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

/** One review as a kit list row. */
function ReviewRow({
    review,
    locale
}: {
    readonly review: ReviewItem;
    readonly locale: SupportedLocale;
}) {
    const t = createT(locale);
    const name = review.entityName ?? t('common.untitled');
    const typeLabel =
        review.type === 'accommodation'
            ? t('account.reviews.typeAccommodation')
            : t('account.reviews.typeDestination');
    const date = formatDate(review.createdAt, locale);
    const hasRating = review.rating !== null && review.rating !== undefined;
    return (
        <ListRow
            rowId={review.id}
            leading={
                <Avatar
                    name={name}
                    decorative
                />
            }
            title={name}
            href={review.entityUrl ?? undefined}
            meta={
                <>
                    <span>{typeLabel}</span>
                    {date ? (
                        <>
                            <span aria-hidden="true"> · </span>
                            <span>{date}</span>
                        </>
                    ) : null}
                    {review.entityGone ? (
                        <>
                            <span aria-hidden="true"> · </span>
                            <span>{t('account.reviews.listingGone')}</span>
                        </>
                    ) : null}
                </>
            }
            description={
                review.title || review.content ? (
                    <>
                        {review.title ? (
                            <strong className={styles.reviewTitle}>{review.title}</strong>
                        ) : null}
                        {review.content ? <span>{review.content}</span> : null}
                    </>
                ) : undefined
            }
            wrapDescription
            trailing={
                <>
                    {hasRating && (
                        <RatingStars
                            value={review.rating ?? 0}
                            showValue
                            label={t('account.reviews.ratingAria', undefined, {
                                value: review.rating ?? 0,
                                max: 5
                            })}
                        />
                    )}
                    {review.moderationState && (
                        <StatusPill
                            domain="moderation"
                            status={review.moderationState}
                            locale={locale}
                        />
                    )}
                </>
            }
        />
    );
}
