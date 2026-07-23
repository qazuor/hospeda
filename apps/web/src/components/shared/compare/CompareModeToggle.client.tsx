/**
 * @file CompareModeToggle.client.tsx
 * @description React island rendering the primary "Comparar alojamientos"
 * compare-mode affordance (HOS-85 T-004). This is the discoverability fix for
 * the comparison feature: a prominent, clearly labeled toggle button — not a
 * mute icon — that flips the client-only compare-mode flag on and off.
 *
 * This component only renders the toggle. It does NOT render the selecting UI
 * (per-card {@link CompareButton}) or the floating selection bar — those are
 * unaffected by this change. It is mounted next to `ListingPageHeader` on the
 * 6 listing pages via `CompareModeControls.astro`.
 *
 * A separate `CompareModeBanner` explainer used to render alongside this
 * toggle while compare mode was active. It was removed post-review (HOS-85
 * fix): a full-width banner was too heavy for what it communicated, and the
 * toggle itself is the natural place to convey "mode is on" — so this
 * component now switches its own label and visual style (see
 * `CompareModeToggle.module.css` `[data-active="true"]`) instead of relying
 * on a sibling banner.
 *
 * **Post-review fix (HOS-85):** the toggle used to flip compare mode
 * unconditionally. It now gates on the comparison entitlement via
 * {@link useCompareGuard} BEFORE turning the mode on:
 * - While entitlements are still resolving ({@link useCompareGuard.isLoading}),
 *   the button stays enabled and a click activates compare mode optimistically
 *   (the per-card {@link CompareCardSelect} guard still gates actual selection).
 *   The toggle is deliberately NOT `disabled` while loading: a stuck `isLoading`
 *   must never permanently disable this primary control.
 * - A guest (no session) click opens {@link AuthRequiredPopover}, reusing the
 *   same component `FavoriteButton` uses for its own guest gate.
 * - An authenticated click without the entitlement opens
 *   {@link CompareUpsellPopover}, a small sibling of `AuthRequiredPopover`
 *   (see that file's header comment for why it is a sibling and not a
 *   generalization) pointing at the plans page.
 * - Only an entitled click actually calls {@link toggleCompareMode}.
 *
 * @module components/shared/compare/CompareModeToggle
 */

import { ColumnIcon } from '@repo/icons';
import { type FC, useEffect, useRef, useState } from 'react';
import { AuthRequiredPopover } from '@/components/auth/AuthRequiredPopover.client';
import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import {
    loadCompareModeFromStorage,
    toggleCompareMode,
    useCompareMode
} from '@/store/compare-store';
import styles from './CompareModeToggle.module.css';
import { CompareUpsellPopover } from './CompareUpsellPopover.client';

/** Props for the compare-mode toggle island. */
export interface CompareModeToggleProps {
    /**
     * Whether the current user is authenticated. Determines which gate
     * popover opens when a click is blocked: {@link AuthRequiredPopover} for
     * guests, {@link CompareUpsellPopover} for authenticated users on a plan
     * without the comparison entitlement. Islands cannot read `Astro.locals`
     * directly, so pages pass `Astro.locals.user` down (same pattern as
     * `FavoriteButton`'s `isAuthenticated` prop).
     */
    readonly isAuthenticated: boolean;
    /** Locale for labels. Defaults to `es`. */
    readonly locale?: SupportedLocale;
    /** Additional CSS classes forwarded to the root button element. */
    readonly className?: string;
}

/**
 * Prominent compare-mode toggle button.
 *
 * Renders a real `<button>` with `aria-pressed` reflecting
 * {@link useCompareMode}. Clicking flips the mode via {@link toggleCompareMode}.
 * Because `apps/web` is an Astro MPA, the compare-mode flag is persisted to
 * localStorage and re-hydrated on every full page load — this component
 * explicitly re-reads it via {@link loadCompareModeFromStorage} on mount so the
 * toggle reflects the correct state even if this island's script evaluates
 * after other client-side state changes in the same page lifecycle.
 *
 * While compare mode is active, the button switches its visible label from
 * the call-to-action ("Comparar alojamientos") to a compact active state
 * ("Comparando") plus the same short guidance a removed explainer banner
 * used to show in a separate element ("Elegí los alojamientos que querés
 * comparar") — the button communicates the mode change on its own, no
 * sibling banner needed (post-review HOS-85 fix).
 *
 * @param props - {@link CompareModeToggleProps}
 * @returns The compare-mode toggle button island.
 *
 * @example
 * ```astro
 * <CompareModeToggle locale={locale} client:load />
 * ```
 */
