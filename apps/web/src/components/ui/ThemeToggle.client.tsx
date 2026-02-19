import { MoonIcon, SunIcon } from '@repo/icons';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

/**
 * ThemeToggle component
 *
 * Toggles between light and dark mode by updating the `data-theme` attribute
 * on the `<html>` element. Reads initial theme from localStorage or OS preference,
 * and persists selection to localStorage.
 *
 * @example
 * ```astro
 * <ThemeToggle client:idle />
 * ```
 */
export interface ThemeToggleProps {
    readonly initialTheme?: 'light' | 'dark';
}

/**
 * Theme toggle button for switching between light and dark mode
 *
 * @param props - Component props
 * @param props.initialTheme - Initial theme value (optional)
 * @returns Theme toggle button component
 */
export function ThemeToggle({ initialTheme }: ThemeToggleProps): JSX.Element {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        // First: Check for initialTheme prop
        if (initialTheme) {
            return initialTheme;
        }

        // Second: Check localStorage
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('hospeda-theme') as 'light' | 'dark' | null;
            if (stored === 'light' || stored === 'dark') {
                return stored;
            }

            // Third: Check OS preference
            if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        }

        // Default: light
        return 'light';
    });

    // Update data-theme attribute and localStorage on theme change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('hospeda-theme', theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="rounded p-2 text-text-secondary transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
            {isDark ? (
                <SunIcon
                    size="sm"
                    weight="regular"
                    aria-hidden="true"
                />
            ) : (
                <MoonIcon
                    size="sm"
                    weight="regular"
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
