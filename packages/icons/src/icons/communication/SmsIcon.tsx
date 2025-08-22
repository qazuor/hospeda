import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SmsIcon icon component
 *
 * @example
 * ```tsx
 * import { SmsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SmsIcon />
 *
 * // With custom size and color
 * <SmsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SmsIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const SmsIcon = ({
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
        <title>{ariaLabel || 'SMS'}</title>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);
