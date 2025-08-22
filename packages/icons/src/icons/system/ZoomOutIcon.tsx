import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ZoomOutIcon icon component
 *
 * @example
 * ```tsx
 * import { ZoomOutIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ZoomOutIcon />
 *
 * // With custom size and color
 * <ZoomOutIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ZoomOutIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ZoomOutIcon = ({
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
        <title>{ariaLabel || 'Zoom Out'}</title>
        <circle
            cx="11"
            cy="11"
            r="8"
        />
        <path d="m21 21-4.35-4.35" />
        <line
            x1="8"
            x2="14"
            y1="11"
            y2="11"
        />
    </svg>
);
