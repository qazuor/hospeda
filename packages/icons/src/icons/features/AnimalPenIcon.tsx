import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AnimalPenIcon icon component
 *
 * @example
 * ```tsx
 * import { AnimalPenIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AnimalPenIcon />
 *
 * // With custom size and color
 * <AnimalPenIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AnimalPenIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AnimalPenIcon = ({
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
        <title>{ariaLabel || 'Animal Pen'}</title>
        <path d="M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" />
        <path d="M6 8h4" />
        <path d="M6 18h4" />
        <path d="m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" />
        <path d="M14 8h4" />
        <path d="M14 18h4" />
        <path d="m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" />
    </svg>
);
