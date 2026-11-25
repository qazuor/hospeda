/**
 * @file ListingActionBarButtons.tsx
 * @description The icon-only row of the listing mobile action bar (HOS-2579
 * §6.10). Order: Consultar (or «Ver carta»), WhatsApp, Llamar, Favorito,
 * Compartir, Comparar. An absent channel is not rendered at all: no disabled or
 * ghost button. Favorito and Compartir always render, so the bar (and the
 * pinned mobile dock) exists on every listing page.
 *
 * Session-blind (§6.10.3): every prop is a public fact computed by the page.
 * The favorite state, the compare selection and the WhatsApp entitlement live
 * in the reused islands (`FavoriteButton`, `DetailCompareButton`, the panels).
 *
 * Analytics (§6.10.4): `tel:` and `wa.me` anchors only carry
 * `data-contact-*` attributes and are reported by the page's delegated
 * `initContactLinkTracking` listener. The controls that open a panel report
 * with a direct `trackEvent`. One tap, one event.
 */
import { BarServiceIcon, ChatIcon, ForkKnifeIcon, PhoneIcon, WhatsappIcon } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useSyncExternalStore } from 'react';
import { DetailCompareButton } from '@/components/accommodation/DetailCompareButton.client';
import { ShareButtons } from '@/components/ShareButtons.client';
import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';
import type { VenueMenuGlyph } from '@/lib/listing-contact/venue-menu-glyph';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import styles from './ListingActionBarButtons.module.css';
import whatsappStyles from './ListingActionBarWhatsapp.module.css';
import {
    isListingContactPanelReady,
    subscribeToListingContactReadiness
} from './listing-contact-readiness';

/** The vertical a listing page belongs to. */
export type ListingActionBarVertical = 'accommodation' | 'experience' | 'venue';

/**
 * What position 1 does: open the contact panel, link to the venue menu, or
 * nothing. A menu's `glyph` comes from `resolveVenueMenuGlyph` (HOS-2607): a fork
 * and knife for a food venue, a drink for a nightlife venue. Absent means `food`.
 */
export type ListingActionBarPrimary =
    | { readonly kind: 'inquire' }
    | { readonly kind: 'menu'; readonly href: string; readonly glyph?: VenueMenuGlyph }
    | null;

/** Venue WhatsApp state from the public payload (HOS-2256). `null` means no button. */
export type ListingActionBarVenueWhatsapp =
    | { readonly mode: 'PUBLIC'; readonly number: string }
    | { readonly mode: 'LOGGED_IN_ONLY' }
    | null;

/** Accommodation compare control (the `CAN_COMPARE_ACCOMMODATIONS` gate stays in the island). */
export interface ListingActionBarCompare {
    readonly thumbnailUrl?: string;
    /** Public catalog names of the plans carrying the entitlement (HOS-2554). */
    readonly gatePlanNames: readonly string[];
}

/** Public, session-blind inputs of the action row. */
export interface ListingActionBarButtonsProps {
    readonly vertical: ListingActionBarVertical;
    readonly listingId: string;
    readonly listingName: string;
    readonly locale: SupportedLocale;
    readonly panelId: string;
    /** In-page anchor the panel controls fall back to before the panel hydrates. */
    readonly fallbackHref: string;
    readonly primary: ListingActionBarPrimary;
    /** Accommodation only: the listing publishes WhatsApp (the HOS-19 gate runs in the panel). */
    readonly hasWhatsapp: boolean;
    /** Venue only. */
    readonly venueWhatsapp: ListingActionBarVenueWhatsapp;
    /** Already-normalized `tel:` href, `null` without a public phone. */
    readonly phoneHref: string | null;
    /** Canonical URL of the listing for the share control. */
    readonly shareUrl: string;
    /** Accommodation only; `null` hides Comparar. */
    readonly compare: ListingActionBarCompare | null;
}

const FAVORITE_ENTITY_TYPES = {
    accommodation: 'ACCOMMODATION',
    venue: 'VENUE',
    experience: 'EXPERIENCE'
} as const;

