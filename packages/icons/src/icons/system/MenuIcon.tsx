import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MenuIcon component
 *
 * @example
 * ```tsx
 * import { MenuIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MenuIcon />
 *
 * // With custom size and color
 * <MenuIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MenuIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MenuIcon = ({
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
        aria-label={ariaLabel || 'menu icon'}
        {...props}
    >
        <title>{ariaLabel || 'Menu'}</title>
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="M4 6h16" />
    </svg>
);
