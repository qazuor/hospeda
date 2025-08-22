import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MainSquareIcon icon component
 *
 * @example
 * ```tsx
 * import { MainSquareIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MainSquareIcon />
 *
 * // With custom size and color
 * <MainSquareIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MainSquareIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MainSquareIcon = ({
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
        <title>{ariaLabel || 'Main Square'}</title>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle
            cx="12"
            cy="10"
            r="3"
        />
    </svg>
);
