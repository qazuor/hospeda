import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct, confirmAuthorizationMutation } from '@repo/payments';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';

/** Confirms S10 against a fresh provider snapshot before any database transaction. */
export async function confirmPrincipalResume(input: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<
    | { readonly outcome: 'APPLIED'; readonly nextChargeAt: Date | null }
    | { readonly outcome: 'NOT_APPLIED' }
> {
    try {
        const act = { kind: 'decision' as const, startedAt: input.clock.now() };
        actStartInstant({ act });
        const first = await input.provider.readAuthorization({
            authorizationId: input.authorizationId
        });
        const current = assertFreshForAct({ read: first, act }).snapshot;
        let confirmed = current;
        if (current.status === 'paused') {
            const acknowledgement = await input.provider.resume({
                authorizationId: input.authorizationId
            });
            const result = await confirmAuthorizationMutation({
                provider: input.provider,
                acknowledgement,
                sent: { status: 'active' }
            });
            confirmed = assertFreshForAct({ read: result.read, act }).snapshot;
            if (result.outcome !== 'applied') throw new Error('Provider resume was not applied');
        }
        if (confirmed.status !== 'active') throw new Error('Provider is not active');
        return {
            outcome: 'APPLIED',
            nextChargeAt: confirmed.nextChargeAt ? new Date(confirmed.nextChargeAt) : null
        };
    } catch {
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason: 'REANUDACION_NO_APLICADA',
            actor: { type: 'job' },
            correlationId: crypto.randomUUID()
        });
        return { outcome: 'NOT_APPLIED' };
    }
}
