import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HairDryerIcon icon component
 *
 * @example
 * ```tsx
 * import { HairDryerIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HairDryerIcon />
 *
 * // With custom size and color
 * <HairDryerIcon size="lg" color="#EC4899" />
 *
 * // With Tailwind classes
 * <HairDryerIcon className="text-pink-500 hover:text-pink-600" />
 * ```
 */
export const HairDryerIcon = ({
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
        <title>{ariaLabel || 'Hair Dryer'}</title>
        <path d="M14 4V2a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />
        <path d="M15 2v6.5A3.5 3.5 0 0 0 18.5 12a3.5 3.5 0 0 0 3.5-3.5V2" />
        <path d="M9 2v6.5A3.5 3.5 0 0 1 5.5 12a3.5 3.5 0 0 1-3.5-3.5V2" />
        <circle
            cx="12"
            cy="17"
            r="5"
        />
        <path d="m9 14 3 3 3-3" />
    </svg>
);
