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
import { useEffect, useId, useState } from 'react';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
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
 * listing contact bus. It has no form and no WhatsApp row by design (HOS-363,
 * HOS-1076). Link clicks are reported by the page's delegated
 * `[data-contact-channel]` listener, so each anchor only carries attributes.
 */
export function ListingChannelsPanel({
    panelId,
    listingId,
    vertical,
    locale,
    channels,
    price = null
}: ListingChannelsPanelProps) {
    const [open, setOpen] = useState(false);
    const titleId = useId();
    const { t } = createTranslations(locale);
    const display = getListingContactPrice({ price, locale });

    useEffect(() => {
        const unsubscribe = onListingContactPanelOpen((_request: ListingContactPanelOpen) =>
            setOpen(true)
        );
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

    const close = () => setOpen(false);

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
            </DialogBody>
        </Dialog>
    );
}
