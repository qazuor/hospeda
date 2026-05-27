import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { StarIcon } from '@repo/icons';
import { useState } from 'react';
import { useAccommodationQuery } from '../hooks/useAccommodationQuery';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Rating breakdown dimensions in display order, mapped to their i18n keys.
 * Keys are spelled out (not built via template literals) so they stay
 * within the generated `TranslationKey` union.
 */
const RATING_DIMENSIONS: ReadonlyArray<{ readonly key: string; readonly label: TranslationKey }> = [
    { key: 'cleanliness', label: 'review.form.ratingAspects.cleanliness' },
    { key: 'hospitality', label: 'review.form.ratingAspects.hospitality' },
    { key: 'services', label: 'review.form.ratingAspects.services' },
    { key: 'accuracy', label: 'review.form.ratingAspects.accuracy' },
    { key: 'communication', label: 'review.form.ratingAspects.communication' },
    { key: 'location', label: 'review.form.ratingAspects.location' }
];

type RatingBreakdownDialogProps = {
    readonly id: string;
    readonly name: string;
    readonly averageRating: number;
    readonly reviewsCount: number;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
};

const RatingBreakdownDialog = ({
    id,
    name,
    averageRating,
    reviewsCount,
    open,
    onOpenChange
}: RatingBreakdownDialogProps) => {
    const { t } = useTranslations();
    const { data, isLoading } = useAccommodationQuery(id, { enabled: open });
    const breakdown = (data?.rating ?? null) as Record<string, number> | null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{name}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('admin-entities.columns.rating')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-baseline gap-2">
                    <StarIcon
                        size={22}
                        weight="fill"
                        className="self-center text-amber-400"
                        aria-hidden="true"
                    />
                    <span className="font-semibold text-2xl text-foreground">
                        {averageRating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                        {reviewsCount} {t('admin-entities.columns.reviewsCount')}
                    </span>
                </div>

                {isLoading ? (
                    <p className="text-muted-foreground text-sm">{t('ui.loading.text')}</p>
                ) : breakdown ? (
                    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                        {RATING_DIMENSIONS.map((dimension) => {
                            const value = breakdown[dimension.key] ?? 0;
                            return (
                                <div
                                    key={dimension.key}
                                    className="space-y-1"
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-foreground">
                                            {t(dimension.label)}
                                        </span>
                                        <span className="font-medium text-muted-foreground">
                                            {value.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-amber-400"
                                            style={{ width: `${(value / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">{t('review.list.noReviews')}</p>
                )}
            </DialogContent>
        </Dialog>
    );
};

/**
 * Rating cell for the accommodations list: a gold star + the average score.
 * Clicking opens a dialog with the 6-dimension rating breakdown, lazily
 * fetched from the accommodation detail endpoint. Renders an em dash when
 * the accommodation has no rating yet.
 */
export const AccommodationRatingCell = ({ row }: { readonly row: Accommodation }) => {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);
    const averageRating = typeof row.averageRating === 'number' ? row.averageRating : 0;

    if (!averageRating) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded font-medium text-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
                aria-label={t('admin-entities.columns.rating')}
            >
                <StarIcon
                    size={16}
                    weight="fill"
                    className="text-amber-400"
                    aria-hidden="true"
                />
                {averageRating.toFixed(1)}
            </button>
            {open && (
                <RatingBreakdownDialog
                    id={row.id as string}
                    name={row.name as string}
                    averageRating={averageRating}
                    reviewsCount={typeof row.reviewsCount === 'number' ? row.reviewsCount : 0}
                    open={open}
                    onOpenChange={setOpen}
                />
            )}
        </>
    );
};
