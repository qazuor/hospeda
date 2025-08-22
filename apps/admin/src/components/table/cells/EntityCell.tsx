import type { EntityOption } from '@/components/table/DataTable';
import { BadgeColor, EntityType } from '@/components/table/DataTable';
import { cn } from '@/lib/utils';
import {
    AccommodationIcon,
    DestinationIcon,
    EventIcon,
    PostIcon,
    PostSponsorIcon,
    UsersManagementIcon
} from '@repo/icons';
import type { ReactNode } from 'react';

type EntityCellProps<TData> = {
    readonly value: unknown;
    readonly row: TData;
    readonly linkHandler?: (row: TData) => void;
    readonly entityOptions?: EntityOption;
};

/**
 * EntityCell component for rendering entity references as clickable badges with icons.
 * Combines the visual appeal of badges with the functionality of links and entity-specific icons.
 */
export const EntityCell = <TData,>({
    value,
    row,
    linkHandler,
    entityOptions
}: EntityCellProps<TData>): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const stringValue = String(value);

    if (!entityOptions || !linkHandler) {
        return <span className="text-gray-900 dark:text-gray-100">{stringValue}</span>;
    }

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        linkHandler(row);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            linkHandler(row);
        }
    };

    const IconComponent = getEntityIcon(entityOptions.entityType);
    const colorClasses = getEntityColorClasses(entityOptions.color || BadgeColor.PRIMARY);

    return (
        <button
            type="button"
            className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-sm ring-1 ring-inset transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                colorClasses
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label={`View ${entityOptions.entityType}: ${stringValue}`}
        >
            <IconComponent className="h-4 w-4" />
            <span className="truncate">{stringValue}</span>
        </button>
    );
};

/**
 * Maps EntityType enum values to their corresponding icon components.
 */
function getEntityIcon(entityType: EntityType) {
    switch (entityType) {
        case EntityType.ACCOMMODATION:
            return AccommodationIcon;
        case EntityType.DESTINATION:
            return DestinationIcon;
        case EntityType.EVENT:
            return EventIcon;
        case EntityType.POST:
            return PostIcon;
        case EntityType.USER:
            return UsersManagementIcon;
        case EntityType.SPONSOR:
            return PostSponsorIcon;
        case EntityType.ATTRACTION:
            return DestinationIcon; // Fallback to destination icon
        case EntityType.FEATURE:
            return AccommodationIcon; // Fallback to accommodation icon
        case EntityType.AMENITY:
            return AccommodationIcon; // Fallback to accommodation icon
        default:
            return PostIcon; // Default fallback icon
    }
}

/**
 * Maps BadgeColor enum values to Tailwind CSS classes for entity buttons.
 */
function getEntityColorClasses(color: BadgeColor): string {
    switch (color) {
        case BadgeColor.DEFAULT:
            return 'bg-gray-50 text-gray-700 ring-gray-600/20 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/30 dark:hover:bg-gray-700';
        case BadgeColor.PRIMARY:
            return 'bg-blue-50 text-blue-700 ring-blue-700/20 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30 dark:hover:bg-blue-900/30';
        case BadgeColor.SECONDARY:
            return 'bg-gray-50 text-gray-700 ring-gray-600/20 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/30 dark:hover:bg-gray-700';
        case BadgeColor.SUCCESS:
            return 'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30 dark:hover:bg-green-900/30';
        case BadgeColor.WARNING:
            return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-400/30 dark:hover:bg-yellow-900/30';
        case BadgeColor.ERROR:
            return 'bg-red-50 text-red-700 ring-red-600/20 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30 dark:hover:bg-red-900/30';
        case BadgeColor.BLUE:
            return 'bg-blue-50 text-blue-700 ring-blue-700/20 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30 dark:hover:bg-blue-900/30';
        case BadgeColor.RED:
            return 'bg-red-50 text-red-700 ring-red-600/20 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30 dark:hover:bg-red-900/30';
        case BadgeColor.GREEN:
            return 'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30 dark:hover:bg-green-900/30';
        case BadgeColor.YELLOW:
            return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-400/30 dark:hover:bg-yellow-900/30';
        case BadgeColor.PURPLE:
            return 'bg-purple-50 text-purple-700 ring-purple-700/20 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-400/30 dark:hover:bg-purple-900/30';
        case BadgeColor.PINK:
            return 'bg-pink-50 text-pink-700 ring-pink-700/20 hover:bg-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:ring-pink-400/30 dark:hover:bg-pink-900/30';
        case BadgeColor.INDIGO:
            return 'bg-indigo-50 text-indigo-700 ring-indigo-700/20 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/30 dark:hover:bg-indigo-900/30';
        case BadgeColor.CYAN:
            return 'bg-cyan-50 text-cyan-700 ring-cyan-700/20 hover:bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-400 dark:ring-cyan-400/30 dark:hover:bg-cyan-900/30';
        case BadgeColor.TEAL:
            return 'bg-teal-50 text-teal-700 ring-teal-700/20 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:ring-teal-400/30 dark:hover:bg-teal-900/30';
        case BadgeColor.ORANGE:
            return 'bg-orange-50 text-orange-700 ring-orange-700/20 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-400/30 dark:hover:bg-orange-900/30';
        case BadgeColor.GRAY:
            return 'bg-gray-50 text-gray-700 ring-gray-600/20 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/30 dark:hover:bg-gray-700';
        case BadgeColor.SLATE:
            return 'bg-slate-50 text-slate-700 ring-slate-600/20 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700';
        default:
            return 'bg-blue-50 text-blue-700 ring-blue-700/20 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30 dark:hover:bg-blue-900/30';
    }
}
