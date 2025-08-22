import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AlertsIcon icon component
 *
 * @example
 * ```tsx
 * import { AlertsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AlertsIcon />
 *
 * // With custom size and color
 * <AlertsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AlertsIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const AlertsIcon = ({
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
        <title>{ariaLabel || 'Alerts'}</title>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
);
