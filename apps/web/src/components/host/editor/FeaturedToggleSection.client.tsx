/**
 * @file FeaturedToggleSection.client.tsx
 * @description Owner self-service featured toggle section (SPEC-309 T-020, G-6).
 *
 * Self-contained, like `ExternalReputationSection.client.tsx`: fetches its own
 * entitlement status on mount via `GET .../featured-toggle` (T-020) and calls
 * `PATCH .../featured-toggle` (T-019) on change. A plain on/off switch, no
 * rotation/queue UI (SPEC-309 OQ-4).
 *
 * ## Three states, not two (HOS-728)
 *
 * The section used to collapse loading and "no entitlement" into one
 * `return null`, which made the two visibility add-ons undiscoverable: they
 * raise no quota and block no action, so this is the ONLY surface in the
 * product that names the capability they sell. Now:
 *
 * - **loading** → nothing, so the offer never flashes before the answer lands;
 * - **entitled** → the real toggle;
 * - **not entitled** → an OFFER: what featuring is, and the two add-ons that
 *   grant it, linked with {@link buildAddonFocusUrl} so the add-ons page opens
 *   focused on them.
 *
 * A failed fetch still lands in the offer state. That is deliberate and safe:
 * the offer grants nothing and writes nothing, so the worst case is showing a
 * buying option to somebody who already holds the entitlement — the reverse of
 * the fail-closed concern, which is about the toggle, not the pitch.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { translateAddonName } from '@/lib/addon-labels';
import { buildFeaturedAddonOffers } from '@/lib/billing/featured-addon-offer';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './FeaturedToggleSection.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for FeaturedToggleSection. */
export interface FeaturedToggleSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Owner-facing featured toggle section.
 *
 * Renders the toggle when the owner holds an active FEATURED_LISTING
 * entitlement (plan or addon) for this specific accommodation, and the add-on
 * offer when they do not (HOS-728).
 */
export function FeaturedToggleSection({ locale, accommodationId }: FeaturedToggleSectionProps) {
    const { t } = createTranslations(locale);

    const [isLoading, setIsLoading] = useState(true);
    const [hasEntitlement, setHasEntitlement] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [toggleError, setToggleError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
                const result = await accommodationEditApi.getFeaturedEntitlement({
                    id: accommodationId
                });
                if (cancelled) return;

                if (result.ok) {
                    setHasEntitlement(result.data.hasEntitlement);
                    setIsFeatured(result.data.isFeatured);
                } else {
                    setHasEntitlement(false);
                }
            } catch {
                if (!cancelled) setHasEntitlement(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [accommodationId]);

    const handleToggle = useCallback(async () => {
        const nextValue = !isFeatured;
        setIsToggling(true);
        setToggleError(null);
        try {
            const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
            const result = await accommodationEditApi.setFeaturedToggle({
                id: accommodationId,
                isFeatured: nextValue
            });

            if (result.ok) {
                setIsFeatured(result.data.isFeatured);
            } else {
                setToggleError(
                    result.error.message ||
                        t(
                            'host.properties.editor.featuredToggle.toggleError',
                            'No se pudo actualizar el destacado. Intentá de nuevo.'
                        )
                );
            }
        } catch {
            setToggleError(
                t(
                    'host.properties.editor.featuredToggle.toggleError',
                    'No se pudo actualizar el destacado. Intentá de nuevo.'
                )
            );
        } finally {
            setIsToggling(false);
        }
    }, [accommodationId, isFeatured, t]);

    if (isLoading) {
        return null;
    }

    if (!hasEntitlement) {
        return <FeaturedAddonOfferState locale={locale} />;
    }

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.featuredToggle', 'Destacado')}
            </legend>

            <div className={styles.toggleRow}>
                <label
                    htmlFor="featured-toggle"
                    className={styles.toggleLabel}
                >
                    {t('host.properties.editor.featuredToggle.label', 'Destacar mi alojamiento')}
                </label>
                <input
                    id="featured-toggle"
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={isFeatured}
                    onChange={() => void handleToggle()}
                    disabled={isToggling}
                />
            </div>

            <p className={styles.hint}>
                {t(
                    'host.properties.editor.featuredToggle.hint',
                    'Cuando está activo, tu alojamiento aparece con prioridad en los listados y búsquedas.'
                )}
            </p>

            {toggleError && (
                <div
                    className={styles.errorBanner}
                    role="alert"
                >
                    {toggleError}
                </div>
            )}
        </fieldset>
    );
}

// ---------------------------------------------------------------------------
// Offer state (HOS-728)
// ---------------------------------------------------------------------------

/**
 * What a host who cannot feature this listing sees instead of nothing.
 *
 * The scope sentence is load-bearing, not filler: an add-on grant features ONE
 * accommodation (`featured_listing_addon_grants`, `purchaseId` →
 * `accommodationId`), while a plan grant is owner-wide. A host with five
 * listings who buys one boost expecting all five to light up has been misled,
 * so the offer says which listing it covers before it says how to buy.
 *
 * @param props.locale - Active locale, for copy and for the add-on links.
 */
function FeaturedAddonOfferState({ locale }: { readonly locale: SupportedLocale }) {
    const { t } = createTranslations(locale);
    const offers = useMemo(() => buildFeaturedAddonOffers({ locale }), [locale]);

    return (
        <section
            className={styles.section}
            aria-labelledby="featured-offer-title"
            data-testid="featured-addon-offer"
        >
            <h2
                id="featured-offer-title"
                className={styles.sectionTitle}
            >
                {t('account.addons.featuredOffer.title', 'Destacá este alojamiento')}
            </h2>

            <p className={styles.hint}>
                {t(
                    'account.addons.featuredOffer.body',
                    'Un impulso de visibilidad hace que este alojamiento aparezca destacado en los listados y en los resultados de búsqueda mientras dure el complemento.'
                )}
            </p>

            <p className={styles.offerScope}>
                {t(
                    'account.addons.featuredOffer.scope',
                    'Ojo: el impulso se aplica solo a esta ficha. Si tenés más de un alojamiento, cada uno necesita su propio complemento.'
                )}
            </p>

            <ul className={styles.offerList}>
                {offers.map((offer) => (
                    <li key={offer.slug}>
                        <a
                            className={styles.offerLink}
                            href={offer.href}
                            data-addon-slug={offer.slug}
                        >
                            {translateAddonName({
                                t,
                                slug: offer.slug,
                                fallback: offer.nameFallback
                            })}
                            <span className="sr-only">
                                {` ${t('account.addons.featuredOffer.linkSr', 'para este alojamiento')}`}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}
