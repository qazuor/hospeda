import * as React from 'react';

import { EntityTypeEnum, FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    EntitySelectFieldConfig,
    FieldConfig,
    PostSponsorshipSelectFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../EntitySelectField';
import {
    loadInitialPostSponsorships,
    loadPostSponsorshipsByIds,
    searchPostSponsorships
} from './utils';

export interface PostSponsorshipSelectFieldProps {
    config: FieldConfig & { typeConfig?: PostSponsorshipSelectFieldConfig };
    value?: string | string[];
    onChange: (value: string | string[] | undefined) => void;
    error?: string;
    className?: string;
}

export const PostSponsorshipSelectField = React.forwardRef<
    HTMLButtonElement,
    PostSponsorshipSelectFieldProps
>(({ config, value, onChange, error, className }, ref) => {
    const {
        multiple = false,
        searchMode = 'server',
        clearable = true,
        minCharToSearch = 2,
        searchDebounce = 300,
        itemClassName
    } = config.typeConfig || {};

    const searchCallback = React.useCallback(searchPostSponsorships, []);
    const loadByIdsCallback = React.useCallback(loadPostSponsorshipsByIds, []);
    const loadInitialCallback = React.useCallback(loadInitialPostSponsorships, []);

    const entitySelectConfig: FieldConfig & { typeConfig: EntitySelectFieldConfig } = {
        ...config,
        type: FieldTypeEnum.ENTITY_SELECT,
        typeConfig: {
            entityType: EntityTypeEnum.POST_SPONSORSHIP,
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
PostSponsorshipSelectField.displayName = 'PostSponsorshipSelectField';
