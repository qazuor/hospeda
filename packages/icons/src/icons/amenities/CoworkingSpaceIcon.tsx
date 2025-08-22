import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CoworkingSpaceIcon icon component
 *
 * @example
 * ```tsx
 * import { CoworkingSpaceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CoworkingSpaceIcon />
 *
 * // With custom size and color
 * <CoworkingSpaceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CoworkingSpaceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CoworkingSpaceIcon = ({
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
        <title>{ariaLabel || 'Coworking Space'}</title>
        <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
    </svg>
);
