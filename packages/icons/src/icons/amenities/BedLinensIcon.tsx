import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BedLinensIcon icon component
 *
 * @example
 * ```tsx
 * import { BedLinensIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BedLinensIcon />
 *
 * // With custom size and color
 * <BedLinensIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BedLinensIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BedLinensIcon = ({
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
        <title>{ariaLabel || 'Bedlinens'}</title>
        <path d="M2 4v16" />
        <path d="M2 8h18a2 2 0 0 1 2 2v10" />
        <path d="M2 17h20" />
        <path d="M6 8v9" />
    </svg>
);
