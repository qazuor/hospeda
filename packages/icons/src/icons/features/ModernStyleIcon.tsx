import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ModernStyleIcon icon component
 *
 * @example
 * ```tsx
 * import { ModernStyleIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ModernStyleIcon />
 *
 * // With custom size and color
 * <ModernStyleIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ModernStyleIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ModernStyleIcon = ({
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
        <title>{ariaLabel || 'Modernstyle'}</title>
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
);
