/**
 * @file IconButton.tsx
 * @description React version of IconButton for use in React islands.
 *
 * Uses the same `.btn-icon` CSS classes from `components.css` as the Astro
 * version (`IconButton.astro`), following the same duality pattern as GradientButton.
 *
 * The `ariaLabel` prop is **required** because the button has no visible text;
 * without it screen readers have nothing to announce.
 *
 * Renders either a `<button>` or an `<a>` element depending on the `as` prop.
 *
 * @example Ghost circular md (default) — carousel navigation arrow
 * ```tsx
 * import { IconButton } from '@/components/ui/IconButton';
 * import { ChevronLeftIcon } from '@repo/icons';
 *
 * <IconButton ariaLabel="Anterior" onClick={scrollPrev} disabled={!canScrollPrev}>
 *   <ChevronLeftIcon size={20} weight="bold" aria-hidden="true" />
 * </IconButton>
 * ```
 *
 * @example Solid square lg — theme toggle with explicit size
 * ```tsx
 * import { IconButton } from '@/components/ui/IconButton';
 * import { SunIcon } from '@repo/icons';
 *
 * <IconButton
 *   ariaLabel="Cambiar a modo claro"
 *   variant="solid"
 *   size="lg"
 *   shape="square"
 *   onClick={handleToggle}
 * >
 *   <SunIcon size={24} weight="regular" aria-hidden="true" />
 * </IconButton>
 * ```
 *
 * @example Outline circle sm — rendered as anchor link
 * ```tsx
 * import { IconButton } from '@/components/ui/IconButton';
 * import { SearchIcon } from '@repo/icons';
 *
 * <IconButton
 *   as="a"
 *   href="/es/busqueda/"
 *   ariaLabel="Buscar alojamientos"
 *   variant="outline"
 *   size="sm"
 *   target="_self"
 * >
 *   <SearchIcon size={18} aria-hidden="true" />
 * </IconButton>
 * ```
 */

import type { ReactNode, Ref } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the IconButton component.
 */
