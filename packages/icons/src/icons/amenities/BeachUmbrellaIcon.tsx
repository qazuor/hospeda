import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BeachUmbrellaIcon icon component
 *
 * @example
 * ```tsx
 * import { BeachUmbrellaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BeachUmbrellaIcon />
 *
 * // With custom size and color
 * <BeachUmbrellaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BeachUmbrellaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BeachUmbrellaIcon = ({
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
        <title>{ariaLabel || 'Beach Umbrella'}</title>
        <path d="M2 12a10 10 0 1 1 20 0Z" />
        <path d="M12 12v8a2 2 0 0 0 4 0" />
        <path d="M8 12a2 2 0 1 0 4 4" />
        <path d="M12 2v2" />
    </svg>
);
