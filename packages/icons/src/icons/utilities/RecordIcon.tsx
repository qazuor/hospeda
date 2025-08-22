import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RecordIcon icon component
 *
 * @example
 * ```tsx
 * import { RecordIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RecordIcon />
 *
 * // With custom size and color
 * <RecordIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RecordIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RecordIcon = ({
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
        <title>{ariaLabel || 'Record'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <circle
            cx="12"
            cy="12"
            r="3"
        />
    </svg>
);
