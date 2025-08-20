import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ChatIcon component
 *
 * @example
 * ```tsx
 * import { ChatIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ChatIcon />
 *
 * // With custom size and color
 * <ChatIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ChatIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ChatIcon = ({
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
        aria-label={ariaLabel || 'chat icon'}
        {...props}
    >
        <title>{ariaLabel || 'Chat'}</title>
        <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </svg>
);
