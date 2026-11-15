import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CancelledAddon } from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import type { SuccessorState, SuccessorTargetState } from './successor-cut-writes';
import { cutSuccessorWrites } from './successor-cut-writes';

const inputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });
export type SuccessorCutResult =
    | { readonly outcome: 'NO_LIVE_SUCCESSOR' }
    | {
          readonly outcome: 'CUT';
          readonly successorId: string;
          readonly predecessorId: string;
          readonly from: 'PENDING_AUTHORIZATION' | 'ACTIVE';
          readonly to: 'ABANDONED' | 'CANCELLED';
          readonly userId: string;
          readonly vertical: string;
          readonly paymentMethod: string;
          readonly authorizationId: string | null;
          readonly closedCourtesyMonths: number | null;
          readonly manualInstallmentClosed: boolean;
          readonly cancelledAddons: readonly CancelledAddon[];
          readonly cancellationDecided: boolean;
      };
/** S31 interface called by the chargeback transition inside its transaction. */
export interface SuccessorCutter {
    /** Cuts a live successor using only the caller's transaction. */
    cutSuccessor(input: {
        readonly predecessorSubscriptionId: string;
        readonly tx: DrizzleClient;
    }): Promise<SuccessorCutResult>;
}
/** Default until S6/S12 composition roots register the S31 implementation. */
export const unimplementedSuccessorCutter: SuccessorCutter = {
    async cutSuccessor() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Successor cutter is not registered',
            undefined,
            'SUCCESSOR_CUTTER_NOT_REGISTERED'
        );
    }
};
/** Creates the local S31 writer (TRANS:B:S31, AC:B8b:13). */
export function createSuccessorCutter(ports: {
    readonly clock: Clock;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly writeStatus?: (input: {
        readonly tx: DrizzleClient;
        readonly successorId: string;
        readonly from: SuccessorState;
        readonly to: SuccessorTargetState;
        readonly now: Date;
    }) => Promise<void>;
}): SuccessorCutter {
    return {
        async cutSuccessor(input) {
            const parsed = inputSchema.parse({
                predecessorSubscriptionId: input.predecessorSubscriptionId
            });
            const result = await cutSuccessorWrites(
                { ...parsed, tx: input.tx },
                { ...ports, writeStatus: ports.writeStatus }
            );
            if (result.outcome === 'NO_LIVE_SUCCESSOR') return result;
            return result;
        }
    };
}
