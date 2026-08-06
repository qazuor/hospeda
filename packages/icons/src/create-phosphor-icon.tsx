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
import type { PhosphorGlyphProps } from './sprite';
import {
    getIconSpriteBase,
    hasIconSpriteSymbol,
    iconSymbolId,
    isSpriteWeight,
    markIconSpriteGlyph
} from './sprite';
import type { IconProps, IconWeight } from './types';
import { DEFAULT_DUOTONE_COLOR, ICON_SIZES } from './types';

/**
 * Props accepted by Phosphor icon components.
 * Minimal subset needed for the wrapper.
 *
 * Declared in `./sprite` so the sprite generator, which renders these raw
 * components directly, types them exactly as this factory does.
 */
type PhosphorIconProps = PhosphorGlyphProps;

/**
 * Options for customizing the Phosphor icon wrapper.
 */
interface CreatePhosphorIconOptions {
    /** CSS class applied by default (e.g. 'animate-spin' for loaders). Merged with consumer className. */
    readonly defaultClassName?: string;
    /**
     * Weight used when the consumer does not pass one explicitly.
     * Line glyphs (plus, minus, chevrons) set this to 'regular' because
     * the default duotone secondary layer renders poorly on them.
     * Falls back to 'duotone' when unset.
     */
    readonly defaultWeight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
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
    const { defaultClassName, defaultWeight } = options ?? {};

    // Sprite symbol name of the underlying GLYPH, resolved once per wrapper.
    // Phosphor sets `displayName` on every icon (`Star` → `"StarIcon"`), which is
    // unique per glyph and shared by aliases — so two wrappers around the same
    // Phosphor icon collapse onto one symbol. The wrapper's OWN `displayName` is
    // semantic and repeats across glyphs, so it must not be used here.
    const spriteName =
        typeof PhosphorComponent.displayName === 'string' &&
        PhosphorComponent.displayName.length > 0
            ? PhosphorComponent.displayName
            : null;

    const WrappedIcon = ({
        size = 'md',
        color = 'currentColor',
        weight,
        duotoneColor = DEFAULT_DUOTONE_COLOR,
        mirrored = false,
        className = '',
        'aria-label': ariaLabel,
        ...props
    }: IconProps) => {
        const resolvedSize = typeof size === 'string' ? ICON_SIZES[size] : size;
        // Annotated (not inferred) on purpose: a literal union narrowed by the
        // `??` chain leaks into the emitted `.d.ts` of all ~480 icon modules and
        // broke the tsup dts build. Keep it widened to `IconWeight`.
        const resolvedWeight: IconWeight = weight ?? defaultWeight ?? 'duotone';
        const resolvedColor = resolvedWeight === 'duotone' ? duotoneColor : color;
        const mergedClassName = defaultClassName
            ? `${defaultClassName} ${className}`.trim()
            : className;
        const resolvedAriaLabel = ariaLabel || `${displayName} icon`;

        // Sprite branch (HOS-369 W3-6). Off unless a consumer configured a base
        // URL, so `apps/admin` — which has no sprite endpoint — is unaffected.
        // `mirrored` falls through to inline: Phosphor implements it by
        // transforming the glyph's own children, which a shared symbol cannot
        // carry. `apps/web` uses it nowhere.
        if (spriteName !== null && !mirrored && isSpriteWeight(resolvedWeight)) {
            const spriteBase = getIconSpriteBase();
            if (spriteBase !== null) {
                const symbol = iconSymbolId({ name: spriteName, weight: resolvedWeight });
                // Membership check, in ADDITION to the weight-axis one above: a
                // subset sprite (later change) will not carry a <symbol> for
                // every (glyph, weight) pair `isSpriteWeight` alone allows
                // through. A miss falls through to the inline return below —
                // same fail-safe shape as the weight check, just on the other
                // axis. `hasIconSpriteSymbol` defaults to `true` when no
                // manifest is configured, so this is a no-op today.
                if (hasIconSpriteSymbol({ symbol })) {
                    return (
                        <svg
                            width={resolvedSize}
                            height={resolvedSize}
                            // Load-bearing: `fill` is inherited, and inherited
                            // properties DO cross into the `<use>` shadow tree.
                            // Dropping it leaves the symbol's paths black, ignoring
                            // `currentColor` and the duotone brand color alike.
                            fill={resolvedColor}
                            className={mergedClassName}
                            aria-label={resolvedAriaLabel}
                            {...props}
                        >
                            <use href={`${spriteBase}#${symbol}`} />
                        </svg>
                    );
                }
            }
        }

        return (
            <PhosphorComponent
                size={resolvedSize}
                color={resolvedColor}
                weight={resolvedWeight}
                mirrored={mirrored}
                className={mergedClassName}
                aria-label={resolvedAriaLabel}
                {...props}
            />
        );
    };

    WrappedIcon.displayName = displayName;
    if (spriteName !== null) {
        markIconSpriteGlyph({
            component: WrappedIcon,
            name: spriteName,
            glyph: PhosphorComponent
        });
    }
    return WrappedIcon;
}
