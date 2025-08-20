import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CloseIcon component
 *
 * @example
 * ```tsx
 * import { CloseIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CloseIcon />
 *
 * // With custom size and color
 * <CloseIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CloseIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CloseIcon = ({
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
        aria-label={ariaLabel || 'close icon'}
        {...props}
    >
        <title>{ariaLabel || 'Close'}</title>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);
