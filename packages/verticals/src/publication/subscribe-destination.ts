import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { evaluateTrialStart } from '../trial/trial-start';
import type {
    TrialStartDeniedReason,
    TrialStartInput,
    TrialStartReader
} from '../trial/trial-start-types';

export type SubscribeDestination =
    | { readonly destination: 'COVERED' }
    | { readonly destination: 'NO_PLANS_AVAILABLE' }
    | { readonly destination: 'PUBLISH'; readonly trialDays: number }
    | { readonly destination: 'CHECKOUT'; readonly reason: TrialStartDeniedReason };

export async function resolveSubscribeDestination(args: {
    readonly reader: TrialStartReader;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly input: TrialStartInput;
}): Promise<SubscribeDestination> {
    const coverage = await args.billing.coverage({
        userId: args.input.userId,
        vertical: args.input.vertical
    });
    if (coverage.covered) return { destination: 'COVERED' };
    const versions = await args.reader.findSellableCurrentVersions({
        vertical: args.input.vertical
    });
    if (versions.length === 0) return { destination: 'NO_PLANS_AVAILABLE' };
    const decision = await evaluateTrialStart(args);
    if (decision.starts) return { destination: 'PUBLISH', trialDays: decision.plan.trialDays };
    if (decision.reason === 'ALREADY_COVERED') return { destination: 'COVERED' };
    return { destination: 'CHECKOUT', reason: decision.reason };
}
