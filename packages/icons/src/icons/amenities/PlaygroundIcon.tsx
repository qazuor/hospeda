import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PlaygroundIcon icon component
 *
 * @example
 * ```tsx
 * import { PlaygroundIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PlaygroundIcon />
 *
 * // With custom size and color
 * <PlaygroundIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PlaygroundIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PlaygroundIcon = ({
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
        <title>{ariaLabel || 'Playground'}</title>
        <line
            x1="6"
            x2="10"
            y1="11"
            y2="11"
        />
        <line
            x1="8"
            x2="8"
            y1="9"
            y2="13"
        />
        <line
            x1="15"
            x2="15.01"
            y1="12"
            y2="12"
        />
        <line
            x1="18"
            x2="18.01"
            y1="10"
            y2="10"
        />
        <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
);
