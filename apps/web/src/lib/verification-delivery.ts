import { z } from 'zod';
import { EmailFormatSchema } from './forms/email-format';

const key = 'hospeda:verification-delivery';
const schema = z.object({
    email: EmailFormatSchema,
    callbackURL: z.url(),
    retryAt: z.number(),
    expiresAt: z.number()
});
type Delivery = z.infer<typeof schema>;

/** Save short-lived verification context in this tab, never in a URL. */
export function saveVerificationDelivery({
    email,
    callbackURL
}: Pick<Delivery, 'email' | 'callbackURL'>): void {
    try {
        sessionStorage.setItem(
            key,
            JSON.stringify({
                email,
                callbackURL,
                retryAt: Date.now() + 60_000,
                expiresAt: Date.now() + 30 * 60_000
            })
        );
    } catch {
        // The confirmation page still works without browser storage.
    }
}

/** Return the pending delivery if this tab recently completed signup. */
export function readVerificationDelivery(): Delivery | null {
    try {
        const result = schema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? 'null'));
        if (result.success && result.data.expiresAt > Date.now()) return result.data;
        sessionStorage.removeItem(key);
    } catch {
        // Unavailable or malformed storage is equivalent to a direct visit.
    }
    return null;
}