/** Renders the action row. Every control has an i18n accessible name and a ≥44px target. */
export function ListingActionBarButtons({
    vertical,
    listingId,
    listingName,
    locale,
    panelId,
    fallbackHref,
    primary,
    hasWhatsapp,
    venueWhatsapp,
    phoneHref,
    shareUrl,
    compare
}: ListingActionBarButtonsProps) {
    const { t } = createTranslations(locale);
    const panelReady = useSyncExternalStore(
        subscribeToListingContactReadiness,
        () => isListingContactPanelReady({ panelId }),
        () => false
    );

    function openPanel({
        event,
        focus
    }: {
        readonly event: MouseEvent<HTMLAnchorElement>;
        readonly focus: 'form' | 'whatsapp';
    }): void {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // Channel-only verticals have no form: opening their panel is not a channel,
        // so only a WhatsApp intent (or the links inside the panel) is reported.
        if (vertical === 'accommodation' || focus === 'whatsapp') {
            trackEvent(WebEvents.ListingContactClicked, {
                listing_id: listingId,
                vertical,
                locale,
                origin: 'bar',
                channel: focus === 'form' ? 'form_open' : 'whatsapp'
            });
        }
        if (!isListingContactPanelReady({ panelId })) return;
        event.preventDefault();
        // Safari does not focus clicked links. Give Dialog a trigger to restore.
        event.currentTarget.focus({ preventScroll: true });
        openListingContactPanel({ origin: 'bar', focus: focus === 'form' ? undefined : focus });
    }

    const venueWhatsappHref =
        vertical === 'venue' && venueWhatsapp?.mode === 'PUBLIC'
            ? buildWhatsAppLink({
                  phone: venueWhatsapp.number,
                  message: t(
                      'venue.detail.whatsapp.messageTemplate',
                      'Hola, vi tu ficha de {{name}} en Hospeda y quería consultarte algo.'
                  ).replace('{{name}}', listingName)
              }).url
            : null;
    const opensWhatsappPanel =
        (vertical === 'accommodation' && hasWhatsapp) ||
        (vertical === 'venue' && venueWhatsapp?.mode === 'LOGGED_IN_ONLY');

    const trackingAttributes = {
        'data-listing-id': listingId,
        'data-vertical': vertical,
        'data-contact-origin': 'bar'
    } as const;

    return (
        <div
            className={styles.row}
            data-action-row
        >
            {primary?.kind === 'menu' && (
                <a
                    href={primary.href}
                    className={styles.primary}
                    aria-label={t('accommodations.detail.listingContact.bar.actions.viewMenu')}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-action="primary"
                    data-contact-channel="menu"
                    data-menu-glyph={primary.glyph ?? 'food'}
                    {...trackingAttributes}
                >
                    {/* HOS-2607: written out per glyph (not looked up in a map) so the
                        icon-manifest analyzer sees each (glyph, weight) pair. */}
                    {primary.glyph === 'nightlife' ? (
                        <BarServiceIcon
                            size={22}
                            weight="bold"
                            aria-hidden="true"
                        />
                    ) : (
                        <ForkKnifeIcon
                            size={22}
                            weight="bold"
                            aria-hidden="true"
                        />
                    )}
                </a>
            )}
            {primary?.kind === 'inquire' && (
                <a
                    href={fallbackHref}
                    className={styles.primary}
                    aria-label={t('accommodations.detail.listingContact.bar.actions.inquire')}
                    aria-haspopup={panelReady ? 'dialog' : undefined}
                    data-action="primary"
                    onClick={(event) => openPanel({ event, focus: 'form' })}
                >
                    <ChatIcon
                        size={22}
                        weight="bold"
                        aria-hidden="true"
                    />
                </a>
            )}
            {venueWhatsappHref && (
                <a
                    href={venueWhatsappHref}
                    className={`${styles.action} ${whatsappStyles.whatsapp}`}
                    aria-label={t('accommodations.detail.listingContact.bar.actions.whatsapp')}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-action="whatsapp"
                    data-contact-channel="whatsapp"
                    data-interaction-kind="WHATSAPP_CLICK"
                    {...trackingAttributes}
                >
                    <WhatsappIcon
                        size={22}
                        aria-hidden="true"
                    />
                </a>
            )}
            {opensWhatsappPanel && (
                <a
                    href={fallbackHref}
                    className={`${styles.action} ${whatsappStyles.whatsapp}`}
                    aria-label={t('accommodations.detail.listingContact.bar.actions.whatsapp')}
                    aria-haspopup={panelReady ? 'dialog' : undefined}
                    data-action="whatsapp"
                    onClick={(event) => openPanel({ event, focus: 'whatsapp' })}
                >
                    <WhatsappIcon
                        size={22}
                        aria-hidden="true"
                    />
                </a>
            )}
            {phoneHref && (
                <a
                    href={phoneHref}
                    className={styles.action}
                    aria-label={t('accommodations.detail.listingContact.bar.actions.call')}
                    data-action="call"
                    data-contact-channel="phone"
                    {...(vertical === 'venue' ? { 'data-interaction-kind': 'PHONE_CLICK' } : {})}
                    {...trackingAttributes}
                >
                    {/* HOS-2607: every secondary glyph (call, share, compare, resting
                        heart) is 22px `regular`, so none reads heavier, lighter or in
                        another colour than its neighbours. The islands that size their
                        own glyph are brought to the same box by the row CSS. */}
                    <PhoneIcon
                        size={22}
                        weight="regular"
                        aria-hidden="true"
                    />
                </a>
            )}
            <span
                className={styles.island}
                data-action="favorite"
            >
                <FavoriteButton
                    entityId={listingId}
                    entityType={FAVORITE_ENTITY_TYPES[vertical]}
                    locale={locale}
                    origin="bar"
                    labels={{
                        add: t('accommodations.detail.listingContact.bar.actions.favoriteAdd'),
                        remove: t('accommodations.detail.listingContact.bar.actions.favoriteRemove')
                    }}
                    className={styles.favorite}
                />
            </span>
            <span
                className={styles.island}
                data-action="share"
            >
                <ShareButtons
                    url={shareUrl}
                    title={listingName}
                    campaign={vertical}
                    locale={locale}
                    appearance="icon"
                    iconWeight="regular"
                    label={t('accommodations.detail.listingContact.bar.actions.share')}
                    analytics={{ listingId, vertical, origin: 'bar' }}
                    className={styles.share}
                />
            </span>
            {vertical === 'accommodation' && compare && (
                <span
                    className={styles.island}
                    data-action="compare"
                >
                    <DetailCompareButton
                        accommodationId={listingId}
                        accommodationName={listingName}
                        accommodationThumbnailUrl={compare.thumbnailUrl}
                        locale={locale}
                        gatePlanNames={compare.gatePlanNames}
                        labels={{
                            add: t('accommodations.detail.listingContact.bar.actions.compareAdd'),
                            remove: t(
                                'accommodations.detail.listingContact.bar.actions.compareRemove'
                            )
                        }}
                        className={styles.compare}
                    />
                </span>
            )}
        </div>
    );
}
