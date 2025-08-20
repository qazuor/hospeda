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
        <title>{ariaLabel || 'Sportscomplex'}</title>
        <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" />
        <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" />
        <path d="M18 9h1.5a1 1 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
        <path d="M6 9H4.5a1 1 0 0 1 0-5H6" />
    </svg>
);
