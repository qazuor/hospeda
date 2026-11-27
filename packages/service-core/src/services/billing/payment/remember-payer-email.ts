import type { getDb, subscriptions } from '@repo/db';
import { and, eq, isNull, ne, or, users } from '@repo/db';

/** A transaction handle from `getDb().transaction`. */
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** The subscription columns that decide what a credited charge teaches us. */
type RememberableSubscription = Pick<
    typeof subscriptions.$inferSelect,
    'class' | 'userId' | 'declaredPayerEmail'
>;

/**
 * Decides the email an approved charge leaves behind for its account (HOS-2616).
 *
 * Only a PRINCIPAL or COMPLEMENTO subscription charge teaches one: it carries the email the
 * payer DECLARED at checkout. A LAPIDA has no payer account, and a one-time add-on page has no
 * declared email (the payer types it on the provider's page). The value is never confirmed.
 *
 * @param input.subscription - The subscription the credited payment belongs to, if any.
 * @returns The user and declared email to remember, or `null` when there is nothing to learn.
 */
export function resolvePayerEmailToRemember({
    subscription
}: {
    readonly subscription: RememberableSubscription | undefined;
}): { readonly userId: string; readonly email: string } | null {
    if (!subscription) return null;
    if (subscription.class !== 'PRINCIPAL' && subscription.class !== 'COMPLEMENTO') return null;
    const email = subscription.declaredPayerEmail?.trim();
    if (!subscription.userId || !email) return null;
    return { userId: subscription.userId, email };
}

/**
 * Stores, inside the credit transaction, the declared payer email of an approved charge on its
 * account. Replaces a previous value only when it differs. A declined or unauthorized attempt
 * never reaches this: the caller runs it after the payment turned `SUCCEEDED`.
 *
 * @param input.tx - The credit transaction.
 * @param input.subscription - The subscription the credited payment belongs to, if any.
 */
export async function rememberPayerEmail({
    tx,
    subscription
}: {
    readonly tx: Tx;
    readonly subscription: RememberableSubscription | undefined;
}): Promise<void> {
    const toRemember = resolvePayerEmailToRemember({ subscription });
    if (!toRemember) return;
    await tx
        .update(users)
        .set({ lastSuccessfulPayerEmail: toRemember.email })
        .where(
            and(
                eq(users.id, toRemember.userId),
                or(
                    isNull(users.lastSuccessfulPayerEmail),
                    ne(users.lastSuccessfulPayerEmail, toRemember.email)
                )
            )
        );
}
