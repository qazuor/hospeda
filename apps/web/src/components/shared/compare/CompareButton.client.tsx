/**
 * @file CompareButton.client.tsx
 * @description React island that toggles an accommodation in the client-only
 * comparison selection (SPEC-288). Follows the FavoriteButton.client.tsx
 * pattern: a circular icon button rendered inside `acc-card__actions`.
 *
 * Unlike FavoriteButton there is NO network call on toggle — the selection
 * lives entirely in the client-only compare-store (D-3). The button is shown
 * to everyone (D-4):
 * - free / anonymous users (no `can_compare_accommodations` entitlement) get an
 *   upsell toast pointing at the plans page;
 * - users already at their per-plan cap get a limit toast.
 *
 * The {@link useCompareGuard} hook owns the entitlement + limit logic; the
 * server re-validates the same cap when the comparison page hydrates.
 *
 * @module components/shared/compare/CompareButton
 */

import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import { createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { ColumnIcon } from '@repo/icons';
import type { FC, MouseEvent } from 'react';
import styles from './CompareButton.module.css';

/**
 * Visual variant for the compare button.
 *
 * - `standalone` (default): circular icon-only button for listing cards.
 * - `compact`: smaller circular button for dense contexts (map popups).
 */
export type CompareButtonVariant = 'standalone' | 'compact';

/** Props for the CompareButton island. */
export interface CompareButtonProps {
    /** UUID of the accommodation to toggle in the comparison list. */
    readonly accommodationId: string;
    /** Accommodation name, used for the aria-label (and future toast copy). */
    readonly accommodationName: string;
    /** Visual variant. Defaults to `standalone`. */
    readonly variant?: CompareButtonVariant;
    /** Locale for aria-label and toast messaging. Defaults to `es`. */
    readonly locale?: SupportedLocale;
    /** Additional CSS classes forwarded to the root button element. */
    readonly className?: string;
}

/**
 * Compare toggle button for an accommodation card.
 *
 * Renders a circular button whose pressed state (`aria-pressed`) reflects
 * whether the accommodation is currently in the comparison selection. Clicking
 * delegates to {@link useCompareGuard.toggle}, then surfaces a toast based on
 * the outcome (added / removed / upsell / limit).
 *
 * @param props - {@link CompareButtonProps}
 * @returns The compare toggle button island.
 *
 * @example
 * ```astro
 * <CompareButton
 *   accommodationId={accommodation.id}
 *   accommodationName={accommodation.name}
 *   locale={locale}
 *   client:visible
 * />
 * ```
 */
export const CompareButton: FC<CompareButtonProps> = ({
    accommodationId,
    accommodationName,
    variant = 'standalone',
    locale = 'es',
    className
}) => {
    const t = createT(locale);
    const { isInList, isLoading, maxItems, toggle } = useCompareGuard();

    const selected = isInList(accommodationId);

    const comparePageHref = `/${locale}/alojamientos/comparar/`;
    const pricingHref = `/${locale}/suscriptores/planes/`;

    const ariaLabel = selected
        ? t('accommodations.comparison.button.removeAriaLabel', 'Quitar de comparación', {
              name: accommodationName
          })
        : t('accommodations.comparison.button.addAriaLabel', 'Agregar a comparación', {
              name: accommodationName
          });

    const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
        // The button is rendered inside a card-wide <a> wrapper. Without stopping
        // propagation the click bubbles up and the browser navigates to the
        // detail page, undoing the toggle. Stop + prevent keep the user here.
        event.stopPropagation();
        event.preventDefault();

        // Defer while entitlements are still loading (guard fails closed until known).
        if (isLoading) return;

        const result = toggle(accommodationId);

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
            data-variant={variant}
            data-selected={selected ? 'true' : undefined}
            className={cn(styles.button, className)}
            onClick={handleClick}
        >
            <ColumnIcon
                size={variant === 'compact' ? 18 : 22}
                weight={selected ? 'fill' : 'regular'}
                aria-hidden="true"
            />
        </button>
    );
};
