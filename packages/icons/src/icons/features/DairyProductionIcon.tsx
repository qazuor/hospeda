import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DairyProductionIcon icon component
 *
 * @example
 * ```tsx
 * import { DairyProductionIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DairyProductionIcon />
 *
 * // With custom size and color
 * <DairyProductionIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DairyProductionIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DairyProductionIcon = ({
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
        <title>{ariaLabel || 'Dairy Production'}</title>
        <path d="M8 2h8l4 10a4 4 0 0 1-3.5 6h-9A4 4 0 0 1 4 12Z" />
        <path d="M16 8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2Z" />
    </svg>
);
