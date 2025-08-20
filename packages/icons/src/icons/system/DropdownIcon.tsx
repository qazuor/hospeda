import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DropdownIcon icon component
 *
 * @example
 * ```tsx
 * import { DropdownIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DropdownIcon />
 *
 * // With custom size and color
 * <DropdownIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DropdownIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DropdownIcon = ({
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
        <title>{ariaLabel || 'Dropdown'}</title>
        <path d="m6 9 6 6 6-6" />
    </svg>
);
