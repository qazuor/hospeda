import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FanIcon icon component
 *
 * @example
 * ```tsx
 * import { FanIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FanIcon />
 *
 * // With custom size and color
 * <FanIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FanIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FanIcon = ({
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
        <title>{ariaLabel || 'Fan'}</title>
        <path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z" />
        <path d="M12 12v.01" />
    </svg>
);
