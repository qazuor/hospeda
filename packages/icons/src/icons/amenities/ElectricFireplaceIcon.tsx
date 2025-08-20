import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ElectricFireplaceIcon icon component
 *
 * @example
 * ```tsx
 * import { ElectricFireplaceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ElectricFireplaceIcon />
 *
 * // With custom size and color
 * <ElectricFireplaceIcon size="lg" color="#EF4444" />
 *
 * // With Tailwind classes
 * <ElectricFireplaceIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const ElectricFireplaceIcon = ({
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
        <title>{ariaLabel || 'Electric Fireplace'}</title>
        <path d="M2 20h20" />
        <path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
        <path d="M12 2v2" />
        <path d="M12 8c-1.5 0-3 1.5-3 3.5S10.5 15 12 15s3-1.5 3-3.5S13.5 8 12 8z" />
        <path d="M8 15c0-1 1-2 2-2" />
        <path d="M16 15c0-1-1-2-2-2" />
        <path d="M10 19h4" />
        <circle
            cx="8"
            cy="19"
            r="0.5"
        />
        <circle
            cx="16"
            cy="19"
            r="0.5"
        />
    </svg>
);
