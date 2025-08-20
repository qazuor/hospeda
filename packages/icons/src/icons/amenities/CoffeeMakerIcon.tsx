import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CoffeeMakerIcon icon component
 *
 * @example
 * ```tsx
 * import { CoffeeMakerIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CoffeeMakerIcon />
 *
 * // With custom size and color
 * <CoffeeMakerIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CoffeeMakerIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CoffeeMakerIcon = ({
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
        <title>{ariaLabel || 'Coffeemaker'}</title>
        <path d="M10 2v2" />
        <path d="M14 2v2" />
        <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
        <path d="M6 2v2" />
    </svg>
);
