import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ThermalSpaIcon icon component
 *
 * @example
 * ```tsx
 * import { ThermalSpaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ThermalSpaIcon />
 *
 * // With custom size and color
 * <ThermalSpaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ThermalSpaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ThermalSpaIcon = ({
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
        <title>{ariaLabel || 'Thermalspa'}</title>
        <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
        <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
);
