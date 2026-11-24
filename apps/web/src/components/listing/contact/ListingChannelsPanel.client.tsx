/**
 * @file ListingChannelsPanel.client.tsx
 * @description Channel-only contact sheet of the experience and venue detail pages
 * (HOS-2532): lists the public channels a listing publishes, opened by the shared
 * listing contact bus, with no inquiry form.
 */
import {
    EmailIcon,
    ExternalLinkIcon,
    FacebookIcon,
    GlobeIcon,
    InstagramIcon,
    PhoneIcon,
    TiktokIcon,
    TwitterIcon,
    YoutubeIcon
} from '@repo/icons';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import type { VenueWhatsAppButtonMode } from '@/components/venue/VenueWhatsAppButton.client';
import { VenueWhatsAppButton } from '@/components/venue/VenueWhatsAppButton.client';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ListingChannel } from '@/lib/listing-contact/listing-channels';
import type { ListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import type { ListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import { getListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import styles from './ListingChannelsPanel.module.css';
import { markListingContactPanelReady } from './listing-contact-readiness';

/** Public, already-sanitized data for a channel-only panel (experience and venue). */
export interface ListingChannelsPanelProps {
    readonly panelId: string;
    readonly listingId: string;
    readonly vertical: 'experience' | 'venue';
    readonly locale: SupportedLocale;
    readonly channels: readonly ListingChannel[];
    /** Shown above the channels when the vertical has a price (experience). */
    readonly price?: ListingContactPrice;
    /**
     * Venue only: the HOS-2256 WhatsApp state from the public payload. When set, the
     * same gated button the page shows is rendered as a row; `null` or absent means none.
     */
    readonly whatsapp?: VenueWhatsAppButtonMode | null;
    readonly venueName?: string;
    /** Sign-in URL returning to this page, for the logged-in-only WhatsApp mode. */
    readonly signInHref?: string;
}

const NETWORK_ICONS = {
    instagram: InstagramIcon,
    facebook: FacebookIcon,
    twitter: TwitterIcon,
    youtube: YoutubeIcon,
    tiktok: TiktokIcon,
    website: GlobeIcon
} as const;

function iconFor({ channel }: { readonly channel: ListingChannel }): ReactNode {
    const props = { size: 18, 'aria-hidden': true } as const;
    if (channel.kind === 'phone') return <PhoneIcon {...props} />;
    if (channel.kind === 'email') return <EmailIcon {...props} />;
    if (channel.kind === 'website') return <GlobeIcon {...props} />;
    const Icon = channel.network ? NETWORK_ICONS[channel.network] : ExternalLinkIcon;
    return <Icon {...props} />;
}

/**
 * Sheet that lists only the channels a listing publishes, opened by the shared
 * listing contact bus. It has no form (HOS-363, HOS-1076). Experiences have no
 * WhatsApp row; venues show it, behind the HOS-2256 plan gate, only when the page
 * passes `whatsapp` (owner decision HOS-2256, which supersedes spec AC-2.10 for
 * venues). Link clicks are reported by the page's delegated
 * `[data-contact-channel]` listener, so each anchor only carries attributes.
 */
export function ListingChannelsPanel({
    panelId,
    listingId,
    vertical,
    locale,
    channels,
    price = null,
    whatsapp = null,
    venueName = '',
    signInHref = ''
}: ListingChannelsPanelProps) {
    const [request, setRequest] = useState<ListingContactPanelOpen | null>(null);
    const open = request !== null;
    const whatsappRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const { t } = createTranslations(locale);
    const display = getListingContactPrice({ price, locale });

    useEffect(() => {
        const unsubscribe = onListingContactPanelOpen(setRequest);
        const clearReady = markListingContactPanelReady({ panelId });
        return () => {
            unsubscribe();
            clearReady();
        };
    }, [panelId]);

    function label({ channel }: { readonly channel: ListingChannel }): string {
        if (channel.kind === 'phone') {
            return t('accommodations.detail.listingContact.panel.shortcuts.phone');
        }
        if (channel.kind === 'email') {
            return t('accommodations.detail.listingContact.panel.shortcuts.email');
        }
        if (channel.kind === 'website') {
            return t('accommodations.detail.listingContact.channels.website');
        }
        return channel.text;
    }

    // The action bar's venue WhatsApp (LOGGED_IN_ONLY, HOS-2579 §6.10.1) opens the
    // sheet on the WhatsApp row. Dialog queues its default focus in the opening
    // frame, so the row is focused one frame later.
    useEffect(() => {
        if (request?.focus !== 'whatsapp') return;
        let focusFrame = 0;
        const openingFrame = requestAnimationFrame(() => {
            focusFrame = requestAnimationFrame(() => {
                const row = whatsappRef.current;
                const control = row?.querySelector<HTMLElement>('a[href], button');
                row?.scrollIntoView?.({ block: 'nearest' });
                control?.focus({ preventScroll: true });
            });
        });
        return () => {
            cancelAnimationFrame(openingFrame);
            cancelAnimationFrame(focusFrame);
        };
    }, [request]);

    const close = () => setRequest(null);

    return (
        <Dialog
            variant="sheet"
            isOpen={open}
            onClose={close}
            ariaLabelledBy={titleId}
        >
            <DialogHeader
                onClose={close}
                closeLabel={t('common.close')}
                titleId={titleId}
            >
                {t('accommodations.detail.listingContact.channels.title')}
            </DialogHeader>
            <DialogBody className={styles.body}>
                {display && (
                    <p className={styles.price}>
                        <strong>{display.amount}</strong> {display.unit}
                    </p>
                )}
                <ul className={styles.list}>
                    {channels.map((channel) => (
                        <li key={`${channel.kind}:${channel.href}`}>
                            <a
                                className={styles.channel}
                                href={channel.href}
                                data-contact-channel={channel.kind}
                                data-listing-id={listingId}
                                data-vertical={vertical}
                                data-contact-origin="panel"
                                {...(channel.external
                                    ? { target: '_blank', rel: 'noopener noreferrer' }
                                    : {})}
                            >
                                {iconFor({ channel })}
                                <span className={styles.label}>{label({ channel })}</span>
                                {channel.kind !== 'social' && (
                                    <span className={styles.value}>{channel.text}</span>
                                )}
                            </a>
                        </li>
                    ))}
                </ul>
                {vertical === 'venue' && whatsapp && (
                    // Only the resolved wa.me link carries the interaction attribute; the
                    // sign-in link does not, so it is never reported as a contact.
                    // biome-ignore lint/a11y/noStaticElementInteractions: delegated tracking for the child link.
                    // biome-ignore lint/a11y/useKeyWithClickEvents: the child link is the keyboard-operable control.
                    <div
                        ref={whatsappRef}
                        className={styles.whatsapp}
                        data-panel-row="whatsapp"
                        onClick={(event) => {
                            const target = event.target;
                            if (
                                target instanceof Element &&
                                target.closest('a[data-interaction-kind="WHATSAPP_CLICK"]')
                            ) {
                                trackEvent(WebEvents.ListingContactClicked, {
                                    listing_id: listingId,
                                    vertical,
                                    channel: 'whatsapp',
                                    origin: 'panel',
                                    locale
                                });
                            }
                        }}
                    >
                        <VenueWhatsAppButton
                            venueId={listingId}
                            venueName={venueName}
                            whatsapp={whatsapp}
                            signInHref={signInHref}
                            locale={locale}
                        />
                    </div>
                )}
            </DialogBody>
        </Dialog>
    );
}
