import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RestaurantIcon icon component
 *
 * @example
 * ```tsx
 * import { RestaurantIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RestaurantIcon />
 *
 * // With custom size and color
 * <RestaurantIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RestaurantIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RestaurantIcon = ({
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
        <title>{ariaLabel || 'Restaurant'}</title>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
);
