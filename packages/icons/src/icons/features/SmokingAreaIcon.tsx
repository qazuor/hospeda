import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SmokingAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { SmokingAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SmokingAreaIcon />
 *
 * // With custom size and color
 * <SmokingAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SmokingAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SmokingAreaIcon = ({
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
        <title>{ariaLabel || 'Smoking Area'}</title>
        <path d="M17.5 5A2.5 2.5 0 0 0 15 7.5 2.5 2.5 0 0 0 17.5 10a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 17.5 5Z" />
        <path d="M19 10v2a2 2 0 0 1-2 2 2 2 0 0 0-2 2v2a2 2 0 0 0 2 2 2 2 0 0 1 2 2v2" />
        <path d="M12 5v16" />
        <path d="M4.5 5A2.5 2.5 0 0 0 2 7.5 2.5 2.5 0 0 0 4.5 10 2.5 2.5 0 0 0 7 7.5 2.5 2.5 0 0 0 4.5 5Z" />
    </svg>
);
