import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ConfirmIcon icon component
 *
 * @example
 * ```tsx
 * import { ConfirmIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ConfirmIcon />
 *
 * // With custom size and color
 * <ConfirmIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ConfirmIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ConfirmIcon = ({
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
        <title>{ariaLabel || 'Confirm'}</title>
        <path d="M20 6 9 17l-5-5" />
    </svg>
);
