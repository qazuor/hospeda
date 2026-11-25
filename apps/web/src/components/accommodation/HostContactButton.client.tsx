/**
 * @file HostContactButton.client.tsx
 * @description «Consultar» button of the host section (HOS-2530). It opens the same
 * contact panel the mobile bar opens, through `openListingContactPanel`, and falls back
 * to the in-page `#contact` anchor until the panel island has hydrated (or without JS).
 */
import type { MouseEvent } from 'react';
import { useSyncExternalStore } from 'react';
import {
    isListingContactPanelReady,
    subscribeToListingContactReadiness
} from '@/components/listing/contact/listing-contact-readiness';
import { useListingConversationAction } from '@/hooks/use-listing-conversation-action';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';
import styles from './HostContactButton.module.css';

/** Props of {@link HostContactButton}. */
export interface HostContactButtonProps {
    readonly listingId: string;
    readonly locale: SupportedLocale;
    /** Id of the contact panel this button opens. */
    readonly panelId: string;
}

/** Opens the listing contact panel from the host section. */
export function HostContactButton({ listingId, locale, panelId }: HostContactButtonProps) {
    const action = useListingConversationAction({ accommodationId: listingId, locale });
    const panelReady = useSyncExternalStore(
        subscribeToListingContactReadiness,
        () => isListingContactPanelReady({ panelId }),
        () => false
    );

    function activate(event: MouseEvent<HTMLAnchorElement>): void {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        trackEvent(WebEvents.ListingContactClicked, {
            listing_id: listingId,
            vertical: 'accommodation',
            locale,
            origin: 'contact_block',
            channel: 'form_open'
        });
        if (!isListingContactPanelReady({ panelId })) return;
        event.preventDefault();
        // Safari does not focus clicked links; give Dialog a trigger to restore.
        event.currentTarget.focus({ preventScroll: true });
        openListingContactPanel({ origin: 'contact_block', focus: 'form' });
    }

    return (
        <a
            href={action.href}
            className={`${styles.button} btn-gradient--accent btn-gradient--flat`}
            aria-haspopup={!action.hasConversation && panelReady ? 'dialog' : undefined}
            onClick={action.hasConversation ? undefined : activate}
        >
            {action.label}
        </a>
    );
}
