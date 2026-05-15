import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    AccommodationSelectFieldConfig,
    EntitySelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadAccommodationsByIds, loadInitialAccommodations, searchAccommodations } from './utils';

export interface AccommodationSelectFieldProps {
    config: FieldConfig & { typeConfig?: AccommodationSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

export const AccommodationSelectField = React.forwardRef<
    HTMLButtonElement,
    AccommodationSelectFieldProps
>(({ config, value, onChange, error, className }, ref) => {
    const {
        multiple = false,
        searchMode = 'server',
        clearable = true,
        minCharToSearch = 2,
        searchDebounce = 300,
        itemClassName
    } = config.typeConfig || {};

    const searchCallback = React.useCallback(searchAccommodations, []);
    const loadByIdsCallback = React.useCallback(loadAccommodationsByIds, []);
    const loadInitialCallback = React.useCallback(loadInitialAccommodations, []);

    const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
        ...config,
        type: FieldTypeEnum.ENTITY_SELECT,
        typeConfig: {
            entityType: EntityTypeEnum.ACCOMMODATION,
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
AccommodationSelectField.displayName = 'AccommodationSelectField';
