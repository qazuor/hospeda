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
 * Focus (HOS-729): with a `focusSlug` that matches a card, that card renders
 * first and alone, highlighted, under a heading naming the problem the user
 * arrived with, and the WHOLE remaining catalog renders below it under "Otros
 * complementos". Focus never filters — see `@/lib/billing/addon-focus`.
 *
 * Hydration: caller MUST use `client:load` (the buy button must be
 * interactive immediately — there is no meaningful above/below-the-fold
 * distinction on this page).
 */

import { PackageIcon } from '@repo/icons';
import type { PurchasableAddonResponse } from '@repo/schemas';
import { useState } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import { resolveSubscriptionPlansPathForAudience } from '@/lib/account-roles';
import { translateAddonDescription, translateAddonName } from '@/lib/addon-labels';
import { billingApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import {
    ADDON_FOCUS_FALLBACK_HEADING_KEY,
    addonFocusHeadingKey,
    splitAddonsByFocus
} from '@/lib/billing/addon-focus';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './AddonsPurchasePanel.module.css';

/**
 * Service error `reason` codes the addon purchase endpoint attaches when the
 * caller has no usable subscription (HOS-602). Both resolve to the same
 * "you need an active subscription" gate — see `addon.checkout.ts`
 * `NO_SUBSCRIPTION` (zero subscription rows) vs `NO_ACTIVE_SUBSCRIPTION`
 * (rows exist, none active/trialing) and `entitlement-cause.ts`, which
 * forwards a whitelisted `cause.code` as `error.reason` on the wire.
 */
const SUBSCRIPTION_GATE_REASONS: ReadonlySet<string> = new Set([
    'NO_SUBSCRIPTION',
    'NO_ACTIVE_SUBSCRIPTION'
]);

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single purchasable add-on, as returned by `billingApi.listAvailableAddons`. */
export type AddonCardData = PurchasableAddonResponse;

/** One of the caller's own listings, for the per-listing target selector. */
export interface AddonTargetAccommodation {
    readonly id: string;
    readonly name: string;
}

/**
 * The caller's own listings, keyed by the product domain that owns them
 * (HOS-1286).
 *
 * A targeted add-on must offer listings of ITS OWN vertical: before this, the
 * selector listed accommodations for every `requiresAccommodationTarget`
 * add-on, so a gastronomy visibility boost would have offered a restaurant
 * owner their hotels — or, far more often, nothing at all, and the card would
 * have rendered its "you need a listing first" empty state to somebody who owns
 * three restaurants.
 *
 * A domain with no entry is treated as an empty list, which disables the card
 * rather than falling back to another vertical's listings.
 */
export type AddonTargetListingsByDomain = Readonly<
    Partial<Record<string, readonly AddonTargetAccommodation[]>>
>;

/**
 * Spanish fallbacks for the target selector, per vertical (HOS-1286).
 *
 * The strings are keyed by vertical because "Elegí un alojamiento" on a
 * restaurant's visibility boost is not a cosmetic slip — it tells the owner to
 * pick something they do not have, next to a dropdown listing their
 * restaurants. Real translations live under
 * `account.addons.accommodationSelect.*.<noun>`; these are the inline
 * fallbacks every `t()` call in this file already carries.
 */
const TARGET_LABEL_FALLBACK = {
    accommodation: {
        label: 'Alojamiento',
        placeholder: 'Elegí un alojamiento',
        empty: 'Necesitás un alojamiento primero'
    },
    gastronomy: {
        label: 'Local gastronómico',
        placeholder: 'Elegí un local',
        empty: 'Necesitás un local publicado primero'
    },
    experience: {
        label: 'Experiencia',
        placeholder: 'Elegí una experiencia',
        empty: 'Necesitás una experiencia publicada primero'
    }
} as const;

/** Which label set an add-on's selector uses. Unknown domains read as accommodation. */
function resolveTargetNoun(
    productDomain: string | null | undefined
): keyof typeof TARGET_LABEL_FALLBACK {
    // A card with no options never renders the selector (`hasNoAccommodations`
    // is true), so this default only ever labels a control the user cannot
    // reach — it is a copy fallback, never a purchase decision.
    if (productDomain === 'gastronomy' || productDomain === 'experience') return productDomain;
    return 'accommodation';
}

/** Props for the AddonsPurchasePanel island. */
export interface AddonsPurchasePanelProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** The purchasable add-on catalog (already filtered to `active: true`). */
    readonly addons: readonly AddonCardData[];
    /** Slugs of add-ons the user currently owns with `status === 'active'`. */
    readonly ownedAddonSlugs: readonly string[];
    /**
     * The caller's own listings per vertical, for `requiresAccommodationTarget`
     * add-ons. The add-on's `productDomain` picks the list.
     */
    readonly targetListingsByDomain: AddonTargetListingsByDomain;
    /**
     * Add-on slug to put in focus (HOS-729), read server-side from
     * `?focus=<slug>`. A slug that matches nothing degrades to the normal
     * render — it never hides anything.
     */
    readonly focusSlug?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Add-ons self-service purchase panel.
 */
export function AddonsPurchasePanel({
    locale,
    addons,
    ownedAddonSlugs,
    targetListingsByDomain,
    focusSlug
}: AddonsPurchasePanelProps) {
    const { t, tPlural } = createTranslations(locale);

    /** Selected target accommodation id, keyed by addon slug. */
    const [selectedAccommodationBySlug, setSelectedAccommodationBySlug] = useState<
        Record<string, string>
    >({});

    /** Slug of the addon currently mid-purchase (disables its button). */
    const [purchasingSlug, setPurchasingSlug] = useState<string | null>(null);

    /**
     * Slugs whose last purchase attempt was rejected specifically for
     * lacking a usable subscription (HOS-602). Rendered as an inline banner
     * next to that addon's card instead of (or in addition to) a toast, so
     * the rejection reason the server already sends is actually visible —
     * see `SUBSCRIPTION_GATE_REASONS` above. Reuses the exact copy from the
     * page-level gate (`account.addons.gate.*`) rather than inventing new
     * strings, per the single-source-of-truth rule for i18n.
     */
    const [subscriptionGateSlugs, setSubscriptionGateSlugs] = useState<Record<string, boolean>>({});

    const ownedSet = new Set(ownedAddonSlugs);

    // HOS-729. `focused === null` (no param, unknown slug, or an add-on the
    // user already owns and which is therefore absent from the catalog) leaves
    // `rest` as the WHOLE list, which is exactly the normal render below.
    const { focused: focusedAddon, rest: unfocusedAddons } = splitAddonsByFocus({
        addons,
        focusSlug
    });

    const perAccommodationAddons = unfocusedAddons.filter(
        (addon) => addon.requiresAccommodationTarget
    );
    const accountLevelAddons = unfocusedAddons.filter(
        (addon) => !addon.requiresAccommodationTarget
    );

    // Addon purchases are a host-only surface (targetCategories are always
    // `owner`/`complex`), so the upgrade CTA always points at the host plans,
    // never the tourist ones.
    const upgradePlansHref = buildUrl({
        locale,
        path: resolveSubscriptionPlansPathForAudience({ audience: 'host' })
    });

    function handleAccommodationChange(slug: string, accommodationId: string): void {
        setSelectedAccommodationBySlug((prev) => ({ ...prev, [slug]: accommodationId }));
    }

    async function handlePurchase(addon: AddonCardData): Promise<void> {
        const selectedAccommodationId = selectedAccommodationBySlug[addon.slug];

        // A fresh attempt clears any stale gate banner from a previous
        // failed attempt (e.g. the user upgraded in another tab and retried).
        setSubscriptionGateSlugs((prev) => {
            if (!prev[addon.slug]) return prev;
            const { [addon.slug]: _removed, ...rest } = prev;
            return rest;
        });

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
            // HOS-1286: `entityId` is the canonical field for any vertical's
            // listing. The server still accepts `accommodationId` from a client
            // built before this change; this client no longer sends it.
            body: addon.requiresAccommodationTarget
                ? { entityId: selectedAccommodationId }
                : undefined,
            idempotencyKey
        });

        if (!result.ok) {
            // HOS-602: a missing/inactive subscription gets its own inline
            // banner (reusing the page-level gate copy) instead of a toast —
            // the rejection is actionable (upgrade), not transient, so it
            // belongs next to the card the user was trying to buy, not in a
            // notification that auto-dismisses in 5s. `translateApiError`'s
            // priority chain would otherwise show a misleading generic
            // "invalid data" message here: a 422's status-derived `code`
            // collapses several distinct reasons into `VALIDATION_ERROR`,
            // which wins over the specific English `message` — `reason` is
            // the one field the API forwards undisturbed (see addons.ts).
            if (result.error.reason && SUBSCRIPTION_GATE_REASONS.has(result.error.reason)) {
                setSubscriptionGateSlugs((prev) => ({ ...prev, [addon.slug]: true }));
                setPurchasingSlug(null);
                return;
            }

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

    /**
     * Renders one add-on card.
     *
     * RO-RO on purpose: called from `.map()`, where a positional second
     * parameter would silently receive the array index.
     *
     * @param params.addon - The add-on to render.
     * @param params.isFocused - Whether this is the focused card (HOS-729).
     * @returns The card element.
     */
    function renderCard({
        addon,
        isFocused = false
    }: {
        readonly addon: AddonCardData;
        readonly isFocused?: boolean;
    }) {
        const isOwned = ownedSet.has(addon.slug);
        const isPurchasing = purchasingSlug === addon.slug;
        const needsSelect = addon.requiresAccommodationTarget;
        // HOS-1286: the options come from the add-on's OWN vertical. An add-on
        // whose domain the API did not declare gets no options and therefore
        // cannot be bought — the same fail-closed answer `addon-domain.ts` gives
        // when it drops such an add-on from the catalogue.
        const targetOptions = addon.productDomain
            ? (targetListingsByDomain[addon.productDomain] ?? [])
            : [];
        const hasNoAccommodations = needsSelect && targetOptions.length === 0;
        const targetNoun = resolveTargetNoun(addon.productDomain);
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
                // Anchor target: the plan-usage section on the subscription
                // page deep-links here (`#addon-<slug>`) when a limit that this
                // add-on raises is running out.
                id={`addon-${addon.slug}`}
                className={isFocused ? `${styles.card} ${styles.cardFocused}` : styles.card}
                data-focused={isFocused ? 'true' : undefined}
                data-testid={`addon-card-${addon.slug}`}
            >
                <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                        {translateAddonName({ t, slug: addon.slug, fallback: addon.name })}
                    </h3>
                    {isOwned && (
                        <span className={styles.ownedBadge}>
                            {t('account.addons.owned', 'Activo')}
                        </span>
                    )}
                </div>

                <p className={styles.cardDescription}>
                    {translateAddonDescription({
                        t,
                        slug: addon.slug,
                        fallback: addon.description
                    })}
                </p>

                <div className={styles.cardMeta}>
                    <span className={styles.price}>{priceLabel}</span>
                    <span className={styles.billingType}>{billingTypeLabel}</span>
                    {addon.billingType === 'one_time' && addon.durationDays !== null && (
                        <span className={styles.duration}>
                            {tPlural('account.addons.duration', addon.durationDays)}
                        </span>
                    )}
                </div>

                {/*
                 * HOS-847: a recurring add-on is charged again every month, so
                 * the buyer has to read that BEFORE the buy button, not after
                 * the second charge lands.
                 *
                 * Gated on the SERVER's answer, not on `billingType`. The
                 * catalog label and the charge are different facts: the
                 * recurring checkout is behind a flag this app cannot read, and
                 * with it off — which is how production ships — a
                 * `billingType: 'recurring'` add-on is charged ONCE and its
                 * benefit never expires. Announcing a subscription there is a
                 * promise the purchase does not keep. `recurringChargingEnabled`
                 * is `shouldUseRecurringAddonCheckout`'s own verdict for this
                 * row, all three conditions included, so the notice appears
                 * exactly where the checkout takes the preapproval path and
                 * disappears on its own the day the flag goes back off.
                 */}
                {addon.recurringChargingEnabled && (
                    <p className={styles.recurringNotice}>
                        {t(
                            'account.addons.recurringNotice',
                            'Es una suscripción: se renueva sola y te la cobramos todos los meses mientras siga activa.'
                        )}
                    </p>
                )}

                {needsSelect && !isOwned && !hasNoAccommodations && (
                    <label className={styles.selectLabel}>
                        {t(
                            `account.addons.accommodationSelect.label.${targetNoun}`,
                            TARGET_LABEL_FALLBACK[targetNoun].label
                        )}
                        <select
                            className={styles.select}
                            value={selectedId}
                            onChange={(e) => handleAccommodationChange(addon.slug, e.target.value)}
                            data-testid={`addon-accommodation-select-${addon.slug}`}
                        >
                            <option value="">
                                {t(
                                    `account.addons.accommodationSelect.placeholder.${targetNoun}`,
                                    TARGET_LABEL_FALLBACK[targetNoun].placeholder
                                )}
                            </option>
                            {targetOptions.map((accommodation) => (
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
                            `account.addons.accommodationSelect.empty.${targetNoun}`,
                            TARGET_LABEL_FALLBACK[targetNoun].empty
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

                {!isOwned && subscriptionGateSlugs[addon.slug] && (
                    <div
                        className={styles.subscriptionGate}
                        role="alert"
                        data-testid={`addon-subscription-gate-${addon.slug}`}
                    >
                        <p className={styles.subscriptionGateTitle}>
                            {t('account.addons.gate.title', 'Necesitás una suscripción activa')}
                        </p>
                        <p className={styles.subscriptionGateBody}>
                            {t(
                                'account.addons.gate.body',
                                'Los complementos están disponibles para cuentas con una suscripción activa o en período de prueba.'
                            )}
                        </p>
                        <a
                            href={upgradePlansHref}
                            className={styles.subscriptionGateCta}
                        >
                            {t('account.addons.gate.cta', 'Ver planes')}
                        </a>
                    </div>
                )}
            </article>
        );
    }

    // ── Ready state ────────────────────────────────────────────────────────────

    // With a card in focus the remaining catalog collapses into ONE block under
    // "Otros complementos" instead of its usual two: the page already carries a
    // problem-shaped heading at the top, and re-stating "Por alojamiento" /
    // "De cuenta" underneath it buries the point in headings. Nothing is
    // dropped — every card the normal render shows is still here.
    if (focusedAddon !== null) {
        const genericFocusHeading = t(
            ADDON_FOCUS_FALLBACK_HEADING_KEY,
            'El complemento que estabas buscando'
        );

        return (
            <div className={styles.root}>
                <section
                    className={`${styles.group} ${styles.focusGroup}`}
                    data-testid="addon-focus-group"
                >
                    <h2 className={styles.groupTitle}>
                        {t(addonFocusHeadingKey(focusedAddon.slug), genericFocusHeading)}
                    </h2>
                    <div className={styles.grid}>
                        {renderCard({ addon: focusedAddon, isFocused: true })}
                    </div>
                </section>

                {unfocusedAddons.length > 0 && (
                    <section
                        className={styles.group}
                        data-testid="addon-others-group"
                    >
                        <h2 className={styles.groupTitle}>
                            {t('account.addons.focus.others', 'Otros complementos')}
                        </h2>
                        <div className={styles.grid}>
                            {unfocusedAddons.map((addon) => renderCard({ addon }))}
                        </div>
                    </section>
                )}
            </div>
        );
    }

    return (
        <div className={styles.root}>
            {perAccommodationAddons.length > 0 && (
                <section className={styles.group}>
                    <h2 className={styles.groupTitle}>
                        {t('account.addons.groups.perAccommodation', 'Por alojamiento')}
                    </h2>
                    <div className={styles.grid}>
                        {perAccommodationAddons.map((addon) => renderCard({ addon }))}
                    </div>
                </section>
            )}

            {accountLevelAddons.length > 0 && (
                <section className={styles.group}>
                    <h2 className={styles.groupTitle}>
                        {t('account.addons.groups.account', 'De cuenta')}
                    </h2>
                    <div className={styles.grid}>
                        {accountLevelAddons.map((addon) => renderCard({ addon }))}
                    </div>
                </section>
            )}
        </div>
    );
}
