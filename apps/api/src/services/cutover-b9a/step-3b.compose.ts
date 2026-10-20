import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { type Actor, getUserRoles } from '@repo/service-core';
import { resolveEffectivePermissions } from '../../middlewares/actor.js';
import { buildPermanentGrantPorts } from '../../routes/billing-permanent-grant/admin/ports.js';
import { injectClock, systemClock } from '../../utils/clock.js';
import {
    drainListingCoverageRecalculations,
    subscribeListingCoverageRecalculation
} from '../../utils/listing-publication/coverage-listener.js';
import { defaultPaymentProvider, injectPaymentProvider } from '../../utils/payment-provider.js';
import { subscribeTrialCoverageConversion } from '../../utils/trial/trial-coverage-listener.js';

/** Optional process dependencies for deterministic cutover integration tests. */
export interface ComposeStep3bOptions {
    readonly clock?: Clock;
    readonly provider?: PaymentProvider;
}

/** Error raised when an operator's complete authorization identity cannot be resolved. */
export class Step3bOperatorUnresolvedError extends Error {
    constructor() {
        super('Could not resolve the cutover operator roles and permissions.');
        this.name = 'Step3bOperatorUnresolvedError';
    }
}

/** Injects process dependencies and builds grant ports; stop waits for in-flight listing recalculations. */
export function composeStep3bProcess(options: ComposeStep3bOptions = {}): {
    readonly ports: ReturnType<typeof buildPermanentGrantPorts>;
    readonly stop: () => Promise<void>;
} {
    const clock = options.clock ?? systemClock;
    injectClock({ clock });
    injectPaymentProvider({ provider: options.provider ?? defaultPaymentProvider({ clock }) });
    const stopListing = subscribeListingCoverageRecalculation();
    const stopTrial = subscribeTrialCoverageConversion();
    return {
        ports: buildPermanentGrantPorts(),
        async stop() {
            stopTrial();
            stopListing();
            await drainListingCoverageRecalculations();
        }
    };
}

/** Resolves the operator's roles and uncached effective permissions like the request middleware. */
export async function resolveCutoverOperatorActor(input: {
    readonly userId: string;
}): Promise<Actor> {
    try {
        const roles = await getUserRoles({ userId: input.userId });
        if (roles.length === 0) throw new Step3bOperatorUnresolvedError();
        const { permissions } = await resolveEffectivePermissions({
            userId: input.userId,
            roles,
            read: 'uncached'
        });
        return { id: input.userId, roles, permissions: [...permissions] };
    } catch {
        throw new Step3bOperatorUnresolvedError();
    }
}
