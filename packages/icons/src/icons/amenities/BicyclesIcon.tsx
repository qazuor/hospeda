import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BicyclesIcon icon component
 *
 * @example
 * ```tsx
 * import { BicyclesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BicyclesIcon />
 *
 * // With custom size and color
 * <BicyclesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BicyclesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BicyclesIcon = ({
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
        <title>{ariaLabel || 'Bicycles'}</title>
        <circle
            cx="18.5"
            cy="17.5"
            r="3.5"
        />
        <circle
            cx="5.5"
            cy="17.5"
            r="3.5"
        />
        <circle
            cx="15"
            cy="5"
            r="1"
        />
        <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </svg>
);
