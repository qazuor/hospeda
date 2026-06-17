/**
 * @file apps/mobile/src/components/icons/index.ts
 * @description Typed icon wrapper for the Hospeda mobile app (T-008).
 *
 * ## Why this file exists
 *
 * ADR-034 (decision #2) locks the mobile app to `phosphor-react-native` for
 * all iconography. Importing `@repo/icons` is explicitly banned by the
 * `noRestrictedImports` rule in `apps/mobile/biome.json` — it uses DOM SVGs
 * that crash React Native's JS engine.
 *
 * This module provides:
 * 1. A curated re-export of the Phosphor icons used across the app (import
 *    from one stable location instead of scattering phosphor imports).
 * 2. Re-exported type aliases (`PhosphorIconProps`, `PhosphorIconWeight`,
 *    `PhosphorIcon`) so callers never need to import from phosphor directly.
 * 3. A `ICON_DEFAULTS` constant that pins the design-system values used as
 *    fallbacks when callers omit `color`, `size`, or `weight`.
 *
 * ## Defaults
 *
 * | prop    | value                                   | source                             |
 * |---------|------------------------------------------|------------------------------------|
 * | `color` | `theme.colors.neutral[700]` = `#2e2e2e` | neutral near-black (body text)     |
 * | `size`  | `theme.spacing[6]` = `24`               | 24 px — standard touch-target icon |
 * | `weight`| `'regular'`                             | standard Phosphor weight           |
 *
 * ## Usage
 *
 * ```tsx
 * import { HouseIcon, SearchIcon, ICON_DEFAULTS } from '../components/icons';
 *
 * // With all defaults
 * <HouseIcon />
 *
 * // Override individual props
 * <SearchIcon color={theme.colors.river[500]} size={20} weight="bold" />
 *
 * // Build a themed icon list entry
 * const size = ICON_DEFAULTS.size; // 24
 * ```
 *
 * ## Adding icons
 *
 * Import the desired Phosphor component from `phosphor-react-native` and
 * re-export it here under a `*Icon` alias. Keep the list sorted alphabetically.
 * Do NOT import from `@repo/icons`.
 *
 * @see https://github.com/duongdev/phosphor-react-native — icon catalogue
 * @module icons
 */

// ============================================================================
// Phosphor type re-exports — callers use these instead of importing from the
// phosphor package directly, keeping the dependency boundary in one file.
// ============================================================================

export type {
    /** Props accepted by every Phosphor icon component. */
    IconProps as PhosphorIconProps,
    /** The five weight variants: thin | light | regular | bold | fill | duotone */
    IconWeight as PhosphorIconWeight,
    /** The React.FC type alias for any Phosphor icon. */
    Icon as PhosphorIcon
} from 'phosphor-react-native';

// ============================================================================
// Design-system defaults
// ============================================================================

import { theme } from '../../design';

/**
 * Design-system defaults for icon props.
 *
 * Spread these into a Phosphor icon when you want the standard Hospeda style:
 *
 * ```tsx
 * <UserIcon {...ICON_DEFAULTS} />
 * // equivalent to:
 * <UserIcon color="#2e2e2e" size={24} weight="regular" />
 * ```
 *
 * Override individual props to deviate from the defaults:
 *
 * ```tsx
 * <HeartIcon {...ICON_DEFAULTS} color={theme.colors.danger[500]} size={20} />
 * ```
 */
export const ICON_DEFAULTS = {
    /**
     * Default icon color: neutral[700] (#2e2e2e).
     *
     * Chosen as the near-black body-text color so icons are legible at
     * standard contrast on a white (#ffffff) background without being
     * as stark as pure black.
     */
    color: theme.colors.neutral[700],

    /**
     * Default icon size in pixels: spacing[6] = 24.
     *
     * 24 px is the standard touch-target minimum for small icons in
     * Material Design and Apple HIG. Larger icons (32 px, spacing[8])
     * suit hero / empty-state use.
     */
    size: theme.spacing[6],

    /**
     * Default Phosphor weight: 'regular'.
     *
     * Regular provides clean, legible strokes at 24 px. Use 'bold' for
     * emphasis or at smaller sizes (≤ 16 px); 'fill' for active/selected state.
     */
    weight: 'regular'
} as const;

// ============================================================================
// Curated icon re-exports — starter set for Phase-1 screens.
//
// IMPORTANT: import each icon from its per-file subpath
// (`phosphor-react-native/src/icons/<Name>`), NOT the package barrel
// (`phosphor-react-native`). Metro does not tree-shake, so importing from the
// barrel pulls in ALL ~1500 icons (+6 MB bundle / +3000 modules — measured:
// barrel = 11 MB / 4462 modules, subpath = 5.1 MB). The subpath exports
// (`'./src/icons/*'` in the package `exports`) resolve to a single component
// file. Each icon file NAMED-exports its component (not a default export).
//
// Sorted alphabetically by alias. To add an icon, copy the pattern with the
// Phosphor component's file name under `src/icons/`.
// ============================================================================

// Navigation / tabs
export { House as HouseIcon } from 'phosphor-react-native/src/icons/House';
export { MagnifyingGlass as SearchIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
export { Heart as HeartIcon } from 'phosphor-react-native/src/icons/Heart';
export { User as UserIcon } from 'phosphor-react-native/src/icons/User';
export { Bell as BellIcon } from 'phosphor-react-native/src/icons/Bell';
// Navigation actions
export { CaretLeft as CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
export { SignOut as SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
// Content / listing details
export { MapPin as MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
export { Star as StarIcon } from 'phosphor-react-native/src/icons/Star';
export { Calendar as CalendarIcon } from 'phosphor-react-native/src/icons/Calendar';
export { Users as GuestsIcon } from 'phosphor-react-native/src/icons/Users';
// Utility / affordance
export { Info as InfoIcon } from 'phosphor-react-native/src/icons/Info';
export { Warning as WarningIcon } from 'phosphor-react-native/src/icons/Warning';
export { X as CloseIcon } from 'phosphor-react-native/src/icons/X';
export { ShareNetwork as ShareIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
export { SlidersHorizontal as FiltersIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
// Host management
export { Buildings as BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
// Conversations / inbox
export { ChatCircle as ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
// Metrics / analytics
export { ChartBar as ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
