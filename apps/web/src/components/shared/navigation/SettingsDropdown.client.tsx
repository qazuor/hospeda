/**
 * @file SettingsDropdown.client.tsx
 * @description Compact settings dropdown for guest visitors on narrow desktop
 * widths (1025-1279px) where the standalone language switcher, theme toggle
 * and sign-in link no longer fit comfortably in the navbar.
 *
 * Renders a single ⚙️ icon button that opens a popover containing:
 *   - LanguageSwitcher
 *   - ThemeControl
 *   - "Iniciar sesión" link
 *
 * Mirrors the keyboard / dismissal behavior of UserMenu (click-outside, ESC).
 */

import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { ChevronDownIcon, SettingsIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './SettingsDropdown.module.css';

const TEXTS = {
    es: {
        openSettings: 'Abrir preferencias',
        signIn: 'Iniciar sesión',
        language: 'Idioma',
        theme: 'Tema'
    },
    en: {
        openSettings: 'Open preferences',
        signIn: 'Sign in',
        language: 'Language',
        theme: 'Theme'
    },
    pt: {
        openSettings: 'Abrir preferências',
        signIn: 'Entrar',
        language: 'Idioma',
        theme: 'Tema'
    }
} as const;

export interface SettingsDropdownProps {
    readonly locale: SupportedLocale;
    readonly currentPath: string;
    readonly variant?: 'hero' | 'scrolled';
}

export function SettingsDropdown({
    locale,
    currentPath,
    variant = 'scrolled'
}: SettingsDropdownProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const texts = TEXTS[locale] ?? TEXTS.es;

    useEffect(() => {
        if (!isOpen) return;
        const handle = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                popoverRef.current &&
                triggerRef.current &&
                !popoverRef.current.contains(target) &&
                !triggerRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handle = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handle);
        return () => {
            document.removeEventListener('keydown', handle);
        };
    }, [isOpen]);

    return (
        <div className={styles.wrapper}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={texts.openSettings}
                className={cn(
                    styles.trigger,
                    variant === 'hero' ? styles.triggerHero : styles.triggerScrolled
                )}
            >
                <SettingsIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
                <span
                    aria-hidden="true"
                    className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                >
                    <ChevronDownIcon size={12} />
                </span>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    aria-label={texts.openSettings}
                    className={styles.popover}
                >
                    <div className={styles.row}>
                        <span className={styles.label}>{texts.language}</span>
                        <LanguageSwitcher
                            locale={locale}
                            currentPath={currentPath}
                            variant="menu"
                        />
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>{texts.theme}</span>
                        <ThemeControl
                            variant="menu"
                            showLabels={false}
                        />
                    </div>
                    <a
                        href={buildUrl({ locale, path: 'auth/signin' })}
                        className={styles.signInLink}
                    >
                        {texts.signIn}
                    </a>
                </div>
            )}
        </div>
    );
}
