import { randomUUID } from 'node:crypto';
import { getDb } from '@repo/db';
import type { AdminCreatePartner, Partner } from '@repo/schemas';
import { type Actor, PartnerService, ServiceError } from '@repo/service-core';
import { getRequestCorrelationId } from '../../lib/request-context';
import { apiLogger } from '../../utils/logger';
import { enqueuePartnerClaimNotice } from './partner-application-notices';

/**
 * Creates an unowned Partner and queues its claim notice in one transaction
 * (AC:V7:11). The role arrives with the claim (V/18 §2.5); the notice is always
 * sent, whether or not an account owns the address (V7 Outbox, D-5).
 */
export async function createPartnerDirectly(input: {
    readonly actor: Actor;
    readonly input: AdminCreatePartner;
}): Promise<Partner> {
    return getDb().transaction(async (tx) => {
        const { claimEmail, ...partnerInput } = input.input;
        const result = await new PartnerService({ logger: apiLogger }).create(
            input.actor,
            partnerInput,
            { tx }
        );
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        await enqueuePartnerClaimNotice({
            tx,
            email: claimEmail,
            partnerId: result.data.id,
            partnerName: result.data.name,
            correlationId: getRequestCorrelationId() ?? randomUUID()
        });
        return result.data;
    });
}
