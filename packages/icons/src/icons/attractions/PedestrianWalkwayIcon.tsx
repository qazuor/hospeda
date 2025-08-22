import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PedestrianWalkwayIcon icon component
 *
 * @example
 * ```tsx
 * import { PedestrianWalkwayIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PedestrianWalkwayIcon />
 *
 * // With custom size and color
 * <PedestrianWalkwayIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PedestrianWalkwayIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PedestrianWalkwayIcon = ({
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
        <title>{ariaLabel || 'Pedestrian Walkway'}</title>
        <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 4.41 10 7c0 1.83-.94 3.31-2 4.66V15c0 .55-.45 1-1 1s-1-.45-1-1Z" />
        <ellipse
            cx="7"
            cy="4"
            rx="2"
            ry="2"
        />
        <path d="M16 10c1 0 2 1 2 2v8" />
        <path d="M20 10c1 0 2 1 2 2v8" />
        <path d="M16 8c0-2 2-2 2-4" />
        <path d="M20 8c0-2 2-2 2-4" />
    </svg>
);
