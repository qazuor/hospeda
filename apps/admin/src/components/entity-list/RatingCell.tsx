/**
 * RatingCell — generic, entity-agnostic rating cell for entity lists.
 *
 * Renders a gold star + the average score as a clickable value. Clicking opens
 * a dialog with the per-dimension rating breakdown (bars), lazily fetched from
 * the entity's detail query while the dialog is open. Renders an em dash when
 * the entity has no rating yet.
 *
 * Dimensions are passed as config so each entity supplies its own set + labels;
 * the detail query hook is passed as a prop (same pattern as the inline-edit
 * cells), so the component stays decoupled from any specific entity.
 */

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

/** A rating dimension: the key in the rating record + its localized label. */
export interface RatingDimension {
    readonly key: string;
    readonly label: TranslationKey;
}

/** Minimal detail-query result shape the cell needs. */
export interface RatingDetailLike {
    readonly rating?: unknown;
}

/** Minimal detail-query hook contract. */
export type UseRatingDetailQuery = (
    id: string,
    options: { enabled: boolean }
) => { data?: RatingDetailLike; isLoading: boolean };

/** Props for {@link RatingCell}. RO-RO pattern. */
export interface RatingCellProps {
    /** Entity ID whose rating breakdown is fetched. */
    readonly entityId: string;
    /** Human-readable entity name, shown as the dialog title. */
    readonly entityName: string;
    /** Denormalized average rating shown on the trigger. */
    readonly averageRating: number;
    /** Review count shown next to the average in the dialog. */
    readonly reviewsCount: number;
    /** Rating dimensions (key + localized label) rendered as bars. */
    readonly dimensions: ReadonlyArray<RatingDimension>;
    /** Detail query hook factory; invoked once per render with `entityId`. */
    readonly useDetailQuery: UseRatingDetailQuery;
}

type RatingBreakdownDialogProps = {
    readonly entityId: string;
    readonly name: string;
    readonly averageRating: number;
    readonly reviewsCount: number;
    readonly dimensions: ReadonlyArray<RatingDimension>;
    readonly useDetailQuery: UseRatingDetailQuery;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
};

const RatingBreakdownDialog = ({
    entityId,
    name,
    averageRating,
    reviewsCount,
    dimensions,
    useDetailQuery,
    open,
    onOpenChange
}: RatingBreakdownDialogProps) => {
    const { t } = useTranslations();
    const { data, isLoading } = useDetailQuery(entityId, { enabled: open });
    const breakdown = (data?.rating ?? null) as Record<string, number> | null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
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
                        {dimensions.map((dimension) => {
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
 * Gold star + average score; clicking opens the per-dimension breakdown dialog.
 */
export const RatingCell = ({
    entityId,
    entityName,
    averageRating,
    reviewsCount,
    dimensions,
    useDetailQuery
}: RatingCellProps) => {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);

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
                    entityId={entityId}
                    name={entityName}
                    averageRating={averageRating}
                    reviewsCount={reviewsCount}
                    dimensions={dimensions}
                    useDetailQuery={useDetailQuery}
                    open={open}
                    onOpenChange={setOpen}
                />
            )}
        </>
    );
};
