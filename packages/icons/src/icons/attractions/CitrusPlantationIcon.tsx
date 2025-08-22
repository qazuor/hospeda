import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CitrusPlantationIcon icon component
 *
 * @example
 * ```tsx
 * import { CitrusPlantationIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CitrusPlantationIcon />
 *
 * // With custom size and color
 * <CitrusPlantationIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CitrusPlantationIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CitrusPlantationIcon = ({
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
        <title>{ariaLabel || 'Citrus Plantation'}</title>
        <path d="M12 8a6 6 0 0 0-6 6c0 1 2 3 6 3s6-2 6-3a6 6 0 0 0-6-6Z" />
        <path d="M12 2v6" />
        <path d="m8 8-4.5-4.5" />
        <path d="m16 8 4.5-4.5" />
    </svg>
);
