import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UnderfloorHeatingIcon icon component
 *
 * @example
 * ```tsx
 * import { UnderfloorHeatingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UnderfloorHeatingIcon />
 *
 * // With custom size and color
 * <UnderfloorHeatingIcon size="lg" color="#F59E0B" />
 *
 * // With Tailwind classes
 * <UnderfloorHeatingIcon className="text-orange-500 hover:text-orange-600" />
 * ```
 */
export const UnderfloorHeatingIcon = ({
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
        <title>{ariaLabel || 'Underfloor Heating'}</title>
        <rect
            width="20"
            height="16"
            x="2"
            y="4"
            rx="2"
        />
        <path d="M7 15v-3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v3" />
        <path d="M13 15v-3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v3" />
        <path d="M7 8v1" />
        <path d="M13 8v1" />
        <path d="M17 8v1" />
    </svg>
);
