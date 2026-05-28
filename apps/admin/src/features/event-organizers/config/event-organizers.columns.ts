import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteEventOrganizerMutation } from '../hooks/useEventOrganizerQuery';
import type { EventOrganizer } from '../schemas/event-organizers.schemas';

/**
 * Creates column configuration for event organizers list
 */
export const createEventOrganizersColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<EventOrganizer>[] =>
    [
        {
            id: 'name',
            header: t('admin-entities.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.EVENT_ORGANIZER },
            linkHandler: (row) => ({ to: `/events/organizers/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'logo',
            header: t('admin-entities.columns.logo'),
            accessorKey: 'logo',
            enableSorting: false,
            columnType: ColumnType.IMAGE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'email',
            header: t('admin-entities.columns.email'),
            accessorKey: 'contactInfo.personalEmail',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'phone',
            header: t('admin-entities.columns.phone'),
            accessorKey: 'contactInfo.mobilePhone',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'website',
            header: t('admin-entities.columns.website'),
            accessorKey: 'contactInfo.website',
            enableSorting: false,
            columnType: ColumnType.LINK,
            linkHandler: (row) => {
                const website = row.contactInfo?.website;
                if (website) {
                    return { to: website };
                }
                return undefined;
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'social',
            header: t('admin-entities.columns.socialNetworks'),
            accessorKey: 'socialNetworks',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                const social = row.socialNetworks;
                if (!social) return null;

                const networks = [];
                if (social.facebook) networks.push('Facebook');
                if (social.twitter) networks.push('Twitter');
                if (social.instagram) networks.push('Instagram');
                if (social.linkedIn) networks.push('LinkedIn');
                if (social.youtube) networks.push('YouTube');

                return networks.length > 0
                    ? networks.join(', ')
                    : t('admin-common.entityPage.none');
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: LifecycleStatusEnum.ACTIVE,
                    label: t('admin-entities.states.lifecycle.active'),
                    color: BadgeColor.SUCCESS
                },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: t('admin-entities.states.lifecycle.draft'),
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: t('admin-entities.states.lifecycle.archived'),
                    color: BadgeColor.SECONDARY
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: t('admin-entities.columns.createdAt'),
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'actions',
            header: t('admin-entities.columns.actions'),
            accessorKey: 'id',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(
                    Fragment,
                    null,
                    createElement(
                        Link,
                        {
                            to: '/events/organizers/$id/edit' as never,
                            params: { id: row.id } as never,
                            className:
                                'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                            'aria-label': t('admin-entities.actions.edit')
                        } as never,
                        createElement(EditIcon, { size: 16 })
                    ),
                    createElement(DeleteRowButton, {
                        entityId: row.id,
                        entityName: row.name,
                        entityLabel: t('admin-entities.entities.eventOrganizer.singular'),
                        permission: PermissionEnum.EVENT_ORGANIZER_DELETE,
                        useDeleteMutation: useDeleteEventOrganizerMutation,
                        variant: 'icon',
                        entityGender: 'm'
                    })
                )
        }
    ] as const;
