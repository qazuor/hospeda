import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CoveredGrillAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { CoveredGrillAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CoveredGrillAreaIcon />
 *
 * // With custom size and color
 * <CoveredGrillAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CoveredGrillAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CoveredGrillAreaIcon = ({
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
        <title>{ariaLabel || 'Covered Grill Area'}</title>
        <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
        <path d="M6 17h12" />
    </svg>
);
