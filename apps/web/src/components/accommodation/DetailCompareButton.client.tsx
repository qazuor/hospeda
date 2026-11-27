/**
 * @file DetailCompareButton.client.tsx
 * @description React island rendering an always-visible, labeled button on the
 * accommodation detail page (HOS-85 T-010) that directly toggles this single
 * accommodation in/out of the client-only comparison selection.
 *
 * Unlike {@link import('@/components/shared/compare/CompareButton.client').CompareButton}
 * — a circular icon-only button used on listing cards inside a mode-gated
 * selecting UI — the detail page shows exactly one accommodation, so there is
 * no "compare mode" here: the button toggles this accommodation directly and
 * is always visible. It reuses the same {@link useCompareGuard} entitlement +
 * limit guard so plan gating (upsell / limit toasts) behaves identically to
 * the listing button.
 *
 * Responsive note (HOS-85 post-review fix): the visible label collapses to
 * an icon-only circle below 768px (see DetailCompareButton.module.css) so it
 * does not overflow the header next to the FavoriteButton on mobile. The
 * `.label` span is visually hidden (NOT `display: none`) in that range, so the
 * accessible name keeps coming from the visible label plus an sr-only
 * accommodation name. No `aria-label` is used: it would replace the visible
 * label and break WCAG 2.5.3 (label in name).
 *
 * @module components/accommodation/DetailCompareButton
 */

import { CheckIcon, ColumnIcon, CrownIcon } from '@repo/icons';
import { type FC, useRef, useState } from 'react';
import { CompareUpsellPopover } from '@/components/shared/compare/CompareUpsellPopover.client';
import { comparisonBenefit } from '@/components/shared/compare/comparison-benefit';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { UsageCounter } from '@/components/shared/ui/UsageCounter';
import usageStyles from '@/components/shared/ui/UsageCounter.module.css';
import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { addToast } from '@/store/toast-store';
import styles from './DetailCompareButton.module.css';

/** Props for the DetailCompareButton island. */
export interface DetailCompareButtonProps {
    /** UUID of the accommodation to toggle in the comparison list. */
    readonly accommodationId: string;
    /** Accommodation name, used for the sr-only name suffix and the compare-bar label. */
    readonly accommodationName: string;
    /** Thumbnail URL stored alongside the selection for the compare-bar preview. */
    readonly accommodationThumbnailUrl?: string;
    /** Locale for label and toast messaging. Defaults to `es`. */
    readonly locale?: SupportedLocale;
    /**
     * HOS-2554: catalog names of the plans that carry this feature, read server-side and
     * handed down (the catalog reader is server-only). Empty when it could not be read.
     */
    readonly planName?: string | null;
    /** Catalog limit for the advertised plan. */
    readonly planCapacity?: number;
    /** Additional CSS classes forwarded to the root button element. */
    readonly className?: string;
    /** Keep the badge and usage inside the dock's fixed-size button. */
    readonly compact?: boolean;
    /**
     * Label pair that replaces «Agregar a comparación» / «En comparación», for a
     * surface with its own vocabulary (the listing action bar, HOS-2579 §6.10.2).
     * It is still the button's visible-or-sr-only text, never an `aria-label`.
     */
    readonly labels?: { readonly add: string; readonly remove: string };
}

/**
 * Labeled compare-toggle button for the accommodation detail page.
 *
 * Renders a secondary button whose label and icon reflect whether this
 * accommodation is currently in the comparison selection ("Agregar a
 * comparación" / "En comparación"). Clicking delegates to
 * {@link useCompareGuard.toggle}, then surfaces a toast based on the outcome
 * (added / removed / upsell / limit) — identical UX to the listing card's
 * {@link import('@/components/shared/compare/CompareButton.client').CompareButton}.
 *
 * @param props - {@link DetailCompareButtonProps}
 * @returns The labeled compare toggle button island.
 *
 * @example
 * ```astro
 * <DetailCompareButton
 *   accommodationId={accommodation.id}
 *   accommodationName={accommodation.name}
 *   accommodationThumbnailUrl={accommodation.thumbnailUrl}
 *   locale={locale}
 *   client:load
 * />
 * ```
 */
