import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * NaturalReserveIcon icon component
 *
 * @example
 * ```tsx
 * import { NaturalReserveIcon } from '@repo/icons';
 *
 * // Basic usage
 * <NaturalReserveIcon />
 *
 * // With custom size and color
 * <NaturalReserveIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <NaturalReserveIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const NaturalReserveIcon = ({
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
        <title>{ariaLabel || 'Natural Reserve'}</title>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
);
