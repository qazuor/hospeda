import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MunicipalParkIcon icon component
 *
 * @example
 * ```tsx
 * import { MunicipalParkIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MunicipalParkIcon />
 *
 * // With custom size and color
 * <MunicipalParkIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MunicipalParkIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MunicipalParkIcon = ({
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
        <title>{ariaLabel || 'Municipal Park'}</title>
        <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
        <path d="M7 16v6" />
        <path d="M13 19v3" />
        <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />
    </svg>
);
