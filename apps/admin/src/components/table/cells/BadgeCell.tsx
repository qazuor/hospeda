import type { BadgeOption } from '@/components/table/DataTable';
import { BadgeColor } from '@/components/table/DataTable';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BadgeCellProps = {
    readonly value: unknown;
    readonly options?: readonly BadgeOption[];
};

/**
 * BadgeCell component for rendering badge values in table cells.
 * Maps values to configured badge options with appropriate colors and labels.
 */
export const BadgeCell = ({ value, options }: BadgeCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const stringValue = String(value);
    const badgeOption = options?.find((option) => option.value === stringValue);

    if (!badgeOption) {
        return (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 font-medium text-gray-600 text-xs ring-1 ring-gray-500/10 ring-inset dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20">
                {stringValue}
            </span>
        );
    }

    const colorClasses = getBadgeColorClasses(badgeOption.color);

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 font-medium text-xs ring-1 ring-inset',
                colorClasses
            )}
        >
            {badgeOption.label}
        </span>
    );
};

/**
 * Maps BadgeColor enum values to Tailwind CSS classes.
 */
function getBadgeColorClasses(color: BadgeColor): string {
    switch (color) {
        case BadgeColor.DEFAULT:
            return 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20';
        case BadgeColor.PRIMARY:
            return 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30';
        case BadgeColor.SECONDARY:
            return 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20';
        case BadgeColor.SUCCESS:
            return 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30';
        case BadgeColor.WARNING:
            return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-400/30';
        case BadgeColor.ERROR:
            return 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30';
        case BadgeColor.BLUE:
            return 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30';
        case BadgeColor.RED:
            return 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30';
        case BadgeColor.GREEN:
            return 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30';
        case BadgeColor.YELLOW:
            return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-400/30';
        case BadgeColor.PURPLE:
            return 'bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-400/30';
        case BadgeColor.PINK:
            return 'bg-pink-50 text-pink-700 ring-pink-700/10 dark:bg-pink-900/20 dark:text-pink-400 dark:ring-pink-400/30';
        case BadgeColor.INDIGO:
            return 'bg-indigo-50 text-indigo-700 ring-indigo-700/10 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/30';
        case BadgeColor.CYAN:
            return 'bg-cyan-50 text-cyan-700 ring-cyan-700/10 dark:bg-cyan-900/20 dark:text-cyan-400 dark:ring-cyan-400/30';
        case BadgeColor.TEAL:
            return 'bg-teal-50 text-teal-700 ring-teal-700/10 dark:bg-teal-900/20 dark:text-teal-400 dark:ring-teal-400/30';
        case BadgeColor.ORANGE:
            return 'bg-orange-50 text-orange-700 ring-orange-700/10 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-400/30';
        case BadgeColor.GRAY:
            return 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20';
        case BadgeColor.SLATE:
            return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20';
        default:
            return 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20';
    }
}
