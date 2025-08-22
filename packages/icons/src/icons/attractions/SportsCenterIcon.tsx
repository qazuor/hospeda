import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SportsCenterIcon icon component
 *
 * @example
 * ```tsx
 * import { SportsCenterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SportsCenterIcon />
 *
 * // With custom size and color
 * <SportsCenterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SportsCenterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SportsCenterIcon = ({
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
        <title>{ariaLabel || 'Sports Center'}</title>
        <path d="m6.5 6.5 11 11" />
        <path d="m21 21-1-1" />
        <path d="m3 3 1 1" />
        <path d="m18 22 4-4" />
        <path d="m2 6 4-4" />
        <path d="m3 10 7-7" />
        <path d="m14 21 7-7" />
    </svg>
);
