import { PaymentProviderError } from '@repo/payments';
import {
    rejectedCreationResult,
    throttledCreationResult
} from '../subscription/resolve-live-commitment';
import { abandonPendingComplementPair } from './release-pending-complement';

/**
 * Whether a provider failure proves nothing exists at the provider for this creation: a 4xx
 * rejection or a 429 refused before processing. A 5xx or transport failure has an unknown
 * outcome and must keep the pending row for the creations sweep to resolve.
 */
export function isCreationRefusedBeforeExisting(error: unknown): error is PaymentProviderError {
    return (
        error instanceof PaymentProviderError &&
        error.capability === 'authorize' &&
        (error.code === 'REJECTED' || error.transient?.kind === 'RATE_LIMITED')
    );
}

/**
 * HOS-2321: closes a recurring purchase whose preapproval creation the provider refused, so the
 * unique purchase identity is released and the owner's retry reaches a fresh checkout instead of
 * answering PENDING_ELSEWHERE for the whole authorization window. Completes the creation key,
 * then abandons the never-linked COMPLEMENTO and its instance atomically. Nothing exists at the
 * provider, so no cancellation is decided.
 *
 * @param input.instanceId - The pending addon instance
 * @param input.complementId - Its pending COMPLEMENTO subscription
 * @param input.idempotencyKey - The open PREAPPROVAL_CREATE key
 * @param input.rateLimited - Whether the refusal was a throttle rather than a rejection
 * @param input.now - The instant of the transition
 * @returns Whether this call performed the abandonment
 */
export async function abandonRefusedComplement(input: {
    readonly instanceId: string;
    readonly complementId: string;
    readonly idempotencyKey: string;
    readonly rateLimited: boolean;
    readonly now: Date;
}): Promise<boolean> {
    return abandonPendingComplementPair({
        complementId: input.complementId,
        instanceId: input.instanceId,
        now: input.now,
        actor: { type: 'provider', id: null },
        openKey: {
            key: input.idempotencyKey,
            result: input.rateLimited ? throttledCreationResult() : rejectedCreationResult()
        },
        decidesProviderCancellation: false
    });
}
