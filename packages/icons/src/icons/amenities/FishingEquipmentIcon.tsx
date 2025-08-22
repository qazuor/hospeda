import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FishingEquipmentIcon icon component
 *
 * @example
 * ```tsx
 * import { FishingEquipmentIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FishingEquipmentIcon />
 *
 * // With custom size and color
 * <FishingEquipmentIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FishingEquipmentIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FishingEquipmentIcon = ({
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
        <title>{ariaLabel || 'Fishing Equipment'}</title>
        <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
        <path d="M18 12v.5" />
        <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
        <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1.13-.18-1.13.32 0 .5C5.58 6.53 7 8.15 7 10.67" />
        <path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4" />
        <path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H8c1.17-1.24 2.2-2.88 2.46-4.26" />
    </svg>
);
