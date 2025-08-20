import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UserIcon component
 *
 * @example
 * ```tsx
 * import { UserIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UserIcon />
 *
 * // With custom size and color
 * <UserIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <UserIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const UserIcon = ({
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
        aria-label={ariaLabel || 'user icon'}
        {...props}
    >
        <title>{ariaLabel || 'User'}</title>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle
            cx="12"
            cy="7"
            r="4"
        />
    </svg>
);
