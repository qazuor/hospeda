import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DoubleGlazingIcon icon component
 *
 * @example
 * ```tsx
 * import { DoubleGlazingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DoubleGlazingIcon />
 *
 * // With custom size and color
 * <DoubleGlazingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DoubleGlazingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DoubleGlazingIcon = ({
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
        <title>{ariaLabel || 'Double Glazing'}</title>
        <rect
            width="18"
            height="18"
            x="3"
            y="3"
            rx="2"
        />
    </svg>
);
