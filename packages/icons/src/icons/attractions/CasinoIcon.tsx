import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CasinoIcon icon component
 *
 * @example
 * ```tsx
 * import { CasinoIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CasinoIcon />
 *
 * // With custom size and color
 * <CasinoIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CasinoIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CasinoIcon = ({
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
        <title>{ariaLabel || 'Casino'}</title>
        <rect
            width="18"
            height="18"
            x="3"
            y="3"
            rx="2"
            ry="2"
        />
        <path d="M16 8h.01" />
        <path d="M16 12h.01" />
        <path d="M16 16h.01" />
        <path d="M8 8h.01" />
        <path d="M8 12h.01" />
        <path d="M8 16h.01" />
    </svg>
);
