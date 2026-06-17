/**
 * @file phosphor-icon-stub.d.ts
 * @description Typecheck-only stub for phosphor-react-native per-icon source subpaths (SPEC-243).
 *
 * `tsconfig.typecheck.json` maps `phosphor-react-native/src/icons/*` to this file
 * so `tsc` never type-checks phosphor's own source (`icon-base.tsx`), which fails
 * CI on a phosphor↔react-native-svg `<Svg>` prop typing mismatch we do not control.
 *
 * This is TYPECHECK-ONLY: Metro/babel-preset-expo resolves paths from the base
 * `tsconfig.json` (which does NOT contain this mapping), so the real per-icon
 * `.tsx` files are bundled at runtime — the small per-icon bundle is preserved.
 *
 * Each icon file in phosphor named-exports its component; declare each used name
 * here as `Icon`. Keep in sync with the subpath imports in
 * `src/components/icons/index.ts`.
 */
import type { Icon } from 'phosphor-react-native';

export const House: Icon;
export const MagnifyingGlass: Icon;
export const Heart: Icon;
export const User: Icon;
export const Bell: Icon;
export const CaretLeft: Icon;
export const SignOut: Icon;
export const MapPin: Icon;
export const Star: Icon;
export const Calendar: Icon;
export const Users: Icon;
export const Info: Icon;
export const Warning: Icon;
export const X: Icon;
export const ShareNetwork: Icon;
export const SlidersHorizontal: Icon;
export const Buildings: Icon;
export const ChatCircle: Icon;
