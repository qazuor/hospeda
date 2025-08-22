import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * TouristRanchIcon icon component
 *
 * @example
 * ```tsx
 * import { TouristRanchIcon } from '@repo/icons';
 *
 * // Basic usage
 * <TouristRanchIcon />
 *
 * // With custom size and color
 * <TouristRanchIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <TouristRanchIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const TouristRanchIcon = ({
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
        <title>{ariaLabel || 'Tourist Ranch'}</title>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
);
