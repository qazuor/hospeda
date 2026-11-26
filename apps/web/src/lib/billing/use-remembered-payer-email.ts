import { useEffect, useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';

/**
 * Loads the payer email remembered for the signed-in account (HOS-2616): the email declared on
 * its last approved subscription or complement charge. It only prefills a checkout and is never
 * a confirmed email. Resolves to `null` when there is none or the read fails, so a checkout
 * falls back to asking for the email as before.
 *
 * @returns The remembered email, or `null` until loaded / when absent.
 */
export function useRememberedPayerEmail(): { readonly rememberedEmail: string | null } {
    const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            // A convenience read: whatever goes wrong, the checkout keeps asking for the email.
            try {
                const result = await billingSubscriptionApi.readRememberedPayerEmail();
                if (cancelled || !result.ok) return;
                setRememberedEmail(result.data.rememberedPayerEmail?.trim() || null);
            } catch {
                // Falls back to the plain email field.
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);
    return { rememberedEmail };
}
