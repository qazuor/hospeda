import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WhatsappIcon component
 *
 * @example
 * ```tsx
 * import { WhatsappIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WhatsappIcon />
 *
 * // With custom size and color
 * <WhatsappIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WhatsappIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WhatsappIcon = ({
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
        aria-label={ariaLabel || 'whatsapp icon'}
        {...props}
    >
        <title>{ariaLabel || 'Whatsapp'}</title>
        <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
    </svg>
);
