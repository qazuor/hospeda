import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    EventLocationSelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadEventLocationsByIds, loadInitialEventLocations, searchEventLocations } from './utils';

export interface EventLocationSelectFieldProps {
    config: FieldConfig & { typeConfig?: EventLocationSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

export const EventLocationSelectField = React.forwardRef<
    HTMLButtonElement,
    EventLocationSelectFieldProps
>(({ config, value, onChange, error, className }, ref) => {
    const {
        multiple = false,
        searchMode = 'server',
        clearable = true,
        minCharToSearch = 2,
        searchDebounce = 300,
        itemClassName
    } = config.typeConfig || {};

    const searchCallback = React.useCallback(searchEventLocations, []);
    const loadByIdsCallback = React.useCallback(loadEventLocationsByIds, []);
    const loadInitialCallback = React.useCallback(loadInitialEventLocations, []);

    const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
        ...config,
        type: FieldTypeEnum.ENTITY_SELECT,
        typeConfig: {
            entityType: EntityTypeEnum.EVENT_LOCATION,
            searchFn: searchCallback,
            loadByIdsFn: loadByIdsCallback,
            loadAllFn: loadInitialCallback,
            multiple,
            searchable: true,
            clearable,
            minSearchLength: minCharToSearch,
            searchDebounceMs: searchDebounce,
            searchMode,
            showAllWhenEmpty: true
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
EventLocationSelectField.displayName = 'EventLocationSelectField';
