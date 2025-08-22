import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WellnessCenterIcon icon component
 *
 * @example
 * ```tsx
 * import { WellnessCenterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WellnessCenterIcon />
 *
 * // With custom size and color
 * <WellnessCenterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WellnessCenterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WellnessCenterIcon = ({
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
        <title>{ariaLabel || 'Wellness Center'}</title>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
);
