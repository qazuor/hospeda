import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HistoricPalaceIcon icon component
 *
 * @example
 * ```tsx
 * import { HistoricPalaceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HistoricPalaceIcon />
 *
 * // With custom size and color
 * <HistoricPalaceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HistoricPalaceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HistoricPalaceIcon = ({
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
        <title>{ariaLabel || 'Historic Palace'}</title>
        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519L20.69 9.5h1.81a.5.5 0 0 1 .5.5v11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V10a.5.5 0 0 1 .5-.5h1.81L2.02 6.019a.5.5 0 0 1 .798-.519L7.094 9.164a1 1 0 0 0 1.516-.294L11.562 3.266Z" />
    </svg>
);
