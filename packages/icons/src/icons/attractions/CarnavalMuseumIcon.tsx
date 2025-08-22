import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CarnavalMuseumIcon icon component
 *
 * @example
 * ```tsx
 * import { CarnavalMuseumIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CarnavalMuseumIcon />
 *
 * // With custom size and color
 * <CarnavalMuseumIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CarnavalMuseumIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CarnavalMuseumIcon = ({
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
        <title>{ariaLabel || 'Carnaval Museum'}</title>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle
            cx="12"
            cy="12"
            r="3"
        />
    </svg>
);