export interface IconButtonProps {
    /**
     * Accessible label for the button. Required — the button has no visible text.
     * Becomes the `aria-label` attribute on the rendered element.
     */
    readonly ariaLabel: string;
    /**
     * Rendered HTML element.
     * @default 'button'
     */
    readonly as?: 'a' | 'button';
    /**
     * Destination URL. Only meaningful when `as === 'a'`.
     */
    readonly href?: string;
    /**
     * Visual style variant.
     * - `ghost`: transparent background, subtle hover fill (default)
     * - `solid`: filled with brand color, elevated shadow
     * - `outline`: visible border, fills on hover
     * @default 'ghost'
     */
    readonly variant?: 'ghost' | 'solid' | 'outline';
    /**
     * Size of the button (width & height). Icon size inside should be set
     * proportionally by the consumer.
     * - `xs`: 28px container (use icon size 16)
     * - `sm`: 32px container (use icon size 18)
     * - `md`: 40px container (use icon size 20) — default
     * - `lg`: 48px container (use icon size 24)
     * @default 'md'
     */
    readonly size?: 'xs' | 'sm' | 'md' | 'lg';
    /**
     * Border radius shape.
     * - `circle`: fully rounded pill (default)
     * - `square`: 8px corner radius (matches `--radius-button`)
     * @default 'circle'
     */
    readonly shape?: 'circle' | 'square';
    /**
     * Click handler. Only applies when `as === 'button'`.
     */
    readonly onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    /**
     * Disables the button and applies a visual disabled state.
     * Only applies when `as === 'button'`.
     */
    readonly disabled?: boolean;
    /**
     * Button type attribute. Only applies when `as === 'button'`.
     * @default 'button'
     */
    readonly type?: 'button' | 'submit' | 'reset';
    /**
     * Icon or content to render inside the button.
     * Should be a single icon component (e.g. from `@repo/icons`) with
     * `aria-hidden="true"` set on the icon element.
     */
    readonly children: ReactNode;
    /**
     * Additional CSS class names to merge onto the root element.
     */
    readonly className?: string;
    /**
     * HTML `id` attribute.
     */
    readonly id?: string;
    /**
     * Link target. Only applies when `as === 'a'`.
     * @example '_blank'
     */
    readonly target?: string;
    /**
     * Link rel attribute. Only applies when `as === 'a'`.
     * Set to `'noopener noreferrer'` when using `target="_blank"`.
     */
    readonly rel?: string;
    /**
     * Arbitrary `aria-*` attributes as a plain record.
     * Keys are used without the `aria-` prefix; it is added automatically.
     * Boolean values are explicitly stringified to `'true'` or `'false'`
     * for consistency with the Astro version (even though JSX accepts booleans
     * for aria-* natively).
     *
     * **Collision rule**: if `'label'` is included here it is silently dropped —
     * the dedicated `ariaLabel` prop always wins.
     *
     * @example { expanded: false, controls: 'mobile-menu', pressed: true }
     */
    readonly aria?: Record<string, string | boolean>;
    /**
     * Forwarded ref to the root DOM element (`<button>` or `<a>`).
     *
     * In React 19, `ref` can be passed as a regular prop. The component
     * forwards it directly to the rendered element, so `ref.current` will
     * always point to the real DOM node — not a wrapper.
     *
     * Typed as `Ref<HTMLButtonElement>` for the common `<button>` case.
     * When `as="a"`, cast the ref to `Ref<HTMLAnchorElement>` at the
     * call site if needed.
     */
    readonly ref?: Ref<HTMLButtonElement>;
    /**
     * HTML `tabIndex` attribute. Use `-1` to remove the element from the
     * natural tab order (e.g. when the element is inside a hidden overlay).
     *
     * @example tabIndex={isOpen ? 0 : -1}
     */
    readonly tabIndex?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * IconButton — accessible icon-only interactive element.
 *
 * Renders a `<button>` by default, or an `<a>` when `as="a"` is passed.
 * The `ariaLabel` prop is required for accessibility.
 *
 * Uses shared `.btn-icon` CSS classes from `components.css`.
 *
 * @example
 * ```tsx
 * <IconButton ariaLabel="Cerrar" onClick={handleClose}>
 *   <CloseIcon size={20} aria-hidden="true" />
 * </IconButton>
 * ```
 */
export function IconButton({
    ariaLabel,
    as: element = 'button',
    href,
    variant = 'ghost',
    size = 'md',
    shape = 'circle',
    onClick,
    disabled,
    type = 'button',
    children,
    className,
    id,
    target,
    rel,
    aria,
    ref,
    tabIndex
}: IconButtonProps) {
    const classes = [
        'btn-icon',
        `btn-icon--${variant}`,
        `btn-icon--${size}`,
        shape === 'square' ? 'btn-icon--shape-square' : '',
        className ?? ''
    ]
        .filter(Boolean)
        .join(' ');

    // Build aria-* spread. The 'label' key is dropped — ariaLabel prop always wins.
    const ariaAttrs: Record<string, string> = {};
    if (aria) {
        for (const [key, value] of Object.entries(aria)) {
            if (key === 'label') continue;
            ariaAttrs[`aria-${key}`] = String(value);
        }
    }

    if (element === 'a') {
        return (
            <a
                href={href}
                id={id}
                className={classes}
                aria-label={ariaLabel}
                target={target}
                rel={rel}
                tabIndex={tabIndex}
                {...ariaAttrs}
            >
                {children}
            </a>
        );
    }

    return (
        <button
            ref={ref}
            type={type}
            id={id}
            className={classes}
            aria-label={ariaLabel}
            onClick={onClick}
            disabled={disabled}
            tabIndex={tabIndex}
            {...ariaAttrs}
        >
            {children}
        </button>
    );
}
