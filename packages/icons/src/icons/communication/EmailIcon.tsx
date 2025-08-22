import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * EmailIcon icon component
 *
 * @example
 * ```tsx
 * import { EmailIcon } from '@repo/icons';
 *
 * // Basic usage
 * <EmailIcon />
 *
 * // With custom size and color
 * <EmailIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <EmailIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const EmailIcon = ({
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
        <title>{ariaLabel || 'Email'}</title>
        <rect
            width="20"
            height="16"
            x="2"
            y="4"
            rx="2"
        />
        <path d="m22 7-10 5L2 7" />
    </svg>
);
