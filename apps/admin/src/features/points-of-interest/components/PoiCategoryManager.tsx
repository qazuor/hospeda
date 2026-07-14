/**
 * PoiCategoryManager
 *
 * Categories tab manager for a single point of interest (HOS-144 §6.4).
 * Renders a chip multi-select over the full `poi_categories` catalog plus a
 * primary-category radio list, persisted as one full-replace `PUT` call —
 * unlike `PoiDestinationRelationManager`, this is a form-style "Save"
 * component, not a per-row-persisted manager (HOS-144 §6.4 vs §6.6).
 *
 * **Structurally-safe primary selection (AC-3)**: the radio list's options
 * are DERIVED from the chip multi-select's current value — a category that
 * isn't selected can never appear as a primary-radio option, so submitting a
 * `primaryCategoryId` that isn't also in `categoryIds` is structurally
 * impossible from this UI, not merely validated after the fact.
 *
 * **Primary pre-selection on load (HOS-144)**: `GET /{id}/categories` returns
 * `isPrimary` per assigned category (symmetric with the PUT response), so the
 * initial-load effect below seeds `primaryCategoryId` from whichever fetched
 * category has `isPrimary === true`, alongside seeding `selectedCategoryIds`
 * from the full assigned set. Because the seeded primary id always comes from
 * the same fetched list `selectedCategoryIds` is derived from, it is always a
 * member of `selectedCategoryIds` by construction — the AC-3 invariant
 * (`primaryCategoryId` can never point outside the current selection) holds
 * for the pre-loaded value exactly as it does for one picked interactively.
 */

import { LoaderIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PoiCategorySelectField } from '@/components/entity-form/fields/entity-selects/PoiCategorySelectField';
import { loadAllPoiCategories } from '@/components/entity-form/fields/entity-selects/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';
import {
    usePointOfInterestCategoriesQuery,
    useSetPointOfInterestCategoriesMutation
} from '@/features/points-of-interest/hooks/usePointOfInterestCategories';
import { useTranslations } from '@/hooks/use-translations';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';

/** Query key for the (small, effectively static) POI category catalog used for label lookups. */
const POI_CATEGORY_CATALOG_QUERY_KEY = ['poi-categories', 'catalog'] as const;

/**
 * Props for {@link PoiCategoryManager}. RO-RO pattern.
 */
export interface PoiCategoryManagerProps {
    /** UUID of the point of interest whose categories are managed. */
    readonly pointOfInterestId: string;
}

/**
 * Full category-assignment management panel for a single point of interest.
 */
