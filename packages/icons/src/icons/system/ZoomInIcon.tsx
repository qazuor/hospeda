import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ZoomInIcon icon component
 *
 * @example
 * ```tsx
 * import { ZoomInIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ZoomInIcon />
 *
 * // With custom size and color
 * <ZoomInIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ZoomInIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ZoomInIcon = ({
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
        <title>{ariaLabel || 'Zoom In'}</title>
        <circle
            cx="11"
            cy="11"
            r="8"
        />
        <path d="m21 21-4.35-4.35" />
        <line
            x1="11"
            x2="11"
            y1="8"
            y2="14"
        />
        <line
            x1="8"
            x2="14"
            y1="11"
            y2="11"
        />
    </svg>
);
