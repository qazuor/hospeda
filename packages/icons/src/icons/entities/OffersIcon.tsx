import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * OffersIcon icon component
 *
 * @example
 * ```tsx
 * import { OffersIcon } from '@repo/icons';
 *
 * // Basic usage
 * <OffersIcon />
 *
 * // With custom size and color
 * <OffersIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <OffersIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const OffersIcon = ({
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
        <title>{ariaLabel || 'Offers'}</title>
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle
            cx="7.5"
            cy="7.5"
            r=".5"
            fill="currentColor"
        />
    </svg>
);
