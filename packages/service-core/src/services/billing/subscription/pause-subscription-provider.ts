import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct, confirmAuthorizationMutation } from '@repo/payments';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';

/** Sends S8's pause outside a transaction and trusts only a fresh provider reread. */
export async function confirmPrincipalPause(input: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<'APPLIED' | 'NOT_APPLIED'> {
    try {
        const act = { kind: 'decision' as const, startedAt: input.clock.now() };
        actStartInstant({ act });
        const acknowledgement = await input.provider.pause({
            authorizationId: input.authorizationId
        });
        const confirmation = await confirmAuthorizationMutation({
            provider: input.provider,
            acknowledgement,
            sent: { status: 'paused' }
        });
        const { snapshot } = assertFreshForAct({ read: confirmation.read, act });
        if (confirmation.outcome === 'applied' && snapshot.status === 'paused') return 'APPLIED';
    } catch {
        // The same reconciliation mark covers provider errors and rejected rereads.
    }
    await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: 'PAUSA_NO_APLICADA',
        actor: { type: 'job' },
        correlationId: crypto.randomUUID()
    });
    return 'NOT_APPLIED';
}
