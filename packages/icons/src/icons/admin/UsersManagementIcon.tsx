import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UsersManagementIcon icon component
 *
 * @example
 * ```tsx
 * import { UsersManagementIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UsersManagementIcon />
 *
 * // With custom size and color
 * <UsersManagementIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <UsersManagementIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const UsersManagementIcon = ({
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
        <title>{ariaLabel || 'Users Management'}</title>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle
            cx="9"
            cy="7"
            r="4"
        />
        <path d="m22 21-3-3" />
        <circle
            cx="19"
            cy="16"
            r="3"
        />
    </svg>
);
