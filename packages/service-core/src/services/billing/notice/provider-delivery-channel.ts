/** Channel assigned to an incoming provider delivery. */
export type ProviderDeliveryChannel = 'IPN' | 'WEBHOOKS';

/**
 * Derives the delivery channel from the URL. HOS-1726 keeps our exact
 * `source_news=webhooks` marker and also recognizes the measured Webhooks
 * query shape (`data.id` plus `type`), because the marker can be lost when
 * someone edits the provider panel. The query shape is measured for both
 * channels; `x-signature` cannot distinguish them because IPN also sends it.
 */
export function deliveryChannelFromUrl({ url }: { readonly url: string }): ProviderDeliveryChannel {
    try {
        const parsed = new URL(url, 'http://placeholder.invalid');
        const hasWebhookShape =
            Boolean(parsed.searchParams.get('data.id')) && Boolean(parsed.searchParams.get('type'));
        return parsed.searchParams.get('source_news') === 'webhooks' || hasWebhookShape
            ? 'WEBHOOKS'
            : 'IPN';
    } catch {
        return 'IPN';
    }
}
