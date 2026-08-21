/**
 * @file PublishMenu.client.tsx
 * @description Header "Publicar" CTA — a three-way dropdown offering
 * accommodation, gastronomy, and experience (HOS-691).
 *
 * Replaces the single `/publicar/` link Header.astro used to render. Covers
 * BOTH the wide (≥1280) and narrow (1025-1279) breakpoints — they already
 * share one Astro tree resolved by `@media`, and this island renders inside
 * it unconditionally (no more per-role hiding, see below).
 *
 * The three options come from `PUBLISH_CTA_OPTIONS`
 * (`@/config/discovery-doors`), the same source the authenticated
 * `/mi-cuenta/publica` hub uses — never hardcode the three (label, icon,
 * href) tuples again here (HOS-691 AC-38).
 *
 * **Visibility (HOS-691 AC-12)**: the old CTA hid itself for an existing
 * HOST (`Header.astro`'s former `isAlreadyHost` check, entitlement-gated).
 * That rule does not carry over: a HOST who wants to list a restaurant is
 * exactly who this three-way chooser exists for, and the pre-auth CTA has
 * no per-option "already acquired" state to react to (see the JSDoc on
 * `PUBLISH_CTA_OPTIONS`). So this component renders unconditionally for
 * every visitor — guest, tourist, HOST, or COMMERCE_OWNER alike — and no
 * longer needs the SSR entitlements fetch Header.astro used to make.
 *
 * A11y molde copied from `UserMenu.client.tsx` (`aria-haspopup="menu"`,
 * `aria-expanded`, `role="menu"` on the panel, click-outside + Escape
 * dismissal) — NOT from `SettingsDropdown.client.tsx`, whose ARIA is
 * weaker (`aria-haspopup="true"`, `role="group"`).
 */

import { BuildingIcon, ChevronDownIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PUBLISH_CTA_OPTIONS } from '@/config/discovery-doors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './PublishMenu.module.css';

export interface PublishMenuProps {
    /** Current locale, used for localized option labels and hrefs. */
    readonly locale: SupportedLocale;
    /**
     * Extra class(es) applied to the trigger button. Header.astro passes
     * `header__cta` here so the existing `.header__cta` CSS (icon-only
     * collapse under 480px, pill sizing) keeps applying unchanged.
     */
    readonly className?: string;
}

/**
 * PublishMenu — header "Publicar" CTA, now a three-way dropdown.
 *
 * @example
 * ```astro
 * <PublishMenu client:idle locale={locale} className="header__cta" />
 * ```
 */
export function PublishMenu({ locale, className }: PublishMenuProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = createTranslations(locale);
    const triggerLabel = t('nav.publishCta', 'Publicar');

    // ── Click-outside dismissal (copied from UserMenu.client.tsx) ────────
    useEffect(() => {
        if (!isOpen) return;
        const handle = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current &&
                triggerRef.current &&
                !menuRef.current.contains(target) &&
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

    // ── Escape dismissal (copied from UserMenu.client.tsx) ───────────────
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
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={cn('btn-gradient btn-gradient--accent btn-gradient--sm', className)}
            >
                <span
                    className="gradient-btn__icon gradient-btn__icon--leading"
                    aria-hidden="true"
                >
                    <BuildingIcon
                        size={16}
                        weight="regular"
                    />
                </span>
                <span className="gradient-btn__label">{triggerLabel}</span>
                <span
                    className={cn(
                        'gradient-btn__icon gradient-btn__icon--trailing',
                        styles.chevron,
                        isOpen && styles.chevronOpen
                    )}
                    aria-hidden="true"
                >
                    <ChevronDownIcon size={14} />
                </span>
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={triggerLabel}
                    className={cn(styles.menu, 'overlay-surface')}
                >
                    <ul className={styles.menuList}>
                        {PUBLISH_CTA_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return (
                                <li key={option.id}>
                                    <a
                                        href={buildUrl({ locale, path: option.href })}
                                        role="menuitem"
                                        onClick={() => setIsOpen(false)}
                                        className={styles.menuLink}
                                    >
                                        <Icon
                                            size={18}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                        <span>{t(option.i18nKey)}</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
