import { AnalyticsEventSchemas } from '@repo/analytics';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';

const trackedDocuments = new WeakSet<Document>();

/** Installs one delegated contact-link listener per document, including across Astro page swaps. */
export function initContactLinkTracking({ document }: { readonly document: Document }): void {
    if (trackedDocuments.has(document)) return;
    trackedDocuments.add(document);

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const link = event.target.closest<HTMLAnchorElement>('a[href][data-contact-channel]');
        if (!link) return;

        const parsed = AnalyticsEventSchemas[WebEvents.ListingContactClicked].safeParse({
            listing_id: link.dataset.listingId?.trim(),
            vertical: link.dataset.vertical,
            channel: link.dataset.contactChannel,
            origin: link.dataset.contactOrigin,
            locale: document.documentElement.dataset.locale
        });
        if (parsed.success) trackEvent(WebEvents.ListingContactClicked, parsed.data);
    });
}
