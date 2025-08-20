import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DarkThemeIcon icon component
 *
 * @example
 * ```tsx
 * import { DarkThemeIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DarkThemeIcon />
 *
 * // With custom size and color
 * <DarkThemeIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DarkThemeIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DarkThemeIcon = ({
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
        <title>{ariaLabel || 'Darktheme'}</title>
        <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </svg>
);
