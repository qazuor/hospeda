/**
 * PoiDestinationRow — single destination-relation row for
 * `PoiDestinationRelationManager` (HOS-144 judgment-day FIX 2).
 *
 * Extracted so each row owns its OWN update/remove mutation instance
 * (mirroring `InlineStateSelectCell`'s per-cell hook-factory pattern),
 * instead of the whole list sharing one `useMutation` instance. A single
 * shared instance meant concurrent edits on different rows clobbered each
 * other's `isPending`/`variables` state (so `isRowBusy` could show the
 * spinner on the wrong row) and could roll back a different row's
 * optimistic change on failure. Per-row instantiation isolates both the
 * busy state and the optimistic snapshot/rollback (see
 * `usePointOfInterestDestinations.ts` for the per-item rollback scoping
 * that pairs with this).
 */

import { DeleteIcon, LoaderIcon } from '@repo/icons';
import {
    type PointOfInterestDestinationListItem,
    PointOfInterestDestinationRelationEnum
} from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import * as React from 'react';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/ToastProvider';
import {
    useRemovePointOfInterestDestinationMutation,
    useUpdatePointOfInterestDestinationRelationMutation
} from '@/features/points-of-interest/hooks/usePointOfInterestDestinations';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';

const { PRIMARY, NEARBY } = PointOfInterestDestinationRelationEnum;

/**
 * Props for {@link PoiDestinationRow}. RO-RO pattern.
 */
export interface PoiDestinationRowProps {
    /** UUID of the point of interest the relation belongs to. */
    readonly pointOfInterestId: string;
    /** The destination relation this row renders. */
    readonly item: PointOfInterestDestinationListItem;
}

/**
 * Renders a single destination-relation row with its own inline relation
 * `<select>` and remove button, each persisting immediately via its own
 * per-row mutation instance.
 */
export function PoiDestinationRow({ pointOfInterestId, item }: PoiDestinationRowProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    const updateMutation = useUpdatePointOfInterestDestinationRelationMutation(pointOfInterestId);
    const removeMutation = useRemovePointOfInterestDestinationMutation(pointOfInterestId);
    const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false);

    const busy = updateMutation.isPending || removeMutation.isPending;

    const relationLabel = (relation: PointOfInterestDestinationRelationEnum) =>
        relation === PRIMARY
            ? t('admin-pages.poiDestinations.relation.primary')
            : t('admin-pages.poiDestinations.relation.nearby');

    const handleRelationChange = async (relation: PointOfInterestDestinationRelationEnum) => {
        try {
            await updateMutation.mutateAsync({ destinationId: item.destinationId, relation });
            addToast({
                message: t('admin-pages.poiDestinations.messages.relationUpdated', {
                    name: item.destinationName,
                    relation: relationLabel(relation)
                }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[PoiDestinationRow] Failed to update relation', {
                pointOfInterestId,
                destinationId: item.destinationId,
                relation,
                error
            });
            addToast({
                message: t('admin-pages.poiDestinations.errors.updateFailed'),
                variant: 'error'
            });
        }
    };

    const handleRemoveConfirm = async () => {
        setRemoveConfirmOpen(false);
        try {
            await removeMutation.mutateAsync(item.destinationId);
            addToast({
                message: t('admin-pages.poiDestinations.messages.removed', {
                    name: item.destinationName
                }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[PoiDestinationRow] Failed to remove destination', {
                pointOfInterestId,
                destinationId: item.destinationId,
                error
            });
            addToast({
                message: t('admin-pages.poiDestinations.errors.removeFailed'),
                variant: 'error'
            });
        }
    };

    return (
        <>
            <div
                data-testid={`poi-destination-row-${item.destinationId}`}
                className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3',
                    busy && 'opacity-70'
                )}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <Link
                        to="/destinations/$id"
                        params={{ id: item.destinationId }}
                        className="truncate font-medium text-sm hover:underline"
                    >
                        {item.destinationName}
                    </Link>
                    <Badge variant={item.relation === PRIMARY ? 'default' : 'outline'}>
                        {relationLabel(item.relation)}
                    </Badge>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                    {busy && <LoaderIcon className="h-3.5 w-3.5 animate-spin" />}
                    <select
                        data-testid={`poi-destination-relation-select-${item.destinationId}`}
                        aria-label={t('admin-pages.poiDestinations.actions.changeRelation', {
                            name: item.destinationName
                        })}
                        value={item.relation}
                        disabled={busy}
                        onChange={(e) =>
                            handleRelationChange(
                                e.target.value as PointOfInterestDestinationRelationEnum
                            )
                        }
                        className="h-8 rounded-md border bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value={PRIMARY}>
                            {t('admin-pages.poiDestinations.relation.primary')}
                        </option>
                        <option value={NEARBY}>
                            {t('admin-pages.poiDestinations.relation.nearby')}
                        </option>
                    </select>
                    <button
                        type="button"
                        data-testid={`poi-destination-remove-${item.destinationId}`}
                        onClick={() => setRemoveConfirmOpen(true)}
                        disabled={busy}
                        aria-label={t('admin-pages.poiDestinations.actions.remove', {
                            name: item.destinationName
                        })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <DeleteIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <DeleteConfirmDialog
                open={removeConfirmOpen}
                onOpenChange={setRemoveConfirmOpen}
                title={t('admin-pages.poiDestinations.confirmRemove.title')}
                description={t('admin-pages.poiDestinations.confirmRemove.message', {
                    name: item.destinationName
                })}
                cancelLabel={t('admin-pages.poiDestinations.confirmRemove.cancel')}
                confirmLabel={t('admin-pages.poiDestinations.confirmRemove.confirm')}
                onConfirm={handleRemoveConfirm}
            />
        </>
    );
}
