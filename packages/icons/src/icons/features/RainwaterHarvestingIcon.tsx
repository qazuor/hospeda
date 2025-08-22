import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RainwaterHarvestingIcon icon component
 *
 * @example
 * ```tsx
 * import { RainwaterHarvestingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RainwaterHarvestingIcon />
 *
 * // With custom size and color
 * <RainwaterHarvestingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RainwaterHarvestingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RainwaterHarvestingIcon = ({
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
        <title>{ariaLabel || 'Rainwater Harvesting'}</title>
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M16 14v6" />
        <path d="M8 14v6" />
        <path d="M12 16v6" />
    </svg>
);
