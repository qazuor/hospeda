import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PhoneIcon component
 *
 * @example
 * ```tsx
 * import { PhoneIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PhoneIcon />
 *
 * // With custom size and color
 * <PhoneIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PhoneIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PhoneIcon = ({
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
        aria-label={ariaLabel || 'phone icon'}
        {...props}
    >
        <title>{ariaLabel || 'Phone'}</title>
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
);
