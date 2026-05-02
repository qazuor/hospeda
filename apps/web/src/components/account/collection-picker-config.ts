/**
 * @file collection-picker-config.ts
 * @description Static config + focus-trap helper for CreateEditCollectionModal.
 * Extracted to keep the modal file under 500 lines.
 */

import {
    BookmarkIcon,
    BuildingsIcon,
    CalendarIcon,
    CompassIcon,
    DollarSignIcon,
    EventIcon,
    FavoriteIcon,
    LocationIcon,
    MapIcon,
    StarIcon,
    SunIcon,
    TreeIcon,
    UsersIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

// ─── Color palette ────────────────────────────────────────────────────────────

/**
 * A single entry in the predefined color palette.
 */
export interface ColorEntry {
    /** Hex color value to apply as background on the swatch */
    readonly hex: string;
    /** Human-readable label for ARIA (Spanish) */
    readonly label: string;
}

/**
 * Predefined palette of 10 colors for collection theming.
 * The "none" / "auto" option is handled separately in the component.
 */
export const COLOR_PALETTE: readonly ColorEntry[] = [
    { hex: '#FF5722', label: 'Naranja profundo' },
    { hex: '#E91E63', label: 'Rosa' },
    { hex: '#9C27B0', label: 'Púrpura' },
    { hex: '#3F51B5', label: 'Índigo' },
    { hex: '#03A9F4', label: 'Celeste' },
    { hex: '#009688', label: 'Verde azulado' },
    { hex: '#4CAF50', label: 'Verde' },
    { hex: '#FFC107', label: 'Ámbar' },
    { hex: '#FF9800', label: 'Naranja' },
    { hex: '#795548', label: 'Marrón' }
] as const;

// ─── Icon registry ────────────────────────────────────────────────────────────

/**
 * Minimal props accepted by every icon component from @repo/icons.
 */
export interface IconBaseProps {
    readonly size?: number;
    readonly weight?: string;
    readonly 'aria-hidden'?: boolean | 'true' | 'false';
}

/**
 * A single entry in the curated icon set for the icon picker.
 */
export interface IconEntry {
    /** Unique string key stored in the collection's `icon` field */
    readonly key: string;
    /** Human-readable label for ARIA (Spanish) */
    readonly label: string;
    /** The icon component from @repo/icons */
    // biome-ignore lint/suspicious/noExplicitAny: icon components have heterogeneous prop types
    readonly Component: ComponentType<any>;
}

/**
 * Curated subset of 13 icons available in the icon picker.
 * All icons are sourced from @repo/icons — no inline SVGs.
 */
export const ICON_OPTIONS: readonly IconEntry[] = [
    { key: 'favorite', label: 'Favorito', Component: FavoriteIcon },
    { key: 'star', label: 'Estrella', Component: StarIcon },
    { key: 'bookmark', label: 'Marcador', Component: BookmarkIcon },
    { key: 'location', label: 'Ubicación', Component: LocationIcon },
    { key: 'map', label: 'Mapa', Component: MapIcon },
    { key: 'compass', label: 'Brújula', Component: CompassIcon },
    { key: 'calendar', label: 'Calendario', Component: CalendarIcon },
    { key: 'users', label: 'Personas', Component: UsersIcon },
    { key: 'buildings', label: 'Edificios', Component: BuildingsIcon },
    { key: 'tree', label: 'Naturaleza', Component: TreeIcon },
    { key: 'sun', label: 'Sol', Component: SunIcon },
    { key: 'dollar', label: 'Economía', Component: DollarSignIcon },
    { key: 'event', label: 'Evento', Component: EventIcon }
] as const;

// ─── Focus-trap helper ────────────────────────────────────────────────────────

/**
 * CSS selector that matches all keyboard-focusable elements.
 * Used by the focus-trap inside CreateEditCollectionModal.
 */
export const FOCUSABLE_SELECTORS =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container element while a modal is open.
 * Cycles focus between the first and last focusable descendants on Tab/Shift+Tab.
 *
 * @param container - The element that should contain focus.
 * @param event     - The keydown event to handle.
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    if (event.key === 'Tab') {
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }
}
