import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FacebookIcon icon component
 *
 * @example
 * ```tsx
 * import { FacebookIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FacebookIcon />
 *
 * // With custom size and color
 * <FacebookIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FacebookIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FacebookIcon = ({
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
        fill={color}
        className={className}
        aria-label={ariaLabel}
        {...props}
    >
        <title>{ariaLabel || 'Facebook'}</title>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
);
