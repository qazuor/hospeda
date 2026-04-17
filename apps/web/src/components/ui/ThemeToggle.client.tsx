/**
 * @file ThemeToggle.client.tsx
 * @description Icon-only toggle button that switches between light and dark themes.
 *
 * Toggles `data-theme="dark"` on `<html>` and persists the preference to
 * `localStorage` under the key `'theme'`. The FOUC prevention script in
 * BaseLayout.astro reads this same key before first paint.
 *
 * Listens to the `navbar:scroll` custom event dispatched by the header scroll
 * handler so its visual style stays in sync with the navbar's current state.
 */

import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import { MoonIcon, SunIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the ThemeToggle component.
 */
export interface ThemeToggleProps {
    /**
     * Visual variant that mirrors the navbar's scroll state.
     * - "hero": transparent navbar (light text on dark/image overlay)
     * - "scrolled": opaque navbar (dark text on light background)
     * Defaults to "scrolled".
     */
    readonly variant?: 'hero' | 'scrolled';
}

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------

/**
 * ThemeToggle — icon-only button that switches between light and dark themes.
 *
 * Reads the initial theme from `localStorage.getItem('theme')` on mount.
 * On click it toggles `data-theme="dark"` on `document.documentElement`
 * and writes the new value back to `localStorage`.
 *
 * Reacts to the `navbar:scroll` custom event so its color style automatically
 * follows the header's hero/scrolled state.
 *
 * @example
 * ```astro
 * <ThemeToggle client:idle />
 * <ThemeToggle client:idle variant="hero" />
 * ```
 */
export function ThemeToggle({
    variant: initialVariant = 'scrolled'
}: ThemeToggleProps): JSX.Element {
    const [isDark, setIsDark] = useState(false);
    const [activeVariant, setActiveVariant] = useState<'hero' | 'scrolled'>(initialVariant);

    // Read initial theme from localStorage on mount (client only).
    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const dark = stored ? stored === 'dark' : prefersDark;
        setIsDark(dark);
    }, []);

    // Sync visual variant with the navbar:scroll custom event.
    useEffect(() => {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        const handleNavbarScroll = (event: Event) => {
            const customEvent = event as CustomEvent<{ scrolled: boolean }>;
            setActiveVariant(customEvent.detail.scrolled ? 'scrolled' : 'hero');
        };

        navbar.addEventListener('navbar:scroll', handleNavbarScroll);
        return () => {
            navbar.removeEventListener('navbar:scroll', handleNavbarScroll);
        };
    }, []);

    const handleToggle = () => {
        const next = !isDark;
        setIsDark(next);
        if (next) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <IconButton
            variant="ghost"
            size="sm"
            ariaLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria={{ pressed: isDark }}
            onClick={handleToggle}
            className={cn(activeVariant === 'hero' ? styles.toggleHero : styles.toggleScrolled)}
        >
            {isDark ? (
                <MoonIcon
                    size={20}
                    weight="regular"
                    aria-hidden="true"
                />
            ) : (
                <SunIcon
                    size={20}
                    weight="regular"
                    aria-hidden="true"
                />
            )}
        </IconButton>
    );
}