export const DetailCompareButton: FC<DetailCompareButtonProps> = ({
    accommodationId,
    accommodationName,
    accommodationThumbnailUrl,
    locale = 'es',
    planName = null,
    planCapacity,
    className,
    compact = false,
    labels
}) => {
    const { t, tPlural } = createTranslations(locale);
    const { isInList, isLoading, maxItems, count, canCompare, toggle } = useCompareGuard();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [upsellOpen, setUpsellOpen] = useState(false);
    const usage =
        !isLoading && canCompare && Number.isFinite(maxItems) && maxItems > 0
            ? t('common.card.compareUsage', undefined, { count, max: maxItems })
            : undefined;

    const selected = isInList(accommodationId);
    const gated = !selected && !canCompare;

    const comparePageHref = `/${locale}/alojamientos/comparar/`;
    // Compare is a tourist feature → tourist plans page, not owner plans (BETA-200).
    // The path comes from the shared map (HOS-1032) rather than being spelled in
    // this template literal: it had gone stale twice already through two moves
    // of the same page, and a hand-written copy is what makes that possible.
    const pricingHref = `/${locale}/${PRICING_PAGE_PATH_BY_AUDIENCE.tourist}/`;

    const label = selected
        ? (labels?.remove ?? t('accommodations.comparison.detail.added', 'En comparación'))
        : (labels?.add ?? t('accommodations.comparison.detail.add', 'Agregar a comparación'));

    const handleClick = (): void => {
        // Defer while entitlements are still loading (guard fails closed until known).
        if (!selected && isLoading) return;
        if (gated) {
            setUpsellOpen((open) => !open);
            return;
        }

        const result = toggle(accommodationId, {
            name: accommodationName,
            thumbnailUrl: accommodationThumbnailUrl
        });

        if (result.action === 'added') {
            addToast({
                type: 'success',
                message: t('accommodations.comparison.toast.added', 'Agregado a la comparación'),
                action: {
                    label: t('accommodations.comparison.toast.view', 'Comparar ahora'),
                    href: comparePageHref
                }
            });
            return;
        }

        if (result.action === 'removed') {
            addToast({
                type: 'success',
                message: t('accommodations.comparison.toast.removed', 'Quitado de la comparación')
            });
            return;
        }

        // result.action === 'blocked'
        if (result.reason === 'upsell') return;

        // result.reason === 'limit'
        addToast({
            type: 'warning',
            message: tPlural('accommodations.comparison.limit.message', maxItems, { max: maxItems })
        });
    };

    const button = (
        <button
            ref={buttonRef}
            type="button"
            aria-pressed={selected}
            aria-busy={!selected && isLoading}
            aria-haspopup={gated ? 'dialog' : undefined}
            aria-expanded={gated ? upsellOpen : undefined}
            title={usage}
            aria-description={usage}
            data-selected={selected ? 'true' : undefined}
            className={cn(styles.button, compact && styles.compact, className)}
            onClick={handleClick}
        >
            {selected ? (
                <CheckIcon
                    size={18}
                    weight="bold"
                    aria-hidden="true"
                />
            ) : (
                <ColumnIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
            )}
            <span className={styles.label}>{label}</span>
            <span className="sr-only">, {accommodationName}</span>
            {compact && planName && (
                <span className={styles.compactBadge}>
                    <CrownIcon
                        size={12}
                        weight="fill"
                        aria-hidden="true"
                    />
                    <span className="sr-only">, {planName}</span>
                </span>
            )}
            {compact && usage && (
                <span
                    className={styles.compactUsage}
                    aria-hidden="true"
                >
                    {count}/{maxItems}
                </span>
            )}
        </button>
    );
    return (
        <span className={!compact && usage ? usageStyles.group : undefined}>
            {button}
            {!compact && usage && <UsageCounter value={`${count}/${maxItems}`} />}
            {!compact && <PlanBadge name={planName} />}
            {upsellOpen && gated && !isLoading && (
                <CompareUpsellPopover
                    anchorRef={buttonRef}
                    message={comparisonBenefit({ t, tPlural, planName, planCapacity })}
                    ctaLabel={t('accommodations.comparison.gate.upsellCta', 'Ver planes')}
                    ctaHref={pricingHref}
                    onClose={() => setUpsellOpen(false)}
                    dialogLabel={t('accommodations.comparison.upsell.title')}
                    closeLabel={t('common.auth.close')}
                    dismissLabel={t('common.vipGate.notNow')}
                />
            )}
        </span>
    );
};
