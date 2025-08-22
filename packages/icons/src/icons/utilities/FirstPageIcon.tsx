import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FirstPageIcon icon component
 *
 * @example
 * ```tsx
 * import { FirstPageIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FirstPageIcon />
 *
 * // With custom size and color
 * <FirstPageIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FirstPageIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FirstPageIcon = ({
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
        <title>{ariaLabel || 'First Page'}</title>
        <path d="m11 17-5-5 5-5" />
        <path d="m18 17-5-5 5-5" />
    </svg>
);
