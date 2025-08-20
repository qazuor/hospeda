import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SpaFrontIcon icon component
 *
 * @example
 * ```tsx
 * import { SpaFrontIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SpaFrontIcon />
 *
 * // With custom size and color
 * <SpaFrontIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SpaFrontIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SpaFrontIcon = ({
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
        <title>{ariaLabel || 'Spafront'}</title>
        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
        <path d="M20 2v4" />
        <path d="M22 4h-4" />
        <circle
            cx="4"
            cy="20"
            r="2"
        />
    </svg>
);
