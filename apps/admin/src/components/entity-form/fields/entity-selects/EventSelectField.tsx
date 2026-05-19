import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    EventSelectFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadEventsByIds, loadInitialEvents, searchEvents } from './utils';

export interface EventSelectFieldProps {
    config: FieldConfig & { typeConfig?: EventSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

export const EventSelectField = React.forwardRef<HTMLButtonElement, EventSelectFieldProps>(
    ({ config, value, onChange, error, className }, ref) => {
        const {
            multiple = false,
            searchMode = 'server',
            clearable = true,
            minCharToSearch = 2,
            searchDebounce = 300,
            itemClassName
        } = config.typeConfig || {};

        const searchCallback = React.useCallback(searchEvents, []);
        const loadByIdsCallback = React.useCallback(loadEventsByIds, []);
        const loadInitialCallback = React.useCallback(loadInitialEvents, []);

        const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
            ...config,
            type: FieldTypeEnum.ENTITY_SELECT,
            typeConfig: {
                entityType: EntityTypeEnum.EVENT,
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
    }
);
EventSelectField.displayName = 'EventSelectField';
