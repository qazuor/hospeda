import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ContactoIcon component
 *
 * @example
 * ```tsx
 * import { ContactoIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ContactoIcon />
 *
 * // With custom size and color
 * <ContactoIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ContactoIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ContactoIcon = ({
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
        aria-label={ariaLabel || 'contacto icon'}
        {...props}
    >
        <title>{ariaLabel || 'Contacto'}</title>
        <path d="M16 2v2" />
        <path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        <path d="M8 2v2" />
        <circle
            cx="12"
            cy="11"
            r="3"
        />
        <rect
            x="3"
            y="4"
            width="18"
            height="18"
            rx="2"
        />
    </svg>
);
