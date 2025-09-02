import {
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { useConfigTranslations } from '@/lib/utils/config-i18n.utils';

import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { PermissionEnum } from '@repo/types';
import { AccommodationClientSchema } from '../../schemas/accommodation-client.schema';

/**
 * Contact Information section configuration for accommodation entity
 *
 * Contains communication and contact details:
 * - Primary email and phone
 * - Website and social media
 * - Contact person information
 * - WhatsApp and messaging platforms
 */
export const createContactInfoSectionConfig = (): SectionConfig => {
    const { t } = useConfigTranslations();

    return {
        id: 'contact-info',
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        title: t('accommodations.sections.contactInfo.title' as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        description: t('accommodations.sections.contactInfo.description' as any),
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
        },
        fields: [
            // Email field
            {
                id: 'email',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'email'),
                asyncValidation: {
                    validator: commonAsyncValidators.validEmail(true),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'email'
                },
                label: t('fields.email.label'),
                description: t('fields.email.description'),
                placeholder: t('fields.email.placeholder')
            },

            // Phone field
            {
                id: 'phone',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'phone'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                label: t('fields.phone.label'),
                description: t('fields.phone.description'),
                placeholder: t('fields.phone.placeholder')
            },

            // Website field
            {
                id: 'website',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'website'),
                asyncValidation: {
                    validator: commonAsyncValidators.validUrl(false),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'url'
                },
                label: t('fields.website.label'),
                description: t('fields.website.description'),
                placeholder: t('fields.website.placeholder')
            },

            // Contact Person Name field
            {
                id: 'contactPersonName',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'contactPersonName'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'name'
                },
                label: t('fields.contactPersonName.label'),
                description: t('fields.contactPersonName.description'),
                placeholder: t('fields.contactPersonName.placeholder')
            },

            // Contact Person Email field
            {
                id: 'contactPersonEmail',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'contactPersonEmail'),
                asyncValidation: {
                    validator: commonAsyncValidators.validEmail(false),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'email'
                },
                label: t('fields.contactPersonEmail.label'),
                description: t('fields.contactPersonEmail.description'),
                placeholder: t('fields.contactPersonEmail.placeholder')
            },

            // Contact Person Phone field
            {
                id: 'contactPersonPhone',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'contactPersonPhone'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                label: t('fields.contactPersonPhone.label'),
                description: t('fields.contactPersonPhone.description'),
                placeholder: t('fields.contactPersonPhone.placeholder')
            },

            // WhatsApp field
            {
                id: 'whatsapp',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'whatsapp'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                label: t('fields.whatsapp.label'),
                description: t('fields.whatsapp.description'),
                placeholder: t('fields.whatsapp.placeholder')
            },

            // Instagram field
            {
                id: 'instagram',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'instagram'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                label: t('fields.instagram.label'),
                description: t('fields.instagram.description'),
                placeholder: t('fields.instagram.placeholder')
            },

            // Facebook field
            {
                id: 'facebook',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'facebook'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                label: t('fields.facebook.label'),
                description: t('fields.facebook.description'),
                placeholder: t('fields.facebook.placeholder')
            }
        ]
    };
};

/**
 * Static contact info section configuration
 * Use this for immediate access without hook dependencies
 */
export const contactInfoSectionConfig = createContactInfoSectionConfig;
