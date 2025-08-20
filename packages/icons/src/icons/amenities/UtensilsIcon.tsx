import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UtensilsIcon icon component
 *
 * @example
 * ```tsx
 * import { UtensilsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UtensilsIcon />
 *
 * // With custom size and color
 * <UtensilsIcon size="lg" color="#F59E0B" />
 *
 * // With Tailwind classes
 * <UtensilsIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const UtensilsIcon = ({
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
        <title>{ariaLabel || 'Kitchen Utensils'}</title>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
);
