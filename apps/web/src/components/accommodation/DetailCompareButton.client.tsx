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
 * `aria-label` below is always set explicitly and does not depend on the
 * `.label` span's visibility — the accessible name is unaffected by the
 * responsive collapse.
 *
 * @module components/accommodation/DetailCompareButton
 */

import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import { createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { CheckIcon, ColumnIcon } from '@repo/icons';
import type { FC, MouseEvent } from 'react';
import styles from './DetailCompareButton.module.css';

/** Props for the DetailCompareButton island. */
export interface DetailCompareButtonProps {
    /** UUID of the accommodation to toggle in the comparison list. */
    readonly accommodationId: string;
    /** Accommodation name, used for the aria-label and the compare-bar label. */
    readonly accommodationName: string;
    /** Thumbnail URL stored alongside the selection for the compare-bar preview. */
    readonly accommodationThumbnailUrl?: string;
    /** Locale for label and toast messaging. Defaults to `es`. */
    readonly locale?: SupportedLocale;
    /** Additional CSS classes forwarded to the root button element. */
    readonly className?: string;
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
    className
}) => {
    const t = createT(locale);
    const { isInList, isLoading, maxItems, toggle } = useCompareGuard();

    const selected = isInList(accommodationId);

    const comparePageHref = `/${locale}/alojamientos/comparar/`;
    const pricingHref = `/${locale}/suscriptores/planes/`;

    const label = selected
        ? t('accommodations.comparison.detail.added', 'En comparación')
        : t('accommodations.comparison.detail.add', 'Agregar a comparación');

    const ariaLabel = selected
        ? t(
              'accommodations.comparison.detail.removeAriaLabel',
              'Quitar {{name}} de la comparación',
              { name: accommodationName }
          )
        : t('accommodations.comparison.detail.addAriaLabel', 'Agregar {{name}} a la comparación', {
              name: accommodationName
          });

    const handleClick = (_event: MouseEvent<HTMLButtonElement>): void => {
        // Defer while entitlements are still loading (guard fails closed until known).
        if (isLoading) return;

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
        if (result.reason === 'upsell') {
            addToast({
                type: 'info',
                message: t(
                    'accommodations.comparison.upsell.message',
                    'Comparar alojamientos está disponible en los planes Plus y VIP.'
                ),
                action: {
                    label: t('accommodations.comparison.upsell.cta', 'Ver planes'),
                    href: pricingHref
                }
            });
            return;
        }

        // result.reason === 'limit'
        addToast({
            type: 'warning',
            message: t(
                'accommodations.comparison.limit.message',
                'Tu plan permite comparar hasta {{max}} alojamientos a la vez.',
                { max: maxItems }
            )
        });
    };

    return (
        <button
            type="button"
            aria-pressed={selected}
            aria-label={ariaLabel}
            aria-busy={isLoading}
            data-selected={selected ? 'true' : undefined}
            className={cn(styles.button, className)}
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
        </button>
    );
};
