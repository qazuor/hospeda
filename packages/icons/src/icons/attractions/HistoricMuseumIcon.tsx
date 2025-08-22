import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HistoricMuseumIcon icon component
 *
 * @example
 * ```tsx
 * import { HistoricMuseumIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HistoricMuseumIcon />
 *
 * // With custom size and color
 * <HistoricMuseumIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HistoricMuseumIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HistoricMuseumIcon = ({
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
        <title>{ariaLabel || 'Historic Museum'}</title>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
    </svg>
);
