/**
 * @file CookieConsentBanner.client.tsx
 * @description Cookie consent banner React island.
 *
 * Shows on first visit and when the `cookie-consent:reopen` custom event fires
 * (dispatched by the footer "Cookie preferences" button).
 *
 * State is persisted as a `cookie-consent` cookie (JSON, Max-Age 1 year).
 * The banner is a fixed-position element at the bottom of the viewport to
 * avoid layout shift (CLS = 0).
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus moves to the banner on open via a ref
 * - Non-dismissable without a decision (no ESC handler)
 * - Keyboard navigable via native focus order
 */

import { getConsent, saveConsent } from '@/lib/cookie-consent';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './CookieConsentBanner.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryState {
    readonly crashReporting: boolean;
    readonly analytics: boolean;
    readonly marketing: boolean;
}

type BannerView = 'main' | 'customize';

interface CookieConsentBannerProps {
    /** Active locale for translations. */
    readonly locale: SupportedLocale;
    /** Absolute URL for the cookies policy page. */
    readonly cookiesPolicyUrl: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Cookie consent banner island.
 * Mounts silently (no render) if consent has already been given.
 * Re-opens when the global `cookie-consent:reopen` event is dispatched.
 */
export function CookieConsentBanner({ locale, cookiesPolicyUrl }: CookieConsentBannerProps) {
    const { t } = createTranslations(locale);
    const titleId = useId();
    const bannerRef = useRef<HTMLDialogElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<BannerView>('main');
    const [categories, setCategories] = useState<CategoryState>({
        crashReporting: false,
        analytics: false,
        marketing: false
    });

    // Determine initial open state and pre-fill on mount
    useEffect(() => {
        const existing = getConsent();
        if (!existing) {
            setIsOpen(true);
            return;
        }
        // Pre-fill with saved preferences (for reopen scenario)
        setCategories({
            crashReporting: existing.crashReporting,
            analytics: existing.analytics,
            marketing: existing.marketing
        });
    }, []);

    // Listen for the "reopen" custom event dispatched by the footer button
    useEffect(() => {
        function handleReopen() {
            const existing = getConsent();
            if (existing) {
                setCategories({
                    crashReporting: existing.crashReporting,
                    analytics: existing.analytics,
                    marketing: existing.marketing
                });
            }
            setView('customize');
            setIsOpen(true);
        }

        window.addEventListener('cookie-consent:reopen', handleReopen);
        return () => window.removeEventListener('cookie-consent:reopen', handleReopen);
    }, []);

    // Move focus into the banner when it opens (accessibility requirement).
    // We focus the dialog itself rather than picking a specific button so we
    // (a) don't pre-bias the user toward any choice (GDPR-friendly), and
    // (b) don't accidentally focus the inline "Más información" anchor at the
    // end of the description, which would auto-scroll the paragraph to the
    // bottom and hide the opening text. `preventScroll` is a belt-and-
    // suspenders guard for the same reason. Tab key then walks the actions.
    useEffect(() => {
        if (isOpen && bannerRef.current) {
            bannerRef.current.focus({ preventScroll: true });
        }
    }, [isOpen]);

    // Expose the live banner height as a CSS custom property on <html> so any
    // fixed-bottom UI (footer padding, scroll-to-top, feedback FAB, filter
    // trigger, view toggles, sheet triggers) can lift above it via the
    // `--bottom-safe-inset` alias defined in global.css. Setting it on
    // documentElement (not body) lets the alias declared on :root resolve
    // correctly while still allowing the `cookie-banner-open` class on body
    // to drive legacy selectors.
    useEffect(() => {
        if (!isOpen) return;
        const banner = bannerRef.current;
        if (!banner) return;

        function updateHeight() {
            if (!banner) return;
            document.documentElement.style.setProperty(
                '--cookie-banner-height',
                `${banner.offsetHeight}px`
            );
        }

        document.body.classList.add('cookie-banner-open');
        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(banner);

        return () => {
            resizeObserver.disconnect();
            document.body.classList.remove('cookie-banner-open');
            document.documentElement.style.removeProperty('--cookie-banner-height');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // ─── Handlers ─────────────────────────────────────────────────────────────

    function handleAcceptAll() {
        saveConsent({ crashReporting: true, analytics: true, marketing: true });
        setIsOpen(false);
    }

    function handleRejectAll() {
        saveConsent({ crashReporting: false, analytics: false, marketing: false });
        setIsOpen(false);
    }

    function handleSavePreferences() {
        saveConsent({
            crashReporting: categories.crashReporting,
            analytics: categories.analytics,
            marketing: categories.marketing
        });
        setIsOpen(false);
    }

    function toggleCategory(category: keyof CategoryState) {
        setCategories((prev) => ({ ...prev, [category]: !prev[category] }));
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            {/* Shared backdrop scrim (see components.css → `.overlay-base`).
             * Non-interactive: cookie consent is a forced choice, the user
             * must hit Aceptar / Rechazar / Personalizar. We render it
             * separately from the <dialog> so it can use the shared scrim
             * tokens and not couple to dialog browser defaults. */}
            <div
                className={`overlay-base overlay-light ${styles.backdrop}`}
                aria-hidden="true"
            />
            <dialog
                ref={bannerRef}
                aria-labelledby={titleId}
                open
                tabIndex={-1}
                className={styles.banner}
            >
                <div className={styles.inner}>
                    {view === 'main' ? (
                        <>
                            <div className={styles.content}>
                                <h2
                                    id={titleId}
                                    className={styles.title}
                                >
                                    {t('cookieConsent.title')}
                                </h2>
                                <p className={styles.description}>
                                    {t('cookieConsent.description')}{' '}
                                    <a
                                        href={cookiesPolicyUrl}
                                        className={styles.learnMore}
                                    >
                                        {t('cookieConsent.learnMore')}
                                    </a>
                                </p>
                            </div>
                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setView('customize')}
                                >
                                    {t('cookieConsent.buttons.customize')}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.btnGhost} ${styles.rejectMain}`}
                                    onClick={handleRejectAll}
                                >
                                    {t('cookieConsent.buttons.rejectAll')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.btnPrimary}
                                    onClick={handleAcceptAll}
                                >
                                    {t('cookieConsent.buttons.acceptAll')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.content}>
                                <h2
                                    id={titleId}
                                    className={styles.title}
                                >
                                    {t('cookieConsent.title')}
                                </h2>

                                {/* Necessary (always on) */}
                                <div className={styles.category}>
                                    <div className={styles.categoryHeader}>
                                        <span className={styles.categoryLabel}>
                                            {t('cookieConsent.categories.necessary.label')}
                                        </span>
                                        <span
                                            className={styles.alwaysOn}
                                            aria-label="always active"
                                        >
                                            {/* Lock icon via CSS pseudo */}
                                        </span>
                                    </div>
                                    <p className={styles.categoryDesc}>
                                        {t('cookieConsent.categories.necessary.description')}
                                    </p>
                                </div>

                                {/* Crash reporting */}
                                <div className={styles.category}>
                                    <div className={styles.categoryHeader}>
                                        <span className={styles.categoryLabel}>
                                            {t('cookieConsent.categories.crashReporting.label')}
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={categories.crashReporting}
                                            className={`${styles.toggle} ${categories.crashReporting ? styles.toggleOn : ''}`}
                                            onClick={() => toggleCategory('crashReporting')}
                                            aria-label={t(
                                                'cookieConsent.categories.crashReporting.label'
                                            )}
                                        >
                                            <span
                                                className={styles.toggleThumb}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                    <p className={styles.categoryDesc}>
                                        {t('cookieConsent.categories.crashReporting.description')}
                                    </p>
                                </div>

                                {/* Analytics */}
                                <div className={styles.category}>
                                    <div className={styles.categoryHeader}>
                                        <span className={styles.categoryLabel}>
                                            {t('cookieConsent.categories.analytics.label')}
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={categories.analytics}
                                            className={`${styles.toggle} ${categories.analytics ? styles.toggleOn : ''}`}
                                            onClick={() => toggleCategory('analytics')}
                                            aria-label={t(
                                                'cookieConsent.categories.analytics.label'
                                            )}
                                        >
                                            <span
                                                className={styles.toggleThumb}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                    <p className={styles.categoryDesc}>
                                        {t('cookieConsent.categories.analytics.description')}
                                    </p>
                                </div>

                                {/* Marketing */}
                                <div className={styles.category}>
                                    <div className={styles.categoryHeader}>
                                        <span className={styles.categoryLabel}>
                                            {t('cookieConsent.categories.marketing.label')}
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={categories.marketing}
                                            className={`${styles.toggle} ${categories.marketing ? styles.toggleOn : ''}`}
                                            onClick={() => toggleCategory('marketing')}
                                            aria-label={t(
                                                'cookieConsent.categories.marketing.label'
                                            )}
                                        >
                                            <span
                                                className={styles.toggleThumb}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                    <p className={styles.categoryDesc}>
                                        {t('cookieConsent.categories.marketing.description')}
                                    </p>
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.btnGhost}
                                    onClick={handleRejectAll}
                                >
                                    {t('cookieConsent.buttons.rejectAll')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.btnPrimary}
                                    onClick={handleSavePreferences}
                                >
                                    {t('cookieConsent.buttons.savePreferences')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </dialog>
        </>
    );
}
