/**
 * @file BridgeIcon.tsx
 * @description Custom hand-crafted SVG icon depicting a cable-stayed bridge.
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
 * The artwork is a simplified cable-stayed bridge: a central pylon
 * (vertical tower), four diagonal stays fanning out from its top, the
 * horizontal deck, and two short anchoring piers on either side.
 * Visually inspired by the Puente General Artigas (Colón–Paysandú) and
 * the Puente Internacional Libertador General San Martín
 * (Concordia–Salto) — bridges of the Argentine Litoral region.
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
            {/* Central pylon (tower) */}
            <path d="M12 4v13" />
            {/* Diagonal stays fanning out from the pylon top */}
            <path d="M12 4 5 17" />
            <path d="M12 4 9 17" />
            <path d="M12 4 15 17" />
            <path d="M12 4 19 17" />
            {/* Bridge deck */}
            <path d="M2 17h20" />
            {/* Anchoring piers below the deck */}
            <path d="M4 17v3" />
            <path d="M20 17v3" />
        </svg>
    );
}

BridgeIcon.displayName = 'BridgeIcon';
