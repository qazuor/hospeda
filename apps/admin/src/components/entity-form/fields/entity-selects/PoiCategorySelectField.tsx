/**
 * @file PoiCategorySelectField Component
 *
 * A specialized multi-select chip field for selecting POI categories from
 * the `poi_categories` catalog (HOS-144 T-016). Wraps `EntitySelectField`
 * with POI-category-specific configuration:
 *  - searchMode: 'client' (full catalog loaded once, filtered locally)
 *  - multiple: true (returns string[])
 *  - Chip labels resolved via each category's own `nameI18n` (es → en → pt)
 *
 * Mirrors `AmenitySelectField`'s wrapper pattern exactly (HOS-144 §6.4/§5).
 */

import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    FieldConfig,
    PoiCategorySelectFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadAllPoiCategories, loadPoiCategoriesByIds } from './utils';

/**
 * Props for PoiCategorySelectField component.
 */
export interface PoiCategorySelectFieldProps {
    config: FieldConfig & { typeConfig?: PoiCategorySelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    hasError?: boolean;
    errorMessage?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
}

/**
 * PoiCategorySelectField — multi-select chip field for the POI category
 * catalog.
 *
 * Uses client-side search over the full catalog so the combobox responds
 * instantly to keystrokes without additional server round-trips. The
 * catalog is fetched once and cached by `EntitySelectField`'s `loadAllFn`
 * mechanism.
 */
export const PoiCategorySelectField = React.forwardRef<
    HTMLButtonElement,
    PoiCategorySelectFieldProps
>(
    (
        { config, value, onChange, error, hasError, errorMessage, disabled, required, className },
        ref
    ) => {
        const { multiple = true, clearable = true, itemClassName } = config.typeConfig || {};

        const loadAllCallback = React.useCallback(loadAllPoiCategories, []);
        const loadByIdsCallback = React.useCallback(loadPoiCategoriesByIds, []);

        const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
            ...config,
            type: FieldTypeEnum.ENTITY_SELECT,
            typeConfig: {
                entityType: EntityTypeEnum.POI_CATEGORY,
                // searchFn not needed for client mode — EntitySelectField reads searchFn
                // only in server mode. We provide a no-op to satisfy the required type.
                searchFn: async () => [],
                loadByIdsFn: loadByIdsCallback,
                loadAllFn: loadAllCallback,
                multiple,
                searchable: true,
                clearable,
                searchMode: 'client',
                showAllWhenEmpty: true
            }
        };

        return (
            <EntitySelectField
                ref={ref}
                config={entitySelectConfig}
                value={value}
                onChange={onChange}
                hasError={hasError ?? !!error}
                errorMessage={errorMessage ?? error}
                disabled={disabled}
                required={required}
                className={itemClassName ? `${className ?? ''} ${itemClassName}` : className}
            />
        );
    }
);

PoiCategorySelectField.displayName = 'PoiCategorySelectField';
