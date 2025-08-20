import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RefrigeratorIcon icon component
 *
 * @example
 * ```tsx
 * import { RefrigeratorIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RefrigeratorIcon />
 *
 * // With custom size and color
 * <RefrigeratorIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RefrigeratorIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RefrigeratorIcon = ({
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
        <title>{ariaLabel || 'Refrigerator'}</title>
        <path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" />
        <path d="M5 10h14" />
        <path d="M15 7v6" />
    </svg>
);
