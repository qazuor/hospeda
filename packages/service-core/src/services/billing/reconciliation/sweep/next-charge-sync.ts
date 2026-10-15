import type { SelectSubscription, SyncNextChargeAtInput } from '@repo/db';
import { subscriptionModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-next-charge-sync');

type NextChargeSubscription = Pick<
    SelectSubscription,
    'status' | 'paymentMethod' | 'class' | 'nextChargeAt'
>;

/** Chooses whether an active card subscription should copy the provider date. */
export function decideNextChargeWrite(input: {
    readonly subscription: NextChargeSubscription;
    readonly providerStatus: string;
    readonly providerNextChargeAt: string | null;
}): Date | null {
    const { subscription, providerStatus, providerNextChargeAt } = input;
    if (providerStatus !== 'active') return null;
    if (subscription.status !== 'ACTIVE') return null;
    if (subscription.paymentMethod !== 'CARD') return null;
    if (subscription.class !== 'PRINCIPAL' && subscription.class !== 'COMPLEMENTO') return null;
    if (providerNextChargeAt === null) return null;

    const nextChargeAt = new Date(providerNextChargeAt);
    if (Number.isNaN(nextChargeAt.getTime())) return null;
    if (subscription.nextChargeAt?.getTime() === nextChargeAt.getTime()) return null;
    return nextChargeAt;
}

/** Model port for the conditional HOS-1685 write. */
export type SyncNextChargeAt = (input: SyncNextChargeAtInput) => Promise<boolean>;

/**
 * HOS-1685: copies the provider next payment date recorded by the sweep
 * (B11.md:250) without treating it as a divergence.
 */
export function createNextChargeSync(ports?: {
    readonly sync?: SyncNextChargeAt;
}): ReconciliationRowCheck {
    return async (input) => {
        const { snapshot } = assertFreshForAct({ read: input.read, act: input.act });
        const at = decideNextChargeWrite({
            subscription: input.subscription,
            providerStatus: snapshot.status,
            providerNextChargeAt: snapshot.nextChargeAt
        });
        if (at === null) {
            logger.debug(
                { subscriptionId: input.subscription.id },
                'Provider next charge date does not need synchronization'
            );
            return;
        }

        const sync = ports?.sync ?? subscriptionModel.syncNextChargeAt.bind(subscriptionModel);
        const now = actStartInstant({ act: input.act }).at;
        const wrote = await sync({ subscriptionId: input.subscription.id, nextChargeAt: at, now });
        if (wrote) {
            logger.info(
                {
                    subscriptionId: input.subscription.id,
                    from: input.subscription.nextChargeAt,
                    to: at
                },
                'Copied provider next charge date onto subscription'
            );
        }
    };
}
