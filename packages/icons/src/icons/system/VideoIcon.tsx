import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * VideoIcon icon component
 *
 * @example
 * ```tsx
 * import { VideoIcon } from '@repo/icons';
 *
 * // Basic usage
 * <VideoIcon />
 *
 * // With custom size and color
 * <VideoIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <VideoIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const VideoIcon = ({
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
        <title>{ariaLabel || 'Video'}</title>
        <path d="m22 8-6 4 6 4V8Z" />
        <rect
            width="14"
            height="12"
            x="2"
            y="6"
            rx="2"
            ry="2"
        />
    </svg>
);
