import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SportsComplexIcon icon component
 *
 * @example
 * ```tsx
 * import { SportsComplexIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SportsComplexIcon />
 *
 * // With custom size and color
 * <SportsComplexIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SportsComplexIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SportsComplexIcon = ({
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
        <title>{ariaLabel || 'Sports Complex'}</title>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.5 4 7 4 8 4s4.5 0 5.5 0c1 0 2.5 0 3.5 0a2.5 2.5 0 0 1 0 5H15" />
        <path d="M12 12v6" />
        <path d="M8 15v3" />
        <path d="M16 15v3" />
    </svg>
);
