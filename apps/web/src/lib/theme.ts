/**
 * @file theme.ts
 * @description Single client-side module for the visitor's theme on the web
 * app (HOS-1966 / HOS-1969).
 *
 * ## The contract (one source, many readers)
 *
 * - The ONLY persisted source is `localStorage.theme`, one of `'light'`,
 *   `'dark'` or `'system'`. A missing key means `'light'`: dark is always an
 *   explicit opt-in, and a visitor who never chose keeps what they see.
 * - The ONLY thing the CSS reads is `<html data-theme="dark">`. Light is the
 *   ABSENCE of the attribute. The design tokens define no
 *   `prefers-color-scheme` rule, so nothing in a stylesheet may resolve the
 *   theme on its own.
 * - `ThemeFoucScript.astro` applies the stored choice before first paint and
 *   after every View Transitions swap. It is inline (it cannot import this
 *   module), so `theme-single-source.guard.test.ts` pins it to the same key
 *   and semantics as the functions below.
 * - React islands NEVER resolve a theme themselves: they read the stored
 *   choice with {@link readStoredThemeChoice} and only call
 *   {@link applyThemeChoice} when the USER picked something.
 *
 * Everything here is SSR-safe: outside a browser the functions are no-ops or
 * return the default.
 */

/** The three choices a visitor can store. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** `localStorage` key shared by the FOUC script and every island. */
export const THEME_STORAGE_KEY = 'theme';

/** The theme a visitor who never chose anything sees. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = 'light';

/**
 * Narrows an arbitrary value to a {@link ThemeChoice}.
 *
 * Positional on purpose: a type predicate cannot reference a destructured
 * parameter, so RO-RO does not apply here.
 *
 * @param value - Raw value (e.g. from `localStorage`).
 * @returns `true` when `value` is `'light'`, `'dark'` or `'system'`.
 */
export function isThemeChoice(value: unknown): value is ThemeChoice {
    return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Reads the visitor's stored choice, falling back to
 * {@link DEFAULT_THEME_CHOICE} when nothing valid is stored or storage is
 * unavailable.
 *
 * @returns The stored {@link ThemeChoice}.
 */
export function readStoredThemeChoice(): ThemeChoice {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemeChoice(stored)) return stored;
    } catch {
        // Storage may be blocked (private mode, disabled cookies).
    }
    return DEFAULT_THEME_CHOICE;
}

/**
 * Decides whether a choice renders dark.
 *
 * @param params.choice - The stored choice.
 * @param params.systemPrefersDark - Current `prefers-color-scheme: dark` match.
 * @returns `true` when the page must carry `data-theme="dark"`.
 */
export function resolveIsDark({
    choice,
    systemPrefersDark
}: {
    readonly choice: ThemeChoice;
    readonly systemPrefersDark: boolean;
}): boolean {
    return choice === 'dark' || (choice === 'system' && systemPrefersDark);
}

/**
 * Writes the resolved theme to `<html data-theme>` WITHOUT persisting it.
 * Light removes the attribute, matching `ThemeFoucScript.astro`.
 *
 * @param params.choice - The choice to render.
 */
export function applyThemeAttribute({ choice }: { readonly choice: ThemeChoice }): void {
    if (typeof document === 'undefined') return;
    const dark = resolveIsDark({
        choice,
        systemPrefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches
    });
    const root = document.documentElement;
    if (dark) {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
}

/**
 * Applies AND persists a choice the user just made. Call this only from a
 * handler of an explicit user gesture, never to "initialise" a default.
 *
 * @param params.choice - The choice the user picked.
 */
export function applyThemeChoice({ choice }: { readonly choice: ThemeChoice }): void {
    if (typeof document === 'undefined') return;
    applyThemeAttribute({ choice });
    try {
        localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        // Ignore storage errors: the attribute is already applied.
    }
}
