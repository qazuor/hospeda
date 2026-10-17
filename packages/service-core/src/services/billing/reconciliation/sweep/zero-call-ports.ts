import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../types/index.js';
import type { AddonOrphanhoodPorts } from '../../addon/addon-orphanhood-ports.js';
import type { HangablePayment } from '../reconciliation-mark-payments.port.js';

/** Internal A6 boundary implemented by B10 (BL); failure to execute means it throws. */
export interface ListingPurgedAddonCanceller {
    cancelPurgedListingAddon(input: {
        readonly instanceId: string;
        readonly correlationId: string;
    }): Promise<void>;
}

/** Default until B10 registers the A6 implementation. */
export const unimplementedListingPurgedAddonCanceller: ListingPurgedAddonCanceller = {
    async cancelPurgedListingAddon() {
        throw unimplemented('LISTING_PURGED_ADDON_CANCELLER_NOT_REGISTERED');
    }
};

/** Ports needed by the fourth check; fichaPurgada is required to avoid a permissive fallback. */
export type AddonWithoutShutdownPorts = AddonOrphanhoodPorts & {
    readonly listingPurged: VerticalsForBilling['listingPurged'];
    readonly listingPurgedAddons?: ListingPurgedAddonCanceller;
};

/** Pago que S19 retuvo en una fila propia; contexto §8. */
export interface RetainedPayment {
    /** Fila dueña del hecho de pago. */
    readonly subscriptionId: string;
    /** Pago que debe quedar colgado si no hay rama determinable. */
    readonly payment: HangablePayment;
}

/** Fuente de todos los pagos retenidos por S19; contexto §8. */
export interface RetainedPaymentsSource {
    /** Lista la población retenida en una única llamada. */
    listRetainedPayments(): Promise<ReadonlyArray<RetainedPayment>>;
}

/** Resultado de aplicar la rama pendiente; contexto §8. */
export type RetainedPaymentBranchOutcome =
    | { readonly kind: 'RESOLVED' }
    | { readonly kind: 'NO_BRANCH' };

/** Resuelve el destino de B/12 §5.3 para un pago retenido; contexto §8. */
export interface RetainedPaymentBranchResolver {
    /** Ejecuta la rama determinable o informa que no hay rama. */
    resolveByBranch(input: {
        readonly subscriptionId: string;
        readonly payment: HangablePayment;
        readonly correlationId: string;
    }): Promise<RetainedPaymentBranchOutcome>;
}

function unimplemented(reason: string): ServiceError {
    return new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `Reconciliation zero-call port is not registered: ${reason}`,
        undefined,
        reason
    );
}

/** Default visible hasta que B7 registre la fuente real. */
export const unimplementedRetainedPaymentsSource: RetainedPaymentsSource = {
    async listRetainedPayments() {
        throw unimplemented('RETAINED_PAYMENTS_PORT_NOT_REGISTERED');
    }
};

/** Default visible hasta que B7/B8b registre el resolvedor real. */
export const unimplementedRetainedPaymentBranchResolver: RetainedPaymentBranchResolver = {
    async resolveByBranch() {
        throw unimplemented('RETAINED_PAYMENT_BRANCH_PORT_NOT_REGISTERED');
    }
};
