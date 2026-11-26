import { EmailIcon, PhoneIcon } from '@repo/icons';
import type { ReactNode, Ref } from 'react';
import type { WhatsAppContactProps } from '@/components/accommodation/WhatsAppContact.client';
import { WhatsAppContact } from '@/components/accommodation/WhatsAppContact.client';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ListingInquiryLayout.module.css';

interface Props {
    readonly listingId: string;
    readonly origin: 'sidebar' | 'panel';
    readonly locale: SupportedLocale;
    readonly phone?: string | null;
    readonly email?: string | null;
    readonly whatsapp?: WhatsAppContactProps;
    readonly whatsappRef?: Ref<HTMLElement>;
    readonly children: ReactNode;
}

/** Shared sheet/sidebar contact hierarchy, ordered in the DOM for keyboard navigation. */
export function ListingInquiryLayout({
    listingId,
    origin,
    locale,
    phone,
    email,
    whatsapp,
    whatsappRef,
    children
}: Props) {
    const { t } = createTranslations(locale);
    const tel = phone?.trim().replace(/[\s().-]/g, '');
    const address = email?.trim();
    const links = [
        { kind: 'phone', href: tel && /^\+?\d+$/.test(tel) ? `tel:${tel}` : null, Icon: PhoneIcon },
        {
            kind: 'email',
            href: address && /^[^\s@?#]+@[^\s@?#]+$/.test(address) ? `mailto:${address}` : null,
            Icon: EmailIcon
        }
    ] as const;
    const shortcuts = links.some(({ href }) => href) && (
        <div className={styles.shortcuts}>
            {links.map(
                ({ kind, href, Icon }) =>
                    href && (
                        <GradientButton
                            key={kind}
                            href={href}
                            label={t(
                                `accommodations.detail.listingContact.panel.shortcuts.${kind}`
                            )}
                            leadingIcon={
                                <Icon
                                    size={16}
                                    aria-hidden="true"
                                />
                            }
                            className={styles.shortcut}
                            variant="outline-primary"
                            size="md"
                            onClick={() =>
                                trackEvent(WebEvents.ListingContactClicked, {
                                    listing_id: listingId,
                                    vertical: 'accommodation',
                                    channel: kind,
                                    origin,
                                    locale
                                })
                            }
                        />
                    )
            )}
        </div>
    );

    function renderLayout({
        channel,
        primary
    }: {
        readonly channel: ReactNode;
        readonly primary: boolean;
    }) {
        const whatsAppSection = channel && (
            <section
                key="whatsapp"
                ref={whatsappRef}
                tabIndex={-1}
                aria-label={t('accommodations.detail.listingContact.panel.shortcuts.whatsapp')}
            >
                {channel}
            </section>
        );
        return (
            <div className={styles.layout}>
                {primary ? whatsAppSection : null}
                {shortcuts}
                <div
                    key="inquiry"
                    data-secondary={primary || undefined}
                >
                    {children}
                </div>
                {primary ? null : whatsAppSection}
            </div>
        );
    }

    return whatsapp ? (
        <WhatsAppContact
            {...whatsapp}
            renderLayout={renderLayout}
        />
    ) : (
        renderLayout({ channel: null, primary: false })
    );
}
