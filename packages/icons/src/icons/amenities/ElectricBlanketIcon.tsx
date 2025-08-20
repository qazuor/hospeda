import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ElectricBlanketIcon icon component
 *
 * @example
 * ```tsx
 * import { ElectricBlanketIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ElectricBlanketIcon />
 *
 * // With custom size and color
 * <ElectricBlanketIcon size="lg" color="#F59E0B" />
 *
 * // With Tailwind classes
 * <ElectricBlanketIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const ElectricBlanketIcon = ({
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
        <title>{ariaLabel || 'Electric Blanket'}</title>
        <path d="M2 4v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2Z" />
        <path d="M6 8h12" />
        <path d="M6 12h12" />
        <path d="M6 16h12" />
        <path d="M12 2v4" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <circle
            cx="18"
            cy="6"
            r="2"
        />
        <path d="m16 4 4 4" />
        <path d="m20 4-4 4" />
    </svg>
);
