/**
 * @file phosphor-icons.d.ts
 * @description Ambient type declarations for the per-icon source subpaths of
 * `phosphor-react-native` (SPEC-243).
 *
 * ADR-033 mandates importing each icon from its source subpath
 * (`phosphor-react-native/src/icons/<Name>`) to avoid the +6 MB barrel. tsc,
 * following those imports, otherwise pulls `phosphor-react-native/src/lib/icon-base.tsx`
 * into the program and type-checks the library's own source — which fails in CI
 * (a phosphor↔react-native-svg `<Svg>` prop typing mismatch we do not control).
 *
 * These ambient declarations shadow the icon subpaths with our own typing
 * (`Icon` from the package's typed barrel), so tsc never type-checks phosphor's
 * source. This is types-only: Metro still resolves the real `.tsx` files at
 * runtime, preserving the small per-icon bundle. Keep this list in sync with the
 * subpath imports in `src/components/icons/index.ts`.
 */

declare module 'phosphor-react-native/src/icons/House' {
    import type { Icon } from 'phosphor-react-native';
    export const House: Icon;
}

declare module 'phosphor-react-native/src/icons/MagnifyingGlass' {
    import type { Icon } from 'phosphor-react-native';
    export const MagnifyingGlass: Icon;
}

declare module 'phosphor-react-native/src/icons/Heart' {
    import type { Icon } from 'phosphor-react-native';
    export const Heart: Icon;
}

declare module 'phosphor-react-native/src/icons/User' {
    import type { Icon } from 'phosphor-react-native';
    export const User: Icon;
}

declare module 'phosphor-react-native/src/icons/Bell' {
    import type { Icon } from 'phosphor-react-native';
    export const Bell: Icon;
}

declare module 'phosphor-react-native/src/icons/CaretLeft' {
    import type { Icon } from 'phosphor-react-native';
    export const CaretLeft: Icon;
}

declare module 'phosphor-react-native/src/icons/SignOut' {
    import type { Icon } from 'phosphor-react-native';
    export const SignOut: Icon;
}

declare module 'phosphor-react-native/src/icons/MapPin' {
    import type { Icon } from 'phosphor-react-native';
    export const MapPin: Icon;
}

declare module 'phosphor-react-native/src/icons/Star' {
    import type { Icon } from 'phosphor-react-native';
    export const Star: Icon;
}

declare module 'phosphor-react-native/src/icons/Calendar' {
    import type { Icon } from 'phosphor-react-native';
    export const Calendar: Icon;
}

declare module 'phosphor-react-native/src/icons/Users' {
    import type { Icon } from 'phosphor-react-native';
    export const Users: Icon;
}

declare module 'phosphor-react-native/src/icons/Info' {
    import type { Icon } from 'phosphor-react-native';
    export const Info: Icon;
}

declare module 'phosphor-react-native/src/icons/Warning' {
    import type { Icon } from 'phosphor-react-native';
    export const Warning: Icon;
}

declare module 'phosphor-react-native/src/icons/X' {
    import type { Icon } from 'phosphor-react-native';
    export const X: Icon;
}

declare module 'phosphor-react-native/src/icons/ShareNetwork' {
    import type { Icon } from 'phosphor-react-native';
    export const ShareNetwork: Icon;
}

declare module 'phosphor-react-native/src/icons/SlidersHorizontal' {
    import type { Icon } from 'phosphor-react-native';
    export const SlidersHorizontal: Icon;
}