export const CompareModeToggle: FC<CompareModeToggleProps> = ({
    isAuthenticated,
    locale = 'es',
    className
}) => {
    const t = createT(locale);
    const mode = useCompareMode();
    const { canCompare, isLoading } = useCompareGuard();

    /** Whether the guest auth-required popover is currently visible. */
    const [isAuthPopoverOpen, setIsAuthPopoverOpen] = useState(false);
    /** Whether the authenticated-no-entitlement upsell popover is currently visible. */
    const [isUpsellPopoverOpen, setIsUpsellPopoverOpen] = useState(false);

    const buttonRef = useRef<HTMLButtonElement>(null);

    // Re-hydrate the compare-mode flag from localStorage on mount. The module
    // already loads it once at import time, but this call is defensive: it
    // guarantees the toggle reflects the latest persisted value regardless of
    // when this island's bundle is evaluated relative to other compare-mode
    // writes in the same page lifecycle.
    useEffect(() => {
        loadCompareModeFromStorage();
    }, []);

    const toggleLabel = t('accommodations.comparison.mode.toggleLabel', 'Comparar alojamientos');
    const activeLabel = t('accommodations.comparison.mode.activeLabel', 'Comparando');
    const activeHint = t(
        'accommodations.comparison.mode.bannerHint',
        'Elegí los alojamientos que querés comparar'
    );
    const stateLabel = mode
        ? t('accommodations.comparison.mode.on', 'Modo comparación activado')
        : t('accommodations.comparison.mode.off', 'Modo comparación desactivado');

    // Compare is a tourist feature → tourist plans page, not owner plans (BETA-200).
    const pricingHref = `/${locale}/suscriptores/turistas/`;

    /**
     * Safely resolves the current page URL for the auth return-redirect.
     * Guarded by typeof window check for SSR safety (mirrors FavoriteButton).
     */
    const returnUrl = typeof window === 'undefined' ? '' : window.location.href;

    const handleClick = (): void => {
        if (canCompare) {
            toggleCompareMode();
            return;
        }

        // Entitlements not resolved yet (transient — or, in the worst case, a
        // hung fetch): never leave this primary control unusable. Activate
        // compare mode optimistically instead of blocking. The real entitlement
        // gate still applies per-card — CompareCardSelect uses the same
        // fail-closed guard — so a user without the entitlement hits the upsell
        // when they try to actually select an accommodation. This is why the
        // button is NOT `disabled` while loading: a stuck `isLoading` must never
        // permanently disable the toggle.
        if (isLoading) {
            toggleCompareMode();
            return;
        }

        if (!isAuthenticated) {
            setIsAuthPopoverOpen(true);
            return;
        }

        setIsUpsellPopoverOpen(true);
    };

    return (
        <div className={styles.wrapper}>
            <button
                ref={buttonRef}
                type="button"
                aria-pressed={mode}
                aria-label={`${toggleLabel} — ${stateLabel}`}
                aria-busy={isLoading}
                data-active={mode ? 'true' : undefined}
                className={cn(styles.toggle, className)}
                onClick={handleClick}
            >
                <ColumnIcon
                    size={20}
                    weight={mode ? 'fill' : 'regular'}
                    aria-hidden="true"
                />
                <span className={styles.labelGroup}>
                    <span className={styles.label}>{mode ? activeLabel : toggleLabel}</span>
                    {mode && <span className={styles.hint}>{activeHint}</span>}
                </span>
            </button>

            {isAuthPopoverOpen && (
                <AuthRequiredPopover
                    anchorRef={buttonRef}
                    message={t(
                        'accommodations.comparison.gate.authMessage',
                        'Iniciá sesión para comparar alojamientos.'
                    )}
                    onClose={() => setIsAuthPopoverOpen(false)}
                    locale={locale}
                    returnUrl={returnUrl}
                />
            )}

            {isUpsellPopoverOpen && (
                <CompareUpsellPopover
                    anchorRef={buttonRef}
                    message={t(
                        'accommodations.comparison.gate.upsellMessage',
                        'Tu plan no incluye la comparación de alojamientos.'
                    )}
                    ctaLabel={t('accommodations.comparison.gate.upsellCta', 'Ver planes')}
                    ctaHref={pricingHref}
                    onClose={() => setIsUpsellPopoverOpen(false)}
                    dialogLabel={t(
                        'accommodations.comparison.upsell.title',
                        'Comparación de alojamientos'
                    )}
                    closeLabel={t('common.auth.close', 'Cerrar')}
                />
            )}
        </div>
    );
};
