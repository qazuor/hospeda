import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PermissionsIcon icon component
 *
 * @example
 * ```tsx
 * import { PermissionsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PermissionsIcon />
 *
 * // With custom size and color
 * <PermissionsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PermissionsIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const PermissionsIcon = ({
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
        <title>{ariaLabel || 'Permissions'}</title>
        <circle
            cx="12"
            cy="16"
            r="1"
        />
        <rect
            x="3"
            y="10"
            width="18"
            height="12"
            rx="2"
        />
        <path d="m7 10V6a5 5 0 0 1 10 0v4" />
    </svg>
);
