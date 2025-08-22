import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BellIcon icon component
 *
 * @example
 * ```tsx
 * import { BellIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BellIcon />
 *
 * // With custom size and color
 * <BellIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BellIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BellIcon = ({
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
        <title>{ariaLabel || 'Bell'}</title>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="m13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);
