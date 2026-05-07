/**
 * @file BridgeIcon.tsx
 * @description Custom hand-crafted SVG icon depicting a bridge silhouette.
 *
 * Used as a cross-OS-consistent replacement for the bridge emoji (🌉),
 * which renders inconsistently across platforms (Windows / Linux fallback
 * fonts often produce a tofu glyph or stylistically different artwork).
 *
 * Phosphor Icons does not currently expose a "Bridge" glyph, so this icon
 * is hand-crafted instead of going through `createPhosphorIcon`. The
 * surface API still mirrors the rest of `@repo/icons`: it accepts the
 * standard `IconProps` (size, color, weight, etc.) for drop-in usage.
 *
 * The artwork is a simplified girder / suspension bridge: a curved upper
 * cable, a horizontal deck, and four vertical struts.
 */
import { ICON_SIZES } from '../../types';
import type { IconProps } from '../../types';

/**
 * Bridge icon. See module description for design rationale.
 */
export function BridgeIcon({
    size = 'md',
    color = 'currentColor',
    weight = 'regular',
    mirrored = false,
    className = '',
    'aria-label': ariaLabel,
    duotoneColor: _duotoneColor,
    ...props
}: IconProps) {
    const resolvedSize = typeof size === 'string' ? ICON_SIZES[size] : size;
    const strokeWidth =
        weight === 'bold' ? 2.5 : weight === 'thin' ? 1 : weight === 'light' ? 1.5 : 2;
    const fill = weight === 'fill' ? color : 'none';

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={resolvedSize}
            height={resolvedSize}
            viewBox="0 0 24 24"
            fill={fill}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            role="img"
            aria-label={ariaLabel ?? 'bridge icon'}
            style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
            {...props}
        >
            {/* Upper cable / arc */}
            <path d="M2 8c4-3 16-3 20 0" />
            {/* Bridge deck */}
            <path d="M2 16h20" />
            {/* Vertical struts */}
            <path d="M5 16V8" />
            <path d="M9 16v-5" />
            <path d="M15 16v-5" />
            <path d="M19 16V8" />
        </svg>
    );
}

BridgeIcon.displayName = 'BridgeIcon';
