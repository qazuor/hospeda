import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CommercialZoneIcon icon component
 *
 * @example
 * ```tsx
 * import { CommercialZoneIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CommercialZoneIcon />
 *
 * // With custom size and color
 * <CommercialZoneIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CommercialZoneIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CommercialZoneIcon = ({
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
        <title>{ariaLabel || 'Commercial Zone'}</title>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
);
