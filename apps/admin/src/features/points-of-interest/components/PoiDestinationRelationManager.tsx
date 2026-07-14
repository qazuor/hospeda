/**
 * PoiDestinationRelationManager
 *
 * Destinations tab manager for a single point of interest (HOS-144 §6.6).
 * Renders a per-row-persisted list of the POI's current destination
 * relations — each row (a `PoiDestinationRow`) owns its own inline
 * `<select>` to change the relation (optimistic-update + rollback-on-error,
 * mirroring `InlineStateSelectCell`'s pattern) and its own remove button
 * gated by a confirmation dialog (mirroring `DeleteRowButton`'s UX) — plus
 * an "Add destination" row (combobox + relation radio + Add button) owned
 * by this manager.
 *
 * This is a genuinely per-item-persisted manager, not a form section: there
 * is no "Save" button for the whole tab, each action persists immediately —
 * exactly like `FaqManager` (HOS-144 §5/§6.6 precedent).
 *
 * Per-row mutations (HOS-144 judgment-day FIX 2): each `PoiDestinationRow`
 * instantiates its own update/remove mutation hooks rather than this
 * manager sharing one instance across the whole list — see
 * `PoiDestinationRow.tsx`'s doc comment for why a shared instance was
 * unsafe under concurrent row edits.
 */

import { AddIcon, LoaderIcon } from '@repo/icons';
import { PointOfInterestDestinationRelationEnum } from '@repo/schemas';
import * as React from 'react';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { DestinationSelectField } from '@/components/entity-form/fields/entity-selects/DestinationSelectField';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';
import {
    useAddPointOfInterestDestinationMutation,
    usePointOfInterestDestinationsQuery
} from '@/features/points-of-interest/hooks/usePointOfInterestDestinations';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import { PoiDestinationRow } from './PoiDestinationRow';

const { PRIMARY, NEARBY } = PointOfInterestDestinationRelationEnum;

/**
 * Props for {@link PoiDestinationRelationManager}. RO-RO pattern.
 */
export interface PoiDestinationRelationManagerProps {
    /** UUID of the point of interest whose destination relations are managed. */
    readonly pointOfInterestId: string;
}

/**
 * Full destination-relation management panel for a single point of interest.
 */
export function PoiDestinationRelationManager({
    pointOfInterestId
}: PoiDestinationRelationManagerProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // ── Data fetching ──────────────────────────────────────────────────────
    const {
        data: relations = [],
        isLoading,
        isError
    } = usePointOfInterestDestinationsQuery(pointOfInterestId);
    const addMutation = useAddPointOfInterestDestinationMutation(pointOfInterestId);

    // ── Add-destination row state ────────────────────────────────────────
    const [addDestinationId, setAddDestinationId] = React.useState<string | undefined>(undefined);
    const [addRelation, setAddRelation] =
        React.useState<PointOfInterestDestinationRelationEnum>(PRIMARY);

    const relationLabel = (relation: PointOfInterestDestinationRelationEnum) =>
        relation === PRIMARY
            ? t('admin-pages.poiDestinations.relation.primary')
            : t('admin-pages.poiDestinations.relation.nearby');

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!addDestinationId) return;
        try {
            const selected = addDestinationId;
            const relation = addRelation;
            await addMutation.mutateAsync({ destinationId: selected, relation });
            setAddDestinationId(undefined);
            setAddRelation(PRIMARY);
            addToast({
                message: t('admin-pages.poiDestinations.messages.added', {
                    name: selected,
                    relation: relationLabel(relation)
                }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[PoiDestinationRelationManager] Failed to add destination', {
                pointOfInterestId,
                destinationId: addDestinationId,
                relation: addRelation,
                error
            });
            addToast({
                message: t('admin-pages.poiDestinations.errors.addFailed'),
                variant: 'error'
            });
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <h2 className="font-semibold text-lg">{t('admin-pages.poiDestinations.title')}</h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                            key={i}
                            className="h-14 animate-pulse rounded-lg border bg-muted"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {isError && !isLoading && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.poiDestinations.errors.loadFailed')}
                    </p>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && relations.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.poiDestinations.empty')}
                    </p>
                </div>
            )}

            {/* Relation rows — each owns its own mutation instance (FIX 2) */}
            {relations.length > 0 && (
                <div className="space-y-2">
                    {relations.map((item) => (
                        <PoiDestinationRow
                            key={item.destinationId}
                            pointOfInterestId={pointOfInterestId}
                            item={item}
                        />
                    ))}
                </div>
            )}

            {/* Add destination row */}
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
                <div className="min-w-[220px] flex-1">
                    <DestinationSelectField
                        config={{
                            id: 'poi-add-destination',
                            type: FieldTypeEnum.DESTINATION_SELECT,
                            label: t('admin-pages.poiDestinations.fields.destination'),
                            placeholder: t(
                                'admin-pages.poiDestinations.fields.destinationPlaceholder'
                            ),
                            typeConfig: {
                                searchMode: 'client',
                                minCharToSearch: 1,
                                clearable: true
                            }
                        }}
                        value={addDestinationId}
                        onChange={(value) =>
                            setAddDestinationId(
                                typeof value === 'string' && value ? value : undefined
                            )
                        }
                    />
                </div>

                <fieldset className="flex items-center gap-3">
                    <legend className="sr-only">
                        {t('admin-pages.poiDestinations.fields.relation')}
                    </legend>
                    <label className="flex items-center gap-1.5 text-sm">
                        <input
                            type="radio"
                            name="poi-add-destination-relation"
                            value={PRIMARY}
                            checked={addRelation === PRIMARY}
                            onChange={() => setAddRelation(PRIMARY)}
                            className="h-4 w-4"
                        />
                        {t('admin-pages.poiDestinations.relation.primary')}
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                        <input
                            type="radio"
                            name="poi-add-destination-relation"
                            value={NEARBY}
                            checked={addRelation === NEARBY}
                            onChange={() => setAddRelation(NEARBY)}
                            className="h-4 w-4"
                        />
                        {t('admin-pages.poiDestinations.relation.nearby')}
                    </label>
                </fieldset>

                <Button
                    type="button"
                    data-testid="poi-destination-add-button"
                    size="sm"
                    onClick={handleAdd}
                    disabled={!addDestinationId || addMutation.isPending}
                    className="gap-1.5"
                >
                    {addMutation.isPending ? (
                        <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <AddIcon className="h-3.5 w-3.5" />
                    )}
                    {t('admin-pages.poiDestinations.actions.add')}
                </Button>
            </div>
        </div>
    );
}
