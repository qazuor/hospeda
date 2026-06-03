/**
 * @file ThemeControl.client.tsx
 * @description Segmented control for switching between light, system, and dark themes.
 *
 * Persists the user's choice to `localStorage.theme` (one of `'light'`, `'dark'`,
 * `'system'`) and applies the resolved value to `<html data-theme>`. The FOUC
 * script in `ThemeFoucScript.astro` understands all three values and resolves
 * `'system'` against `prefers-color-scheme` before the first paint, so there is
 * no flash on subsequent navigations.
 *
 * When the user picks `'system'`, the component also subscribes to OS-level
 * theme changes via `matchMedia('(prefers-color-scheme: dark)')` and updates
 * `<html data-theme>` live without requiring a reload.
 *
 * Every change dispatches a `preferences:change` CustomEvent so the guest
 * nudge island can react. Authenticated users additionally get the value
 * synced with their account through the existing PreferenceToggles flow
 * (out of scope for this component — handled by listening for the same
 * event upstream).
 */

import { cn } from '@/lib/cn';
import { MonitorIcon, MoonIcon, SunIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import styles from './ThemeControl.module.css';

type ThemeChoice = 'light' | 'system' | 'dark';

const OPTIONS: ReadonlyArray<{
    value: ThemeChoice;
    Icon: typeof SunIcon;
    label: string;
    fullLabel: string;
}> = [
    { value: 'light', Icon: SunIcon, label: 'Claro', fullLabel: 'Tema claro' },
    {
        value: 'system',
        Icon: MonitorIcon,
        label: 'Sistema',
        fullLabel: 'Seguir preferencia del sistema'
    },
    { value: 'dark', Icon: MoonIcon, label: 'Oscuro', fullLabel: 'Tema oscuro' }
];

export interface ThemeControlProps {
    /**
     * Visual layout.
     * - "navbar": condensed segmented control for the desktop navbar.
     * - "menu": full-width segmented row inside dropdowns.
     * - "mobile": stacked layout for the MobileMenu overlay.
     */
    readonly variant?: 'navbar' | 'menu' | 'mobile';
    /** Whether to show text labels next to icons. Defaults to false in navbar, true otherwise. */
    readonly showLabels?: boolean;
    /** Optional extra classes appended to the root element. */
    readonly className?: string;
}

function isThemeChoice(value: string | null): value is ThemeChoice {
    return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredChoice(): ThemeChoice {
    try {
        const stored = localStorage.getItem('theme');
        if (isThemeChoice(stored)) return stored;
    } catch {
        // Storage may be unavailable. Fall through to default.
    }
    return 'light';
}

function applyTheme(choice: ThemeChoice): void {
    const root = document.documentElement;
    const dark =
        choice === 'dark' ||
        (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (dark) {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
}

/**
 * ThemeControl - segmented light / system / dark switch.
 *
 * @example
 * ```tsx
 * <ThemeControl variant="menu" showLabels />
 * ```
 */
export function ThemeControl({
    variant = 'navbar',
    showLabels,
    className
}: ThemeControlProps): JSX.Element {
    const [choice, setChoice] = useState<ThemeChoice>('light');
    const labelsVisible = showLabels ?? variant !== 'navbar';

    useEffect(() => {
        setChoice(readStoredChoice());
    }, []);

    // When the choice is 'system', track OS-level changes live so the page
    // updates without requiring the user to refresh.
    useEffect(() => {
        if (choice !== 'system') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handle = () => applyTheme('system');
        media.addEventListener('change', handle);
        return () => {
            media.removeEventListener('change', handle);
        };
    }, [choice]);

    const handleSelect = (next: ThemeChoice) => {
        if (next === choice) return;
        setChoice(next);

        try {
            localStorage.setItem('theme', next);
        } catch {
            // Ignore storage errors.
        }

        applyTheme(next);

        window.dispatchEvent(
            new CustomEvent('preferences:change', {
                detail: { kind: 'theme', value: next }
            })
        );
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is for form controls; this is a group of toggle buttons that change document state
        <div
            role="group"
            aria-label="Tema de la interfaz"
            className={cn(styles.root, styles[`root--${variant}`], className)}
        >
            {OPTIONS.map((option) => {
                const Icon = option.Icon;
                const isActive = option.value === choice;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={isActive}
                        aria-label={option.fullLabel}
                        onClick={() => handleSelect(option.value)}
                        className={cn(styles.option, isActive && styles.optionActive)}
                    >
                        <Icon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                        {labelsVisible && <span className={styles.label}>{option.label}</span>}
                    </button>
                );
            })}
        </div>
    );
}
