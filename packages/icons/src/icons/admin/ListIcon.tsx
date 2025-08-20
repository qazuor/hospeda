import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ListIcon icon component
 *
 * @example
 * ```tsx
 * import { ListIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ListIcon />
 *
 * // With custom size and color
 * <ListIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ListIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ListIcon = ({
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
        <title>{ariaLabel || 'List'}</title>
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
        <path d="M3 6h.01" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M8 6h13" />
    </svg>
);
