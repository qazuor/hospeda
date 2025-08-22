import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ColumnIcon icon component
 *
 * @example
 * ```tsx
 * import { ColumnIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ColumnIcon />
 *
 * // With custom size and color
 * <ColumnIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ColumnIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ColumnIcon = ({
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
        <title>{ariaLabel || 'Column'}</title>
        <rect
            width="18"
            height="18"
            x="3"
            y="3"
            rx="2"
        />
        <path d="M12 3v18" />
    </svg>
);
