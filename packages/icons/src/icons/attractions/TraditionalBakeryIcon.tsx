import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * TraditionalBakeryIcon icon component
 *
 * @example
 * ```tsx
 * import { TraditionalBakeryIcon } from '@repo/icons';
 *
 * // Basic usage
 * <TraditionalBakeryIcon />
 *
 * // With custom size and color
 * <TraditionalBakeryIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <TraditionalBakeryIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const TraditionalBakeryIcon = ({
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
        <title>{ariaLabel || 'Traditional Bakery'}</title>
        <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46" />
        <path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z" />
        <path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5S15 2 15 2z" />
    </svg>
);
