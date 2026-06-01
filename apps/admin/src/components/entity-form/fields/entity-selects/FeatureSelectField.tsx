/**
 * @file FeatureSelectField Component
 *
 * A specialized multi-select chip field for selecting features from the public
 * catalog. Wraps EntitySelectField with feature-specific configuration:
 *  - searchMode: 'client' (full catalog loaded once, filtered locally)
 *  - multiple: true (returns string[])
 *  - Chip labels resolved via resolveI18nText() (es → en → pt)
 *
 * SPEC-172 PR3.
 */

import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    FeatureSelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadAllFeatures, loadFeaturesByIds } from './utils';

/**
 * Props for FeatureSelectField component
 */
export interface FeatureSelectFieldProps {
    config: FieldConfig & { typeConfig?: FeatureSelectFieldConfig };
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
 * FeatureSelectField — multi-select chip field for the feature catalog.
 *
 * Uses client-side search over the full public catalog so that the combobox
 * responds instantly to keystrokes without additional server round-trips.
 * The catalog is fetched once and cached by EntitySelectField's `loadAllFn`
 * mechanism (plus the 5-min HTTP cache on the public endpoint).
 */
export const FeatureSelectField = React.forwardRef<HTMLButtonElement, FeatureSelectFieldProps>(
    (
        { config, value, onChange, error, hasError, errorMessage, disabled, required, className },
        ref
    ) => {
        const { multiple = true, clearable = true, itemClassName } = config.typeConfig || {};

        const loadAllCallback = React.useCallback(loadAllFeatures, []);
        const loadByIdsCallback = React.useCallback(loadFeaturesByIds, []);

        const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
            ...config,
            type: FieldTypeEnum.ENTITY_SELECT,
            typeConfig: {
                entityType: EntityTypeEnum.FEATURE,
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

FeatureSelectField.displayName = 'FeatureSelectField';