export function PoiCategoryManager({ pointOfInterestId }: PoiCategoryManagerProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // ── Data fetching ──────────────────────────────────────────────────────
    const {
        data: assignedCategories,
        isLoading,
        isError,
        isSuccess
    } = usePointOfInterestCategoriesQuery(pointOfInterestId);

    // Full catalog, fetched once — used only to resolve labels for the
    // primary-radio list (the chip select field resolves its own labels
    // internally via the same `loadAllPoiCategories` loader).
    const { data: catalogOptions = [] } = useQuery({
        queryKey: POI_CATEGORY_CATALOG_QUERY_KEY,
        queryFn: loadAllPoiCategories,
        staleTime: 5 * 60_000
    });

    const setCategoriesMutation = useSetPointOfInterestCategoriesMutation(pointOfInterestId);

    // ── Local editable state, seeded once from the initial load ─────────────
    const initializedRef = React.useRef(false);
    const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        if (isSuccess && !initializedRef.current) {
            const categories = assignedCategories ?? [];
            setSelectedCategoryIds(categories.map((category) => category.id));
            const primary = categories.find((category) => category.isPrimary);
            setPrimaryCategoryId(primary?.id);
            initializedRef.current = true;
        }
    }, [isSuccess, assignedCategories]);

    // A previously-chosen primary that falls out of the current selection
    // (chip removed) can never remain a valid radio option — clear it so the
    // Save button correctly re-disables (AC-3).
    React.useEffect(() => {
        if (primaryCategoryId && !selectedCategoryIds.includes(primaryCategoryId)) {
            setPrimaryCategoryId(undefined);
        }
    }, [selectedCategoryIds, primaryCategoryId]);

    // ── Label resolution (assigned categories first, catalog fills the rest) ─
    const labelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const category of assignedCategories ?? []) {
            map.set(category.id, resolveI18nText(category.nameI18n) || category.slug);
        }
        for (const option of catalogOptions) {
            map.set(option.value, option.label);
        }
        return map;
    }, [assignedCategories, catalogOptions]);

    const resolveLabel = (categoryId: string): string => labelById.get(categoryId) ?? categoryId;

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleSelectionChange = (value: string | string[] | undefined) => {
        const next = Array.isArray(value) ? value : value ? [value] : [];
        setSelectedCategoryIds(next);
    };

    const canSave = selectedCategoryIds.length > 0 && primaryCategoryId !== undefined;

    const handleSave = async () => {
        if (!canSave || !primaryCategoryId) return;
        try {
            await setCategoriesMutation.mutateAsync({
                categoryIds: selectedCategoryIds,
                primaryCategoryId
            });
            addToast({
                message: t('admin-pages.poiCategories.messages.saved'),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[PoiCategoryManager] Failed to save categories', {
                pointOfInterestId,
                categoryIds: selectedCategoryIds,
                primaryCategoryId,
                error
            });
            addToast({
                message: t('admin-pages.poiCategories.errors.saveFailed'),
                variant: 'error'
            });
            // Intentionally NOT reverting `selectedCategoryIds`/`primaryCategoryId`
            // here — HOS-144 §8 requires the operator's in-progress selection to
            // survive a failed save so they can retry without re-selecting.
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <h2 className="font-semibold text-lg">{t('admin-pages.poiCategories.title')}</h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div
                    data-testid="poi-category-loading-skeleton"
                    className="h-10 animate-pulse rounded-lg border bg-muted"
                />
            )}

            {/* Error state */}
            {isError && !isLoading && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.poiCategories.errors.loadFailed')}
                    </p>
                </div>
            )}

            {!isLoading && !isError && (
                <div className="space-y-4">
                    {/* Empty-state hint (HOS-144 §8) — a one-line hint above the
                        selector, not a full-page empty state. */}
                    {selectedCategoryIds.length === 0 && (
                        <p
                            data-testid="poi-category-empty-hint"
                            className="text-muted-foreground text-sm"
                        >
                            {t('admin-pages.poiCategories.empty')}
                        </p>
                    )}

                    <PoiCategorySelectField
                        config={{
                            id: 'poi-category-select',
                            type: FieldTypeEnum.POI_CATEGORY_SELECT,
                            label: t('admin-pages.poiCategories.fields.categories')
                        }}
                        value={selectedCategoryIds}
                        onChange={handleSelectionChange}
                    />

                    {/* Primary-category radio list — options are DERIVED from
                        `selectedCategoryIds`, so an unselected category can never
                        appear here (AC-3, structurally-safe by construction). */}
                    {selectedCategoryIds.length > 0 && (
                        <fieldset
                            data-testid="poi-category-primary-fieldset"
                            className="space-y-2 rounded-lg border p-3"
                        >
                            <legend className="px-1 font-medium text-sm">
                                {t('admin-pages.poiCategories.fields.primaryCategory')}
                            </legend>
                            <div className="flex flex-wrap gap-3">
                                {selectedCategoryIds.map((categoryId) => (
                                    <label
                                        key={categoryId}
                                        className="flex items-center gap-1.5 text-sm"
                                    >
                                        <input
                                            type="radio"
                                            name="poi-category-primary"
                                            data-testid={`poi-category-primary-radio-${categoryId}`}
                                            value={categoryId}
                                            checked={primaryCategoryId === categoryId}
                                            onChange={() => setPrimaryCategoryId(categoryId)}
                                            className="h-4 w-4"
                                        />
                                        {resolveLabel(categoryId)}
                                    </label>
                                ))}
                            </div>
                            {!primaryCategoryId && (
                                <p
                                    data-testid="poi-category-primary-hint"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t('admin-pages.poiCategories.hints.primaryRequired')}
                                </p>
                            )}
                        </fieldset>
                    )}

                    <Button
                        type="button"
                        data-testid="poi-category-save-button"
                        onClick={handleSave}
                        disabled={!canSave || setCategoriesMutation.isPending}
                        className="gap-1.5"
                    >
                        {setCategoriesMutation.isPending && (
                            <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {setCategoriesMutation.isPending
                            ? t('admin-pages.poiCategories.actions.saving')
                            : t('admin-pages.poiCategories.actions.save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
