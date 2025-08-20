import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AskToAiIcon component
 *
 * @example
 * ```tsx
 * import { AskToAiIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AskToAiIcon />
 *
 * // With custom size and color
 * <AskToAiIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AskToAiIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AskToAiIcon = ({
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
        aria-label={ariaLabel || 'ask-to-ai icon'}
        {...props}
    >
        <title>{ariaLabel || 'Asktoai'}</title>
        <path d="M12 8V4H8" />
        <rect
            width="16"
            height="12"
            x="4"
            y="8"
            rx="2"
        />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);
