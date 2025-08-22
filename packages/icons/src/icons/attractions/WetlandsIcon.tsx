import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WetlandsIcon icon component
 *
 * @example
 * ```tsx
 * import { WetlandsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WetlandsIcon />
 *
 * // With custom size and color
 * <WetlandsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WetlandsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WetlandsIcon = ({
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
        <title>{ariaLabel || 'Wetlands'}</title>
        <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-2.26-.9 0-1.43.83-1.43 1.96 0 .96.55 1.8 1.43 1.8.96 0 1.83-.84 1.83-1.96 0-1.16-.87-2.26-1.96-2.26-.96 0-1.83.84-1.83 1.96" />
        <path d="M16 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-2.26-.9 0-1.43.83-1.43 1.96 0 .96.55 1.8 1.43 1.8.96 0 1.83-.84 1.83-1.96 0-1.16-.87-2.26-1.96-2.26-.96 0-1.83.84-1.83 1.96" />
        <path d="M2 18h20" />
    </svg>
);
