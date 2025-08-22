import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AccessibilityFriendlyIcon icon component
 *
 * @example
 * ```tsx
 * import { AccessibilityFriendlyIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AccessibilityFriendlyIcon />
 *
 * // With custom size and color
 * <AccessibilityFriendlyIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AccessibilityFriendlyIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AccessibilityFriendlyIcon = ({
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
        <title>{ariaLabel || 'Accessibility Friendly'}</title>
        <circle
            cx="16"
            cy="4"
            r="1"
        />
        <path d="m18 19 1-7-6 1" />
        <path d="m5 8 3-3 5.5 3-2.36 3.5" />
        <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
        <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </svg>
);
