/**
 * @file AddonsPurchasePanel.client.tsx
 * @description React island for the add-ons self-service purchase page
 * (HOS-224). Renders the purchasable add-on catalog grouped by
 * "por alojamiento" (per-accommodation, `requiresAccommodationTarget`) and
 * "de cuenta" (everything else), with a "Comprar" button per addon that
 * redirects the browser to the MercadoPago checkout URL on success.
 *
 * Per-accommodation addons (`visibility-boost-7d`/`-30d`) require picking a
 * target accommodation from an inline `<select>` before the button enables.
 * Already-owned active addons render as "Activo" instead of a buy button.
 *
 * Hydration: caller MUST use `client:load` (the buy button must be
 * interactive immediately — there is no meaningful above/below-the-fold
 * distinction on this page).
 */

import { PackageIcon } from '@repo/icons';
import type { AddonResponse } from '@repo/schemas';
import { useState } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import { billingApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './AddonsPurchasePanel.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single purchasable add-on, as returned by `billingApi.listAvailableAddons`. */
export type AddonCardData = AddonResponse;

/** A host's own accommodation, for the per-accommodation target selector. */
export interface AddonTargetAccommodation {
    readonly id: string;
    readonly name: string;
}

/** Props for the AddonsPurchasePanel island. */
export interface AddonsPurchasePanelProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** The purchasable add-on catalog (already filtered to `active: true`). */
    readonly addons: readonly AddonCardData[];
    /** Slugs of add-ons the user currently owns with `status === 'active'`. */
    readonly ownedAddonSlugs: readonly string[];
    /** The host's own accommodations, for `requiresAccommodationTarget` add-ons. */
    readonly accommodations: readonly AddonTargetAccommodation[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Add-ons self-service purchase panel.
 */
export function AddonsPurchasePanel({
    locale,
    addons,
    ownedAddonSlugs,
    accommodations
}: AddonsPurchasePanelProps) {
    const t = createT(locale);

    /** Selected target accommodation id, keyed by addon slug. */
    const [selectedAccommodationBySlug, setSelectedAccommodationBySlug] = useState<
        Record<string, string>
    >({});

    /** Slug of the addon currently mid-purchase (disables its button). */
    const [purchasingSlug, setPurchasingSlug] = useState<string | null>(null);

    const ownedSet = new Set(ownedAddonSlugs);

    const perAccommodationAddons = addons.filter((addon) => addon.requiresAccommodationTarget);
    const accountLevelAddons = addons.filter((addon) => !addon.requiresAccommodationTarget);

    function handleAccommodationChange(slug: string, accommodationId: string): void {
        setSelectedAccommodationBySlug((prev) => ({ ...prev, [slug]: accommodationId }));
    }

    async function handlePurchase(addon: AddonCardData): Promise<void> {
        const selectedAccommodationId = selectedAccommodationBySlug[addon.slug];

        if (addon.requiresAccommodationTarget && !selectedAccommodationId) {
            addToast({
                type: 'error',
                message: t(
                    'account.addons.errors.missingAccommodation',
                    'Elegí un alojamiento para continuar.'
                )
            });
            return;
        }

        setPurchasingSlug(addon.slug);

        const idempotencyKey = crypto.randomUUID();
        const result = await billingApi.purchaseAddon({
            slug: addon.slug,
            body: addon.requiresAccommodationTarget
                ? { accommodationId: selectedAccommodationId }
                : undefined,
            idempotencyKey
        });

        if (!result.ok) {
            addToast({
                type: 'error',
                message: translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'account.addons.errors.purchaseFailed',
                        'No se pudo iniciar la compra. Intentá de nuevo.'
                    )
                })
            });
            setPurchasingSlug(null);
            return;
        }

        window.location.href = result.data.checkoutUrl;
    }

    // ── Empty state ──────────────────────────────────────────────────────────

    if (addons.length === 0) {
        return (
            <AccountEmptyState
                title={t('account.addons.title', 'Complementos')}
                description={t(
                    'account.addons.empty',
                    'No hay complementos disponibles en este momento.'
                )}
                icon={<PackageIcon size={28} />}
            />
        );
    }

    // ── Render helpers ────────────────────────────────────────────────────────

    function renderCard(addon: AddonCardData) {
        const isOwned = ownedSet.has(addon.slug);
        const isPurchasing = purchasingSlug === addon.slug;
        const needsSelect = addon.requiresAccommodationTarget;
        const hasNoAccommodations = needsSelect && accommodations.length === 0;
        const selectedId = selectedAccommodationBySlug[addon.slug] ?? '';
        const canPurchase =
            !isOwned &&
            !isPurchasing &&
            !hasNoAccommodations &&
            (!needsSelect || selectedId !== '');

        const priceLabel = formatPrice({ amount: addon.priceArs / 100, locale });
        const billingTypeLabel =
            addon.billingType === 'one_time'
                ? t('account.addons.billingType.one_time', 'Pago único')
                : t('account.addons.billingType.recurring', 'Mensual');

        return (
            <article
                key={addon.slug}
                className={styles.card}
                data-testid={`addon-card-${addon.slug}`}
            >
                <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{addon.name}</h3>
                    {isOwned && (
                        <span className={styles.ownedBadge}>
                            {t('account.addons.owned', 'Activo')}
                        </span>
                    )}
                </div>

                <p className={styles.cardDescription}>{addon.description}</p>

                <div className={styles.cardMeta}>
                    <span className={styles.price}>{priceLabel}</span>
                    <span className={styles.billingType}>{billingTypeLabel}</span>
                    {addon.billingType === 'one_time' && addon.durationDays !== null && (
                        <span className={styles.duration}>
                            {t('account.addons.duration', '{{days}} días', {
                                days: addon.durationDays
                            })}
                        </span>
                    )}
                </div>

                {needsSelect && !isOwned && !hasNoAccommodations && (
                    <label className={styles.selectLabel}>
                        {t('account.addons.accommodationSelect.label', 'Alojamiento')}
                        <select
                            className={styles.select}
                            value={selectedId}
                            onChange={(e) => handleAccommodationChange(addon.slug, e.target.value)}
                            data-testid={`addon-accommodation-select-${addon.slug}`}
                        >
                            <option value="">
                                {t(
                                    'account.addons.accommodationSelect.placeholder',
                                    'Elegí un alojamiento'
                                )}
                            </option>
                            {accommodations.map((accommodation) => (
                                <option
                                    key={accommodation.id}
                                    value={accommodation.id}
                                >
                                    {accommodation.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {needsSelect && !isOwned && hasNoAccommodations && (
                    <p className={styles.noAccommodations}>
                        {t(
                            'account.addons.accommodationSelect.empty',
                            'Necesitás un alojamiento primero'
                        )}
                    </p>
                )}

                {!isOwned && (
                    <button
                        type="button"
                        className={styles.buyBtn}
                        disabled={!canPurchase}
                        aria-disabled={!canPurchase}
                        onClick={() => void handlePurchase(addon)}
                        data-testid={`addon-buy-button-${addon.slug}`}
                    >
                        {isPurchasing
                            ? t('account.addons.buyingButton', 'Procesando...')
                            : t('account.addons.buyButton', 'Comprar')}
                    </button>
                )}
            </article>
        );
    }

    // ── Ready state ────────────────────────────────────────────────────────────

    return (
        <div className={styles.root}>
            {perAccommodationAddons.length > 0 && (
                <section className={styles.group}>
                    <h2 className={styles.groupTitle}>
                        {t('account.addons.groups.perAccommodation', 'Por alojamiento')}
                    </h2>
                    <div className={styles.grid}>{perAccommodationAddons.map(renderCard)}</div>
                </section>
            )}

            {accountLevelAddons.length > 0 && (
                <section className={styles.group}>
                    <h2 className={styles.groupTitle}>
                        {t('account.addons.groups.account', 'De cuenta')}
                    </h2>
                    <div className={styles.grid}>{accountLevelAddons.map(renderCard)}</div>
                </section>
            )}
        </div>
    );
}
