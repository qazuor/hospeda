import { WhatsappLogo } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useSyncExternalStore } from 'react';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';
import styles from './ListingContactActions.module.css';
import {
    isListingContactPanelReady,
    subscribeToListingContactReadiness
} from './listing-contact-readiness';

/** Public context required to open the contact panel from either CTA surface. */
export interface ListingContactActionsProps {
    readonly listingId: string;
    readonly vertical: 'accommodation' | 'experience' | 'venue';
    readonly locale: SupportedLocale;
    readonly hasWhatsapp: boolean;
    readonly panelId: string;
    readonly primaryLabelKey: string;
    readonly origin: 'bar' | 'summary';
}

/** Shared triggers; the contact anchor remains usable before panel hydration or without JS. */
export function ListingContactActions({
    listingId,
    vertical,
    locale,
    hasWhatsapp,
    panelId,
    primaryLabelKey,
    origin
}: ListingContactActionsProps) {
    const { t } = createTranslations(locale);
    const panelReady = useSyncExternalStore(
        subscribeToListingContactReadiness,
        () => isListingContactPanelReady({ panelId }),
        () => false
    );

    function activate({
        event,
        focus
    }: {
        readonly event: MouseEvent<HTMLAnchorElement>;
        readonly focus: 'form' | 'whatsapp';
    }): void {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        trackEvent(WebEvents.ListingContactClicked, {
            listing_id: listingId,
            vertical,
            locale,
            origin,
            channel: focus === 'form' ? 'form_open' : 'whatsapp'
        });
        if (!isListingContactPanelReady({ panelId })) return;
        event.preventDefault();
        // Safari does not focus clicked links. Give Dialog a trigger to restore.
        event.currentTarget.focus({ preventScroll: true });
        openListingContactPanel({
            origin,
            focus: origin === 'bar' && focus === 'form' ? undefined : focus
        });
    }

    return (
        <div className={styles.actions}>
            {vertical === 'accommodation' && hasWhatsapp && (
                // biome-ignore lint/a11y/useValidAnchor: navigates to the real sidebar contact section until the panel is ready.
                <a
                    href="#contact"
                    className={styles.whatsapp}
                    aria-label={t('accommodations.detail.listingContact.panel.shortcuts.whatsapp')}
                    aria-haspopup={panelReady ? 'dialog' : undefined}
                    onClick={(event) => activate({ event, focus: 'whatsapp' })}
                >
                    <WhatsappLogo
                        size={22}
                        weight="fill"
                        aria-hidden="true"
                    />
                </a>
            )}
            {/* biome-ignore lint/a11y/useValidAnchor: the real contact anchor progressively enhances to a dialog. */}
            <a
                href="#contact"
                className={`${styles.primary} btn-gradient--accent`}
                aria-haspopup={panelReady ? 'dialog' : undefined}
                onClick={(event) => activate({ event, focus: 'form' })}
            >
                {t(primaryLabelKey)}
            </a>
        </div>
    );
}
