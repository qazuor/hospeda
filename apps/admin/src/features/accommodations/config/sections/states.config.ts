import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useConfigTranslations } from '@/lib/utils/config-i18n.utils';
import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { ModerationStatusEnum, PermissionEnum } from '@repo/types';
import { AccommodationClientSchema } from '../../schemas/accommodation-client.schema';

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
    const { t } = useConfigTranslations();

    return {
        id: 'states',
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        title: t('accommodations.sections.states.title' as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        description: t('accommodations.sections.states.description' as any),
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
                schema: extractFieldSchema(AccommodationClientSchema as any, 'moderationState'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: [
                        { value: ModerationStatusEnum.PENDING, label: 'Pendiente' },
                        { value: ModerationStatusEnum.APPROVED, label: 'Aprobado' },
                        { value: ModerationStatusEnum.REJECTED, label: 'Rechazado' }
                    ],
                    searchable: false,
                    clearable: false
                },
                label: t('fields.moderationState.label'),
                description: t('fields.moderationState.description'),
                placeholder: t('fields.moderationState.placeholder')
            }

            // TODO [e7db26ef-33fd-4934-8963-062842f4ff6e]: Re-enable when /api/users/batch endpoint is implemented
            // Assigned User field (Entity Select) - TEMPORARILY DISABLED
            // {
            //     id: 'assignedUserId',
            //     type: FieldTypeEnum.ENTITY_SELECT,
            //     required: false,
            //     // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
            //     schema: extractFieldSchema(AccommodationClientSchema as any, 'assignedUserId'),
            //     asyncValidation: {
            //         validator: commonAsyncValidators.userExists(),
            //         trigger: ValidationTriggerEnum.ON_CHANGE
            //     },
            //     permissions: {
            //         view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            //         edit: [PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT]
            //     },
            //     typeConfig: {
            //         type: 'ENTITY_SELECT',
            //         entityType: EntityTypeEnum.USER,
            //         searchFn: userSearchFns.searchFn,
            //         loadByIdsFn: userSearchFns.loadByIdsFn,
            //         allowCreate: false,
            //         multiple: false
            //     },
            //     label: t('fields.assignedUserId.label'),
            //     description: t('fields.assignedUserId.description'),
            //     placeholder: t('fields.assignedUserId.placeholder')
            // }
        ]
    };
};

/**
 * Static states section configuration
 * Use this for immediate access without hook dependencies
 */
export const statesSectionConfig = createStatesSectionConfig;
