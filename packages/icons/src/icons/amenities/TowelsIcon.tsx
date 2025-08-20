import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * TowelsIcon icon component
 *
 * @example
 * ```tsx
 * import { TowelsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <TowelsIcon />
 *
 * // With custom size and color
 * <TowelsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <TowelsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const TowelsIcon = ({
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
        <title>{ariaLabel || 'Towels'}</title>
        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
);
