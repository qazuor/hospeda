import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * KettleIcon icon component
 *
 * @example
 * ```tsx
 * import { KettleIcon } from '@repo/icons';
 *
 * // Basic usage
 * <KettleIcon />
 *
 * // With custom size and color
 * <KettleIcon size="lg" color="#EF4444" />
 *
 * // With Tailwind classes
 * <KettleIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const KettleIcon = ({
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
        <title>{ariaLabel || 'Electric Kettle'}</title>
        <path d="M11 4h6l3 7H8l3-7Z" />
        <path d="m6 15 1-2" />
        <path d="m17 15-1-2" />
        <path d="M20 2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
        <path d="M6 15a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2" />
        <path d="M12 17v4" />
        <path d="M8 17v4" />
        <path d="M16 17v4" />
    </svg>
);
