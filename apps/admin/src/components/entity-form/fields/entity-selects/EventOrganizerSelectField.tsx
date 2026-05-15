import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    EventOrganizerSelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import {
    loadEventOrganizersByIds,
    loadInitialEventOrganizers,
    searchEventOrganizers
} from './utils';

export interface EventOrganizerSelectFieldProps {
    config: FieldConfig & { typeConfig?: EventOrganizerSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

export const EventOrganizerSelectField = React.forwardRef<
    HTMLButtonElement,
    EventOrganizerSelectFieldProps
>(({ config, value, onChange, error, className }, ref) => {
    const {
        multiple = false,
        searchMode = 'server',
        clearable = true,
        minCharToSearch = 2,
        searchDebounce = 300,
        itemClassName
    } = config.typeConfig || {};

    const searchCallback = React.useCallback(searchEventOrganizers, []);
    const loadByIdsCallback = React.useCallback(loadEventOrganizersByIds, []);
    const loadInitialCallback = React.useCallback(loadInitialEventOrganizers, []);

    const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
        ...config,
        type: FieldTypeEnum.ENTITY_SELECT,
        typeConfig: {
            entityType: EntityTypeEnum.EVENT_ORGANIZER,
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
EventOrganizerSelectField.displayName = 'EventOrganizerSelectField';
