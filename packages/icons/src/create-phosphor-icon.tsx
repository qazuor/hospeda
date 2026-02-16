/**
 * Factory function to create @repo/icons-compatible wrappers around Phosphor icons.
 *
 * This bridges the gap between Phosphor's native API and the existing IconProps
 * interface used across the Hospeda platform. Each wrapper:
 * - Accepts the same IconProps as existing hand-crafted SVG icons
 * - Maps size keys ('xs', 'sm', 'md', 'lg', 'xl') to pixel values via ICON_SIZES
 * - Defaults to duotone weight with brand color #1A5FB4
 * - Forwards weight, mirrored, color, className, and aria-label to Phosphor
 * - Passes through any additional SVG props
 *
 * @example
 * ```tsx
 * import { House, SpinnerGap } from '@phosphor-icons/react';
 * import { createPhosphorIcon } from './create-phosphor-icon';
 *
 * // Basic usage (defaults to duotone weight with brand color)
 * export const HomeIcon = createPhosphorIcon(House, 'home');
 *
 * // With default animation class
 * export const LoaderIcon = createPhosphorIcon(SpinnerGap, 'loader', { defaultClassName: 'animate-spin' });
 *
 * // Consumer can override weight and duotone color:
 * <HomeIcon weight="bold" />
 * <HomeIcon duotoneColor="#E53E3E" />
 * ```
 */
import type { ComponentType } from 'react';
import { DEFAULT_DUOTONE_COLOR, ICON_SIZES } from './types';
import type { IconProps } from './types';

/**
 * Props accepted by Phosphor icon components.
 * Minimal subset needed for the wrapper.
 */
interface PhosphorIconProps {
    readonly size?: number | string;
    readonly color?: string;
    readonly weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    readonly mirrored?: boolean;
    readonly className?: string;
    readonly [key: string]: unknown;
}

/**
 * Options for customizing the Phosphor icon wrapper.
 */
interface CreatePhosphorIconOptions {
    /** CSS class applied by default (e.g. 'animate-spin' for loaders). Merged with consumer className. */
    readonly defaultClassName?: string;
}

/**
 * Creates an IconProps-compatible wrapper around a Phosphor icon component.
 *
 * @param PhosphorComponent - The Phosphor icon component to wrap
 * @param displayName - Name used for displayName and default aria-label
 * @param options - Optional configuration (defaultClassName, etc.)
 * @returns A React component that accepts IconProps
 */
export function createPhosphorIcon(
    PhosphorComponent: ComponentType<PhosphorIconProps>,
    displayName: string,
    options?: CreatePhosphorIconOptions
): ComponentType<IconProps> {
    const { defaultClassName } = options ?? {};

    const WrappedIcon = ({
        size = 'md',
        color = 'currentColor',
        weight = 'duotone',
        duotoneColor = DEFAULT_DUOTONE_COLOR,
        mirrored = false,
        className = '',
        'aria-label': ariaLabel,
        ...props
    }: IconProps) => {
        const resolvedSize = typeof size === 'string' ? ICON_SIZES[size] : size;
        const resolvedColor = weight === 'duotone' ? duotoneColor : color;
        const mergedClassName = defaultClassName
            ? `${defaultClassName} ${className}`.trim()
            : className;

        return (
            <PhosphorComponent
                size={resolvedSize}
                color={resolvedColor}
                weight={weight}
                mirrored={mirrored}
                className={mergedClassName}
                aria-label={ariaLabel || `${displayName} icon`}
                {...props}
            />
        );
    };

    WrappedIcon.displayName = displayName;
    return WrappedIcon;
}
