import type { ReconciliationMarkReason } from '@repo/db';
import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { assertFreshForAct } from '@repo/payments';
import { getProviderNoticeMirror, READ_STATES } from '../../../notice/provider-notice-mirror.js';
import type { ReconciliationComparison } from '../reconciliation-divergence.js';

const TRANSITION_NOT_DECLARED =
    'TRANSICION_NO_DECLARADA' as const satisfies ReconciliationMarkReason;

/**
 * AC:B11:8 (H1): marks provider states for which the shared transition mirror
 * declares no transition. The sweep never runs transitions or delegates; those
 * belong to their pieces (AC:B11:7, §7 idempotency).
 */
export function createStateComparison(): ReconciliationComparison {
    return ({ subscription, read, act }) => {
        const { snapshot } = assertFreshForAct({ read, act });
        const providerState = READ_STATES.find((state) => state === snapshot.status);
        const rowStatus = SUBSCRIPTION_STATUSES.find((status) => status === subscription.status);
        if (!providerState || !rowStatus) return [];
        const action = getProviderNoticeMirror()[providerState][rowStatus];
        return action.kind === 'DIVERGENCE' ? [{ reason: TRANSITION_NOT_DECLARED }] : [];
    };
}
