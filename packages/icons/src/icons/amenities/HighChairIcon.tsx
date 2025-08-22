import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HighChairIcon icon component
 *
 * @example
 * ```tsx
 * import { HighChairIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HighChairIcon />
 *
 * // With custom size and color
 * <HighChairIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HighChairIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HighChairIcon = ({
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
        <title>{ariaLabel || 'High Chair'}</title>
        <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
        <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" />
        <path d="M6 18v3" />
        <path d="M18 18v3" />
    </svg>
);
