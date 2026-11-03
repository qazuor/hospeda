import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, getDb, partnerApplicationModel } from '@repo/db';
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { extractPostgresErrorCause, grantRole } from '@repo/service-core';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { apiLogger } from '../../utils/logger';

/**
 * Claims only for the account created by approval when that account verifies its email (D-3).
 * An account that already existed for the address claims through the V7.2 link flow.
 */
export async function claimPartnerOnEmailVerification(input: {
    readonly userId: string;
    readonly email: string;
}): Promise<{ readonly claimed: boolean }> {
    try {
        return await getDb().transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const candidate = await partnerApplicationModel.lockPartnerClaimableByCreatedAccount({
                tx,
                userId: input.userId,
                email: input.email
            });
            if (!candidate) return { claimed: false };

            const changed = await partnerApplicationModel.setPartnerOwnerIfUnclaimed({
                tx,
                partnerId: candidate.partnerId,
                userId: input.userId
            });
            if (!changed) return { claimed: false };

            const granted = await grantRole({
                userId: input.userId,
                role: RoleEnum.PARTNER_OWNER,
                grantedBy: null,
                reason: RoleGrantReason.PARTNER_CLAIMED,
                ctx: { tx }
            });
            if (granted.error) throw granted.error;

            await domainEventModel.insert({
                tx,
                eventType: 'partner.claimed',
                entityType: 'partner',
                entityId: candidate.partnerId,
                actorType: 'owner',
                actorId: input.userId,
                reason: 'email_verification',
                correlationId: getRequestCorrelationId() ?? randomUUID(),
                occurredAt: getClock().clock.now(),
                changes: [{ field: 'owner_user_id', old: null, new: input.userId }]
            });
            return { claimed: true };
        });
    } catch (error) {
        const postgresError = extractPostgresErrorCause(error);
        if (
            postgresError?.code === '23505' &&
            postgresError.constraint === 'uq_partners_owner_user_id'
        ) {
            apiLogger.warn(
                { userId: input.userId },
                'Partner claim skipped because account already owns a Partner'
            );
            return { claimed: false };
        }
        throw error;
    }
}
