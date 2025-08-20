import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * InternationalAdaptersIcon icon component
 *
 * @example
 * ```tsx
 * import { InternationalAdaptersIcon } from '@repo/icons';
 *
 * // Basic usage
 * <InternationalAdaptersIcon />
 *
 * // With custom size and color
 * <InternationalAdaptersIcon size="lg" color="#10B981" />
 *
 * // With Tailwind classes
 * <InternationalAdaptersIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const InternationalAdaptersIcon = ({
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
        <title>{ariaLabel || 'International Adapters'}</title>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        <circle
            cx="7"
            cy="9"
            r="1"
        />
        <circle
            cx="17"
            cy="15"
            r="1"
        />
        <path d="M5 5v2" />
        <path d="M19 17v2" />
    </svg>
);
