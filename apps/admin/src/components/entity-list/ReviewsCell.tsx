/**
 * ReviewsCell — generic, entity-agnostic reviews cell for entity lists.
 *
 * Renders the review count as a clickable value that opens a dialog listing the
 * entity's reviews (score, author, date, title, content), lazily fetched from
 * the given admin reviews endpoint while the dialog is open. Renders an em dash
 * when there are no reviews.
 *
 * Reused by any entity list whose admin API exposes a `GET <reviewsPath>?<idParam>=<id>`
 * list endpoint returning the standard `{ data: { items } }` envelope
 * (accommodations, destinations).
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import { defaultIntlLocale, formatDate } from '@repo/i18n';
import { StarIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

/** Minimal review shape the cell renders. Both AccommodationReviewAdmin and
 * DestinationReviewAdmin satisfy this structurally. */
export interface ReviewItemLike {
    readonly id: string;
    readonly averageRating?: number | null;
    readonly user?: { readonly displayName?: string | null } | null;
    readonly createdAt: Date | string;
    readonly title?: string | null;
    readonly content?: string | null;
}

/** Props for {@link ReviewsCell}. RO-RO pattern. */
export interface ReviewsCellProps {
    /** Entity ID whose reviews are listed. */
    readonly entityId: string;
    /** Human-readable entity name, shown as the dialog title. */
    readonly entityName: string;
    /** Review count shown as the clickable trigger. */
    readonly count: number;
    /** Admin reviews list endpoint, e.g. `/api/v1/admin/destinations/reviews`. */
    readonly reviewsPath: string;
    /** Query-param name carrying the entity id, e.g. `destinationId`. */
    readonly idParamName: string;
    /** React Query key prefix, e.g. `destination-reviews`. */
    readonly queryKeyPrefix: string;
}

/**
 * Lazily fetches the reviews for a single entity (admin tier). Only runs while
 * the dialog is open.
 */
const useEntityReviews = (
    reviewsPath: string,
    idParamName: string,
    queryKeyPrefix: string,
    entityId: string,
    enabled: boolean
) =>
    useQuery({
        queryKey: [queryKeyPrefix, entityId],
        queryFn: async (): Promise<ReviewItemLike[]> => {
            const response = await fetchApi({
                path: `${reviewsPath}?${idParamName}=${entityId}&pageSize=50`
            });
            const envelope = response.data as { data: { items: ReviewItemLike[] } };
            return envelope.data.items ?? [];
        },
        enabled: enabled && Boolean(entityId),
        staleTime: 5 * 60 * 1000
    });

type ReviewsDialogProps = {
    readonly entityId: string;
    readonly name: string;
    readonly reviewsPath: string;
    readonly idParamName: string;
    readonly queryKeyPrefix: string;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
};

const ReviewsDialog = ({
    entityId,
    name,
    reviewsPath,
    idParamName,
    queryKeyPrefix,
    open,
    onOpenChange
}: ReviewsDialogProps) => {
    const { t } = useTranslations();
    const { data: reviews, isLoading } = useEntityReviews(
        reviewsPath,
        idParamName,
        queryKeyPrefix,
        entityId,
        open
    );

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{name}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('admin-entities.columns.reviewsCount')}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <p className="text-muted-foreground text-sm">{t('ui.loading.text')}</p>
                ) : reviews && reviews.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {reviews.map((review) => (
                            <li
                                key={review.id}
                                className="space-y-1 py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                        <StarIcon
                                            size={14}
                                            weight="fill"
                                            className="text-amber-400"
                                            aria-hidden="true"
                                        />
                                        {(review.averageRating ?? 0).toFixed(1)}
                                    </span>
                                    {review.user?.displayName && (
                                        <span className="text-foreground">
                                            {review.user.displayName}
                                        </span>
                                    )}
                                    <span className="ml-auto text-muted-foreground text-xs">
                                        {formatDate({
                                            date: review.createdAt,
                                            locale: defaultIntlLocale,
                                            options: { dateStyle: 'medium' }
                                        })}
                                    </span>
                                </div>
                                {review.title && (
                                    <p className="font-medium text-foreground text-sm">
                                        {review.title}
                                    </p>
                                )}
                                {review.content && (
                                    <p className="text-muted-foreground text-sm">
                                        {review.content}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">{t('review.list.noReviews')}</p>
                )}
            </DialogContent>
        </Dialog>
    );
};

/**
 * Reviews count as a clickable value opening a dialog with the entity's reviews.
 */
export const ReviewsCell = ({
    entityId,
    entityName,
    count,
    reviewsPath,
    idParamName,
    queryKeyPrefix
}: ReviewsCellProps) => {
    const [open, setOpen] = useState(false);

    if (!count) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="cursor-pointer rounded font-medium text-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
            >
                {count}
            </button>
            {open && (
                <ReviewsDialog
                    entityId={entityId}
                    name={entityName}
                    reviewsPath={reviewsPath}
                    idParamName={idParamName}
                    queryKeyPrefix={queryKeyPrefix}
                    open={open}
                    onOpenChange={setOpen}
                />
            )}
        </>
    );
};
