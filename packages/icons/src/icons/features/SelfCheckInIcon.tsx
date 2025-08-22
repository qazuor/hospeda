import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SelfCheckInIcon icon component
 *
 * @example
 * ```tsx
 * import { SelfCheckInIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SelfCheckInIcon />
 *
 * // With custom size and color
 * <SelfCheckInIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SelfCheckInIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SelfCheckInIcon = ({
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
        <title>{ariaLabel || 'Self Check In'}</title>
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
        <path d="m21 2-9.6 9.6" />
        <circle
            cx="7.5"
            cy="15.5"
            r="5.5"
        />
    </svg>
);
