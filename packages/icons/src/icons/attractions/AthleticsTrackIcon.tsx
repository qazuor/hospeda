import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AthleticsTrackIcon icon component
 *
 * @example
 * ```tsx
 * import { AthleticsTrackIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AthleticsTrackIcon />
 *
 * // With custom size and color
 * <AthleticsTrackIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AthleticsTrackIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AthleticsTrackIcon = ({
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
        <title>{ariaLabel || 'Athletics Track'}</title>
        <polygon points="13,19 8.5,9.5 9.5,9.5 13,19" />
        <polygon points="13,19 17.5,9.5 16.5,9.5 13,19" />
        <polyline points="16,16 18,14 20,16" />
        <polyline points="8,16 6,14 4,16" />
    </svg>
);
