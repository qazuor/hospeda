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
import type { AccommodationReviewAdmin } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Lazily fetches the reviews for a single accommodation (admin tier).
 * Only runs while the dialog is open.
 */
const useAccommodationReviews = (accommodationId: string, enabled: boolean) =>
    useQuery({
        queryKey: ['accommodation-reviews', accommodationId],
        queryFn: async (): Promise<AccommodationReviewAdmin[]> => {
            const response = await fetchApi({
                path: `/api/v1/admin/accommodations/reviews?accommodationId=${accommodationId}&pageSize=50`
            });
            const envelope = response.data as {
                data: { items: AccommodationReviewAdmin[] };
            };
            return envelope.data.items ?? [];
        },
        enabled: enabled && Boolean(accommodationId),
        staleTime: 5 * 60 * 1000
    });

type ReviewsDialogProps = {
    readonly id: string;
    readonly name: string;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
};

const ReviewsDialog = ({ id, name, open, onOpenChange }: ReviewsDialogProps) => {
    const { t } = useTranslations();
    const { data: reviews, isLoading } = useAccommodationReviews(id, open);

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
 * Reviews cell for the accommodations list: the review count as a clickable
 * value that opens a dialog listing the accommodation's reviews (author,
 * score, date, title, content), lazily fetched from the admin reviews
 * endpoint. Renders an em dash when there are no reviews.
 */
export const AccommodationReviewsCell = ({ row }: { readonly row: Accommodation }) => {
    const [open, setOpen] = useState(false);
    const count = typeof row.reviewsCount === 'number' ? row.reviewsCount : 0;

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
                    id={row.id as string}
                    name={row.name as string}
                    open={open}
                    onOpenChange={setOpen}
                />
            )}
        </>
    );
};
