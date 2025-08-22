import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BirdWatchingIcon icon component
 *
 * @example
 * ```tsx
 * import { BirdWatchingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BirdWatchingIcon />
 *
 * // With custom size and color
 * <BirdWatchingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BirdWatchingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BirdWatchingIcon = ({
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
        <title>{ariaLabel || 'Bird Watching'}</title>
        <path d="M9 9V7a2 2 0 0 1 4 0v2" />
        <path d="M13 9h4l2 2-2 2h-4" />
        <path d="M5 9h4l2 2-2 2H5" />
        <path d="M17 21v-8a4 4 0 0 0-8 0v8" />
    </svg>
);
