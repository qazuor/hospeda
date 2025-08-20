import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CentralAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { CentralAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CentralAreaIcon />
 *
 * // With custom size and color
 * <CentralAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CentralAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CentralAreaIcon = ({
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
        <title>{ariaLabel || 'Centralarea'}</title>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle
            cx="12"
            cy="10"
            r="3"
        />
    </svg>
);
