import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MunicipalBeachIcon icon component
 *
 * @example
 * ```tsx
 * import { MunicipalBeachIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MunicipalBeachIcon />
 *
 * // With custom size and color
 * <MunicipalBeachIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MunicipalBeachIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MunicipalBeachIcon = ({
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
        <title>{ariaLabel || 'Municipal Beach'}</title>
        <path d="M2 12a5 5 0 0 0 5 5 6 6 0 0 1 6-6c0-5 6-5 6 0a6 6 0 0 1 6 6 5 5 0 0 0 5-5" />
    </svg>
);
