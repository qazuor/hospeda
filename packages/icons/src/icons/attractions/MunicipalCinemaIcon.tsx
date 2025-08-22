import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MunicipalCinemaIcon icon component
 *
 * @example
 * ```tsx
 * import { MunicipalCinemaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MunicipalCinemaIcon />
 *
 * // With custom size and color
 * <MunicipalCinemaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MunicipalCinemaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MunicipalCinemaIcon = ({
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
        <title>{ariaLabel || 'Municipal Cinema'}</title>
        <path d="m4 4 5.5 16 6-2 5.5 16" />
        <path d="M13.5 4 18 20l6-2L19.5 2Z" />
    </svg>
);
