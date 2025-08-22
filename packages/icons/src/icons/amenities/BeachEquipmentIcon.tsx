import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BeachEquipmentIcon icon component
 *
 * @example
 * ```tsx
 * import { BeachEquipmentIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BeachEquipmentIcon />
 *
 * // With custom size and color
 * <BeachEquipmentIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BeachEquipmentIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BeachEquipmentIcon = ({
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
        <title>{ariaLabel || 'Beach Equipment'}</title>
        <path d="M22 12a10.06 10.06 0 0 0-20 0Z" />
        <path d="M12 12v8a2 2 0 0 0 4 0" />
        <path d="M12 2v1" />
    </svg>
);
