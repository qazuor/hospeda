import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Social Networks section of event organizer
 */
export const createSocialConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'social',
    title: 'Redes Sociales',
    description: 'Perfiles en redes sociales del organizador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
        edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
    },
    fields: [
        {
            id: 'socialNetworks.facebook',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Facebook',
            description: 'URL del perfil de Facebook',
            placeholder: 'https://facebook.com/organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        },
        {
            id: 'socialNetworks.instagram',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Instagram',
            description: 'URL del perfil de Instagram',
            placeholder: 'https://instagram.com/organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        },
        {
            id: 'socialNetworks.twitter',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Twitter / X',
            description: 'URL del perfil de Twitter/X',
            placeholder: 'https://twitter.com/organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        },
        {
            id: 'socialNetworks.linkedIn',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'LinkedIn',
            description: 'URL del perfil de LinkedIn',
            placeholder: 'https://linkedin.com/company/organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        },
        {
            id: 'socialNetworks.youtube',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'YouTube',
            description: 'URL del canal de YouTube',
            placeholder: 'https://youtube.com/@organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        },
        {
            id: 'socialNetworks.tiktok',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'TikTok',
            description: 'URL del perfil de TikTok',
            placeholder: 'https://tiktok.com/@organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        }
    ]
});
