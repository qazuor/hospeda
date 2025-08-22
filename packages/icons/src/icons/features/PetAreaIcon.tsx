import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PetAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { PetAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PetAreaIcon />
 *
 * // With custom size and color
 * <PetAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PetAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PetAreaIcon = ({
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
        <title>{ariaLabel || 'Pet Area'}</title>
        <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" />
        <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" />
        <path d="M8 14v.5c0 .662-.336 1.24-.5 2-.207.874.5 1.5.5 2.5 0 .5-1 1.5-1 2h12c0-.5-1-1.5-1-2 0-1 .707-1.626.5-2.5-.164-.76-.5-1.338-.5-2V14" />
        <path d="M15 22v-4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" />
        <path d="M8 14a5 5 0 1 1 8 0" />
        <path d="M9 13h.01" />
        <path d="M15 13h.01" />
        <path d="M10.5 16s.5.5 1.5.5.5-.5 1.5-.5" />
    </svg>
);
