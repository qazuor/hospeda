import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * KayakRentalIcon icon component
 *
 * @example
 * ```tsx
 * import { KayakRentalIcon } from '@repo/icons';
 *
 * // Basic usage
 * <KayakRentalIcon />
 *
 * // With custom size and color
 * <KayakRentalIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <KayakRentalIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const KayakRentalIcon = ({
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
        <title>{ariaLabel || 'Kayak Rental'}</title>
        <path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" />
        <path d="M21 14 10 2 3 14h18Z" />
        <path d="M10 2v16" />
    </svg>
);
