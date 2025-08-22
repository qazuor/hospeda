import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FullscreenIcon icon component
 *
 * @example
 * ```tsx
 * import { FullscreenIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FullscreenIcon />
 *
 * // With custom size and color
 * <FullscreenIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FullscreenIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FullscreenIcon = ({
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
        <title>{ariaLabel || 'Fullscreen'}</title>
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
);
