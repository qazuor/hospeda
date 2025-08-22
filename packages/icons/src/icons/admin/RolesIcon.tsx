import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RolesIcon icon component
 *
 * @example
 * ```tsx
 * import { RolesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RolesIcon />
 *
 * // With custom size and color
 * <RolesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RolesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RolesIcon = ({
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
        <title>{ariaLabel || 'Roles'}</title>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);
