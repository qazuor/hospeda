import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ReportsIcon icon component
 *
 * @example
 * ```tsx
 * import { ReportsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ReportsIcon />
 *
 * // With custom size and color
 * <ReportsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ReportsIcon className="text-purple-500 hover:text-purple-600" />
 * ```
 */
export const ReportsIcon = ({
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
        <title>{ariaLabel || 'Reports'}</title>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <line
            x1="16"
            x2="8"
            y1="13"
            y2="13"
        />
        <line
            x1="16"
            x2="8"
            y1="17"
            y2="17"
        />
        <line
            x1="10"
            x2="8"
            y1="9"
            y2="9"
        />
    </svg>
);
