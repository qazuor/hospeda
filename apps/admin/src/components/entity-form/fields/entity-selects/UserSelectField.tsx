/**
 * @file UserSelectField Component
 *
 * A specialized field component for selecting users with encapsulated search logic.
 * This component wraps EntitySelectField with user-specific configuration and API calls.
 */

import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    FieldConfig,
    UserSelectFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import { loadInitialUsers, loadUsersByIds, searchUsers } from './utils';

/**
 * Props for UserSelectField component
 */
export interface UserSelectFieldProps {
    config: FieldConfig & { typeConfig?: UserSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

/**
 * UserSelectField component with encapsulated user search logic
 */
export const UserSelectField = React.forwardRef<HTMLButtonElement, UserSelectFieldProps>(
    ({ config, value, onChange, error, className }, ref) => {
        // Extract configuration with defaults
        const {
            multiple = false,
            searchMode = 'server', // Users typically use server search due to large datasets
            clearable = true,
            minCharToSearch = 2, // Lower threshold for user search
            searchDebounce = 300,
            itemClassName,
            roleFilter,
            statusFilter
        } = config.typeConfig || {};

        // Use imported utility function with filters
        const searchUsersCallback = React.useCallback(
            (query: string) => searchUsers(query, { roleFilter, statusFilter }),
            [roleFilter, statusFilter]
        );

        // Use imported utility functions
        const loadUsersByIdsCallback = React.useCallback(loadUsersByIds, []);
        const loadInitialUsersCallback = React.useCallback(
            () => loadInitialUsers({ roleFilter, statusFilter }),
            [roleFilter, statusFilter]
        );

        // Create EntitySelectField configuration
        const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
            ...config,
            type: FieldTypeEnum.ENTITY_SELECT,
            typeConfig: {
                entityType: EntityTypeEnum.USER,
                searchFn: searchUsersCallback,
                loadByIdsFn: loadUsersByIdsCallback,
                loadAllFn: loadInitialUsersCallback,
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

UserSelectField.displayName = 'UserSelectField';
