import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * OutdoorKitchenIcon icon component
 *
 * @example
 * ```tsx
 * import { OutdoorKitchenIcon } from '@repo/icons';
 *
 * // Basic usage
 * <OutdoorKitchenIcon />
 *
 * // With custom size and color
 * <OutdoorKitchenIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <OutdoorKitchenIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const OutdoorKitchenIcon = ({
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
        <title>{ariaLabel || 'Outdoor Kitchen'}</title>
        <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
        <line
            x1="6"
            x2="18"
            y1="17"
            y2="17"
        />
    </svg>
);
