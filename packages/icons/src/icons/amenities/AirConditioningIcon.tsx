import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AirConditioningIcon icon component
 *
 * @example
 * ```tsx
 * import { AirConditioningIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AirConditioningIcon />
 *
 * // With custom size and color
 * <AirConditioningIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AirConditioningIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AirConditioningIcon = ({
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
        <title>{ariaLabel || 'Airconditioning'}</title>
        <path d="m10 20-1.25-2.5L6 18" />
        <path d="M10 4 8.75 6.5 6 6" />
        <path d="m14 20 1.25-2.5L18 18" />
        <path d="m14 4 1.25 2.5L18 6" />
        <path d="m17 21-3-6h-4" />
        <path d="m17 3-3 6 1.5 3" />
        <path d="M2 12h6.5L10 9" />
        <path d="m20 10-1.5 2 1.5 2" />
        <path d="M22 12h-6.5L14 15" />
        <path d="m4 10 1.5 2L4 14" />
        <path d="m7 21 3-6-1.5-3" />
        <path d="m7 3 3 6h4" />
    </svg>
);
