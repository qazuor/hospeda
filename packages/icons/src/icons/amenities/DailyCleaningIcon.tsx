import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DailyCleaningIcon icon component
 *
 * @example
 * ```tsx
 * import { DailyCleaningIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DailyCleaningIcon />
 *
 * // With custom size and color
 * <DailyCleaningIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DailyCleaningIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DailyCleaningIcon = ({
    size = 'md',
    color = 'currentColor',
    className = '',
    'aria-label': ariaLabel,
    ...props
}: IconProps) => (
    <svg
        width={typeof size === 'string' ? ICON_SIZES[size] : size}
        height={typeof size === 'string' ? ICON_SIZES[size] : size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        {...props}
    >
        <title>{ariaLabel || 'Daily Cleaning'}</title>
        <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
        <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
);
