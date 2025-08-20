import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AviariumIcon icon component
 *
 * @example
 * ```tsx
 * import { AviariumIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AviariumIcon />
 *
 * // With custom size and color
 * <AviariumIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AviariumIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AviariumIcon = ({
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
        <title>{ariaLabel || 'Aviarium'}</title>
        <path d="M16 7h.01" />
        <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
        <path d="m20 7 2 .5-2 .5" />
        <path d="M10 18v3" />
        <path d="M14 17.75V21" />
        <path d="M7 18a6 6 0 0 0 3.84-10.61" />
    </svg>
);
