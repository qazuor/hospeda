/**
 * @file DestinationSelectField Component
 *
 * A specialized field component for selecting destinations with encapsulated search logic.
 * This component wraps EntitySelectField with destination-specific configuration and API calls.
 */

import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    DestinationSelectFieldConfig,
    EntitySelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadAllDestinations, loadDestinationsByIds, searchDestinations } from './utils';

/**
 * Props for DestinationSelectField component
 */
export interface DestinationSelectFieldProps {
    config: FieldConfig & { typeConfig?: DestinationSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

/**
 * DestinationSelectField component with encapsulated destination search logic
 */
export const DestinationSelectField = React.forwardRef<
    HTMLButtonElement,
    DestinationSelectFieldProps
>(({ config, value, onChange, error, className }, ref) => {
    // Extract configuration with defaults
    const {
        multiple = false,
        searchMode = 'client',
        clearable = true,
        minCharToSearch = 3,
        searchDebounce = 300,
        itemClassName
    } = config.typeConfig || {};

    // Use imported utility functions wrapped with React.useCallback for optimization
    const searchDestinationsCallback = React.useCallback(searchDestinations, []);
    const loadDestinationsByIdsCallback = React.useCallback(loadDestinationsByIds, []);
    const loadAllDestinationsCallback = React.useCallback(loadAllDestinations, []);

    // Create EntitySelectField configuration
    const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
        ...config,
        type: FieldTypeEnum.ENTITY_SELECT,
        typeConfig: {
            entityType: EntityTypeEnum.DESTINATION,
            searchFn: searchDestinationsCallback,
            loadByIdsFn: loadDestinationsByIdsCallback,
            loadAllFn: searchMode === 'client' ? loadAllDestinationsCallback : undefined,
            multiple,
            searchable: true,
            clearable,
            minSearchLength: minCharToSearch,
            searchDebounceMs: searchDebounce,
            searchMode,
            showAllWhenEmpty: searchMode === 'client'
        }
    };

    return (
        <EntitySelectField
            ref={ref}
            config={entitySelectConfig}
            value={value}
            onChange={onChange}
            hasError={!!error}
            errorMessage={error}
            className={itemClassName ? `${className} ${itemClassName}` : className}
        />
    );
});

DestinationSelectField.displayName = 'DestinationSelectField';
