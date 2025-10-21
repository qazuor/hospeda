import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { LifecycleStatusEnum } from '@repo/schemas';
import type { EventOrganizer } from '../schemas/event-organizers.schemas';

/**
 * Creates column configuration for event organizers list
 */
export const createEventOrganizersColumns = (): readonly ColumnConfig<EventOrganizer>[] =>
    [
        {
            id: 'name',
            header: 'Name',
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.EVENT_ORGANIZER },
            linkHandler: (row) => ({ to: `/event-organizers/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'logo',
            header: 'Logo',
            accessorKey: 'logo',
            enableSorting: false,
            columnType: ColumnType.IMAGE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'email',
            header: 'Email',
            accessorKey: 'contactInfo.email',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'phone',
            header: 'Phone',
            accessorKey: 'contactInfo.phone',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'website',
            header: 'Website',
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
            header: 'Social Networks',
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

                return networks.length > 0 ? networks.join(', ') : 'None';
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: 'Status',
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: LifecycleStatusEnum.ACTIVE, label: 'Active', color: BadgeColor.SUCCESS },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: 'Draft',
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: 'Archived',
                    color: BadgeColor.SECONDARY
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: 'Created',
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        }
    ] as const;
