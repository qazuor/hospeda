import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HeatedPoolIcon icon component
 *
 * @example
 * ```tsx
 * import { HeatedPoolIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HeatedPoolIcon />
 *
 * // With custom size and color
 * <HeatedPoolIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HeatedPoolIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HeatedPoolIcon = ({
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
        <title>{ariaLabel || 'Heated Pool'}</title>
        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </svg>
);
