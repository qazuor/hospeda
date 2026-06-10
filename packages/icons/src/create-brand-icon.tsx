/**
 * Factory function to create @repo/icons-compatible wrappers around custom
 * single-color brand SVGs (e.g. payment provider logos that aren't part of
 * the Phosphor icon set).
 *
 * Each wrapper:
 * - Accepts a subset of `IconProps`: size, color, className, aria-label, and
 *   any additional SVG attributes.
 * - Maps size keys ('xs', 'sm', 'md', 'lg', 'xl') to pixel values via
 *   ICON_SIZES; numbers are passed through as-is.
 * - Defaults to `currentColor` so the brand mark picks up the surrounding
 *   text color (so consumers can theme it via CSS).
 * - Renders the SVG inline so consumers can server-render in Astro without
 *   hydration, identical to the Phosphor wrappers.
 *
 * Weight / duotone / mirrored props are ignored — brand marks are single-color
 * and have fixed orientation, so honoring those props would only produce
 * misleading variants.
 *
 * @example
 * ```tsx
 * const visaPath = (
 *   <path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775..." />
 * );
 * export const VisaIcon = createBrandIcon(visaPath, 'Visa');
 * ```
 */
import type { ReactNode } from 'react';
import { ICON_SIZES } from './types';
import type { IconProps } from './types';

/** Options for customizing a brand-icon wrapper. */
interface CreateBrandIconOptions {
    /**
     * SVG `viewBox` attribute. Defaults to `'0 0 24 24'`, which matches the
     * upstream simpleicons.org coordinate system used by every payment mark
     * in this package today.
     */
    readonly viewBox?: string;
    /** CSS class applied by default. Merged with the consumer's className. */
    readonly defaultClassName?: string;
}

/**
 * Creates an IconProps-compatible wrapper around an inline SVG payload.
 *
 * @param children - The SVG children (paths, groups, etc.) that compose the mark
 * @param displayName - Name used for `displayName`, `<title>`, and default aria-label
 * @param options - Optional viewBox / defaultClassName
 */
export function createBrandIcon(
    children: ReactNode,
    displayName: string,
    options?: CreateBrandIconOptions
) {
    const { viewBox = '0 0 24 24', defaultClassName } = options ?? {};

    const BrandIcon = ({
        size = 'md',
        color = 'currentColor',
        className = '',
        'aria-label': ariaLabel,
        // Explicitly drop Phosphor-only props so they don't leak as DOM attrs.
        weight: _weight,
        duotoneColor: _duotoneColor,
        mirrored: _mirrored,
        ...props
    }: IconProps) => {
        const resolvedSize = typeof size === 'string' ? ICON_SIZES[size] : size;
        const mergedClassName = defaultClassName
            ? `${defaultClassName} ${className}`.trim()
            : className;

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox={viewBox}
                width={resolvedSize}
                height={resolvedSize}
                fill={color}
                role="img"
                aria-label={ariaLabel || `${displayName} icon`}
                className={mergedClassName}
                {...props}
            >
                <title>{displayName}</title>
                {children}
            </svg>
        );
    };

    BrandIcon.displayName = displayName;
    return BrandIcon;
}
