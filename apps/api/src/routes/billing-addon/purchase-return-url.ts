import type { Context } from 'hono';
import { env } from '../../utils/env';
import { SUPPORTED_RETURN_URL_LOCALES } from '../../utils/return-url-locale';

/** Builds the addon checkout return URL from a validated client locale. */
export function addonPurchaseReturnUrl(input: {
    readonly ctx: Context;
    readonly orderRequestId: string;
}): string {
    const raw = input.ctx.req.header('x-client-locale');
    const locale =
        raw && (SUPPORTED_RETURN_URL_LOCALES as readonly string[]).includes(raw) ? raw : 'es';
    return `${env.HOSPEDA_SITE_URL.replace(/\/$/, '')}/${locale}/mi-cuenta/complementos/?compra=${encodeURIComponent(input.orderRequestId)}`;
}
