import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RiverKayakIcon icon component
 *
 * @example
 * ```tsx
 * import { RiverKayakIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RiverKayakIcon />
 *
 * // With custom size and color
 * <RiverKayakIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RiverKayakIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RiverKayakIcon = ({
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
        <title>{ariaLabel || 'River Kayak'}</title>
        <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2Z" />
        <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1" />
    </svg>
);
