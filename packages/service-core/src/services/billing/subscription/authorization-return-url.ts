/**
 * Query parameter that carries OUR subscription id on the provider's return trip.
 * The web result screen reads it server-side and scrubs it from the URL.
 */
export const AUTHORIZATION_RETURN_SUBSCRIPTION_PARAM = 'subscription';

/** Path of the result screen the provider sends the payer back to (default locale). */
export const AUTHORIZATION_RETURN_PATH = '/es/mi-cuenta/suscripcion/';

/**
 * Compose the `back_url` of a card authorization (HOS-1979).
 *
 * The provider appends `preapproval_id` itself when it redirects the payer back, so
 * the only thing carried here is our own subscription id: it lets the result screen
 * read the real state of THIS attempt. The origin comes from the environment
 * (`HOSPEDA_SITE_URL`), never a hardcoded host.
 *
 * @param input.siteUrl - Public origin of the web app.
 * @param input.subscriptionId - The local subscription the authorization belongs to.
 * @returns The absolute return URL.
 */
export function buildAuthorizationReturnUrl(input: {
    readonly siteUrl: string;
    readonly subscriptionId: string;
}): string {
    const url = new URL(AUTHORIZATION_RETURN_PATH, input.siteUrl);
    url.searchParams.set(AUTHORIZATION_RETURN_SUBSCRIPTION_PARAM, input.subscriptionId);
    return url.toString();
}
