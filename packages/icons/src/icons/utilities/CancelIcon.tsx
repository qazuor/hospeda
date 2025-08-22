import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CancelIcon icon component
 *
 * @example
 * ```tsx
 * import { CancelIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CancelIcon />
 *
 * // With custom size and color
 * <CancelIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CancelIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CancelIcon = ({
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
        <title>{ariaLabel || 'Cancel'}</title>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
    </svg>
);
