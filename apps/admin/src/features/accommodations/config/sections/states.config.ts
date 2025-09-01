import {
    EntityTypeEnum,
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { createEntityFunctions } from '@/lib/utils/entity-search.utils';
import { useCommonEnumOptions } from '@/lib/utils/enum-options.utils';
import { createI18nFieldConfig } from '@/lib/utils/i18n-field.utils';
import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { AccommodationCoreSchema } from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum } from '@repo/types';

/**
 * States section configuration for accommodation entity
 *
 * Contains administrative and moderation states:
 * - Moderation status and notes
 * - User assignment and management
 * - Metrics and tracking
 * - Internal administrative data
 */
export const createStatesSectionConfig = (): SectionConfig => {
    const enumOptions = useCommonEnumOptions();
    const userSearchFns = createEntityFunctions(EntityTypeEnum.USER);

    return {
        id: 'states',
        title: 'accommodation.sections.states.title',
        description: 'accommodation.sections.states.description',
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_STATES_EDIT]
        },
        fields: [
            // Moderation State field
            {
                id: 'moderationState',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'moderationState'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: enumOptions.getModerationStatusOptions(ModerationStatusEnum),
                    searchable: false,
                    clearable: false
                },
                ...createI18nFieldConfig('accommodation.fields.moderationState')
            },

            // Moderation Notes field
            {
                id: 'moderationNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'moderationNotes'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 3,
                    maxLength: 1000
                },
                ...createI18nFieldConfig('accommodation.fields.moderationNotes')
            },

            // Assigned User field (Entity Select)
            {
                id: 'assignedUserId',
                type: FieldTypeEnum.ENTITY_SELECT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'assignedUserId'),
                asyncValidation: {
                    validator: commonAsyncValidators.userExists(),
                    trigger: ValidationTriggerEnum.ON_CHANGE
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'ENTITY_SELECT',
                    entityType: EntityTypeEnum.USER,
                    searchFn: userSearchFns.searchFn,
                    loadByIdsFn: userSearchFns.loadByIdsFn,
                    allowCreate: false,
                    multiple: false
                },
                ...createI18nFieldConfig('accommodation.fields.assignedUserId')
            },

            // View Count field (readonly)
            {
                id: 'viewCount',
                type: FieldTypeEnum.NUMBER,
                required: false,
                readonly: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'viewCount'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'NUMBER'
                },
                ...createI18nFieldConfig('accommodation.fields.viewCount')
            },

            // Booking Count field (readonly)
            {
                id: 'bookingCount',
                type: FieldTypeEnum.NUMBER,
                required: false,
                readonly: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'bookingCount'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'NUMBER'
                },
                ...createI18nFieldConfig('accommodation.fields.bookingCount')
            },

            // Internal Notes field
            {
                id: 'internalNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'internalNotes'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 4,
                    maxLength: 2000
                },
                ...createI18nFieldConfig('accommodation.fields.internalNotes')
            },

            // Internal Tags field
            {
                id: 'internalTags',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'internalTags'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                ...createI18nFieldConfig('accommodation.fields.internalTags')
            },

            // Priority field
            {
                id: 'priority',
                type: FieldTypeEnum.NUMBER,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'priority'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
                },
                typeConfig: {
                    type: 'NUMBER',
                    min: 0,
                    max: 100,
                    step: 1
                },
                ...createI18nFieldConfig('accommodation.fields.priority')
            }
        ]
    };
};

/**
 * Static states section configuration
 * Use this for immediate access without hook dependencies
 */
export const statesSectionConfig = createStatesSectionConfig;
