import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WaterDispenserIcon icon component
 *
 * @example
 * ```tsx
 * import { WaterDispenserIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WaterDispenserIcon />
 *
 * // With custom size and color
 * <WaterDispenserIcon size="lg" color="#06B6D4" />
 *
 * // With Tailwind classes
 * <WaterDispenserIcon className="text-cyan-500 hover:text-cyan-600" />
 * ```
 */
export const WaterDispenserIcon = ({
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
        <title>{ariaLabel || 'Water Dispenser'}</title>
        <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
        <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775L16.804 9.5" />
        <path d="m14 14-1-1" />
        <path d="m9 14 1-1" />
        <path d="M12 16v-4" />
        <path d="M12 8V4" />
        <circle
            cx="12"
            cy="2"
            r="1"
        />
        <path d="M7 9.5 9 7l3 3 3-3 2 2.5" />
    </svg>
);
