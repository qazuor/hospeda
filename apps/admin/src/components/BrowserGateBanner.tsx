/**
 * BrowserGateBanner Component
 *
 * SPEC-176 T-008 — Informational gate for staff on browsers that cannot render
 * the admin panel (Tailwind v4 floor: Chrome 111 / Firefox 128 / Safari 16.4).
 *
 * Detection is capability-based via `CSS.supports()` (NEVER User-Agent parsing,
 * per PDR Rule 3): it probes the two CSS features the admin's styling depends on
 * and that gate the Chrome-111 floor — relative color syntax (`oklch(from ...)`)
 * and `color-mix()`. If either is missing, the browser cannot render the panel
 * correctly and the banner is shown.
 *
 * The banner uses INLINE styles for its own critical colors so it stays legible
 * even when the surrounding Tailwind/oklch CSS is broken on the old browser. It
 * is session-dismissible (sessionStorage, NOT localStorage — D8): a dismissed
 * banner reappears on the next browser session / page reload, because the
 * problem is never "solved" until the browser is updated.
 *
 * @module BrowserGateBanner
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useCallback, useEffect, useState } from 'react';

/** sessionStorage flag key for a within-session dismissal. */
const DISMISS_KEY = 'browserGateDismissed';

/** Chrome download URL for the upgrade CTA. */
const CHROME_URL = 'https://www.google.com/chrome/';

/** Support contact for staff locked below the floor by IT policy (PDR §11). */
const SUPPORT_HREF = 'mailto:soporte@hospeda.com.ar';

/**
 * Returns `true` when the current browser supports the CSS capabilities the
 * admin panel requires. Capability-based (no UA sniffing). Safe to call in any
 * environment: returns `true` (supported) when `CSS`/`CSS.supports` is absent
 * so the gate never fires spuriously during SSR or in non-DOM contexts.
 */
function browserMeetsAdminFloor(): boolean {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
        return true;
    }
    return (
        CSS.supports('color', 'oklch(from white l c h)') &&
        CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')
    );
}

/**
 * Sticky, self-styled banner shown at the top of every admin page when the
 * browser is below the supported floor and the user has not dismissed it this
 * session. Renders `null` when the browser is supported or the session flag is
 * set.
 *
 * @returns The banner JSX, or `null` when it should not be shown.
 */
export function BrowserGateBanner() {
    const { t } = useTranslations();
    // Default to hidden so the banner never flashes on supported browsers or
    // during SSR; the effect flips it on only when detection fails client-side.
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
        setShouldShow(!dismissed && !browserMeetsAdminFloor());
    }, []);

    const handleDismiss = useCallback(() => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setShouldShow(false);
    }, []);

    if (!shouldShow) {
        return null;
    }

    return (
        <div
            role="alert"
            aria-live="polite"
            // Inline styles (not Tailwind) so the banner is legible on Chrome 109
            // where the panel's oklch-based CSS is broken. Tailwind classes below
            // are progressive enhancement for modern browsers.
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 16px',
                backgroundColor: '#fef3c7',
                borderBottom: '2px solid #d97706',
                color: '#78350f',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong style={{ fontWeight: 600 }}>
                    {t('admin-common.browserGate.title' as TranslationKey)}
                </strong>
                <span>{t('admin-common.browserGate.message' as TranslationKey)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <a
                    href={CHROME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#78350f', fontWeight: 600, textDecoration: 'underline' }}
                >
                    {t('admin-common.browserGate.upgradeLink' as TranslationKey)}
                </a>
                <a
                    href={SUPPORT_HREF}
                    style={{ color: '#78350f', fontWeight: 600, textDecoration: 'underline' }}
                >
                    {t('admin-common.browserGate.contactSupport' as TranslationKey)}
                </a>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label={t('admin-common.browserGate.dismiss' as TranslationKey)}
                    style={{
                        cursor: 'pointer',
                        border: '1px solid #d97706',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: '#78350f',
                        fontWeight: 600,
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '4px 9px'
                    }}
                >
                    {'×'}
                </button>
            </div>
        </div>
    );
}
