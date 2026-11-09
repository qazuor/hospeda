import { addonInstances, addonProducts, eq, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type A5Ports,
    type AddonProviderCancellationPorts,
    type AddonProviderCancellationResult,
    applyA5,
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from './addon-instance-a5.js';

const withdrawSchema = z.object({
    actor: z.object({ id: z.uuid() }),
    instanceId: z.uuid(),
    now: z.date().optional()
});

/** Dependencies for the local A5 act and its post-commit effects. */
export interface WithdrawAddonPorts extends AddonProviderCancellationPorts {
    readonly orphanhood: A5Ports;
    readonly coverageNotices: CoverageNotices;
}

/** The provider result for the one complement cancelled by the withdrawal. */
export type WithdrawAddonProviderCall = AddonProviderCancellationResult['cancelCall'];

/** Withdraws one recurring addon owned by the actor through A5's first clause. */
export async function withdrawAddon(
    input: { readonly actor: Actor; readonly instanceId: string; readonly now?: Date },
    ports: WithdrawAddonPorts
): Promise<{
    readonly instanceId: string;
    readonly status: 'CANCELLED';
    readonly providerCall: WithdrawAddonProviderCall;
}> {
    const parsed = withdrawSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid addon withdrawal input',
            parsed.error.issues,
            'INVALID_ADDON_WITHDRAWAL_INPUT'
        );
    const now = parsed.data.now ?? ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [row] = await tx
            .select({
                ownerId: addonInstances.ownerId,
                status: addonInstances.status,
                chargeKind: addonProducts.chargeKind
            })
            .from(addonInstances)
            .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .where(eq(addonInstances.id, parsed.data.instanceId))
            .limit(1)
            .for('update');
        if (!row || row.ownerId !== parsed.data.actor.id)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Addon instance not found',
                undefined,
                'NOT_FOUND'
            );
        if (
            row.chargeKind !== 'PERIODICO' ||
            (row.status !== 'PENDING_AUTHORIZATION' && row.status !== 'ACTIVE')
        )
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Addon instance cannot be withdrawn',
                undefined,
                'ADDON_NOT_WITHDRAWABLE'
            );
        const result = await applyA5(
            {
                tx,
                instanceId: parsed.data.instanceId,
                clause: 'WITHDRAWN',
                now,
                s21Cause: 'OTHER_CAUSE'
            },
            ports.orphanhood
        );
        if (result.outcome === 'NOT_APPLICABLE')
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Addon instance cannot be withdrawn',
                undefined,
                'ADDON_NOT_WITHDRAWABLE'
            );
        return result.addon;
    });
    await emitAddonCoverageRemoved({
        cancelled: [committed],
        coverageNotices: ports.coverageNotices
    });
    const provider = await cancelAddonComplementsAtProvider({ cancelled: [committed] }, ports);
    return {
        instanceId: committed.instanceId,
        status: 'CANCELLED',
        providerCall: provider.results[0]?.cancelCall ?? 'NOT_NEEDED'
    };
}
