import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AlertTriangleIcon icon component
 *
 * @example
 * ```tsx
 * import { AlertTriangleIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AlertTriangleIcon />
 *
 * // With custom size and color
 * <AlertTriangleIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AlertTriangleIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AlertTriangleIcon = ({
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
        <title>{ariaLabel || 'Alert Triangle'}</title>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="m12 17 .01 0" />
    </svg>
);
