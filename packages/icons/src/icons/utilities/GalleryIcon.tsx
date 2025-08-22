import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * GalleryIcon icon component
 *
 * @example
 * ```tsx
 * import { GalleryIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GalleryIcon />
 *
 * // With custom size and color
 * <GalleryIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GalleryIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GalleryIcon = ({
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
        <title>{ariaLabel || 'Gallery'}</title>
        <path d="m21 7-3-3-5.5 5.5a2 2 0 0 1-3 0L5 5" />
        <path d="M21 15H3" />
        <path d="M21 19H3" />
        <path d="M3 3h18v18H3z" />
    </svg>
);
