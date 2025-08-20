import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BreadcrumbsIcon icon component
 *
 * @example
 * ```tsx
 * import { BreadcrumbsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BreadcrumbsIcon />
 *
 * // With custom size and color
 * <BreadcrumbsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BreadcrumbsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BreadcrumbsIcon = ({
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
        <title>{ariaLabel || 'Breadcrumbs'}</title>
        <path d="m9 18 6-6-6-6" />
    </svg>
);
