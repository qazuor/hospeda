/** Channel assigned to an incoming provider delivery. */
export type ProviderDeliveryChannel = 'IPN' | 'WEBHOOKS';

/** Derives the delivery channel from the complete request URL. */
export function deliveryChannelFromUrl({ url }: { readonly url: string }): ProviderDeliveryChannel {
    try {
        const parsed = new URL(url, 'http://placeholder.invalid');
        return parsed.searchParams.get('source_news') === 'webhooks' ? 'WEBHOOKS' : 'IPN';
    } catch {
        return 'IPN';
    }
}
