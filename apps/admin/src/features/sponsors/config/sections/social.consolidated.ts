import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Social Networks section configuration for Sponsor entity
 * Contains: facebook, instagram, twitter, linkedIn, youtube, tiktok
 */
export const createSocialConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'social',
    title: 'Redes Sociales',
    description: 'Perfiles en redes sociales',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_SPONSOR_VIEW],
        edit: [PermissionEnum.POST_SPONSOR_UPDATE]
    },
    fields: [
        {
            id: 'socialNetworks.facebook',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Facebook',
            description: 'URL del perfil de Facebook',
            placeholder: 'https://facebook.com/patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'socialNetworks.instagram',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Instagram',
            description: 'URL del perfil de Instagram',
            placeholder: 'https://instagram.com/patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'socialNetworks.twitter',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Twitter / X',
            description: 'URL del perfil de Twitter',
            placeholder: 'https://twitter.com/patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'socialNetworks.linkedIn',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'LinkedIn',
            description: 'URL del perfil de LinkedIn',
            placeholder: 'https://linkedin.com/company/patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'socialNetworks.youtube',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'YouTube',
            description: 'URL del canal de YouTube',
            placeholder: 'https://youtube.com/@patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'socialNetworks.tiktok',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'TikTok',
            description: 'URL del perfil de TikTok',
            placeholder: 'https://tiktok.com/@patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
