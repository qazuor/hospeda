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
    let claimedPartnerId: string | null = null;
    try {
        return await getDb().transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const candidate = await partnerApplicationModel.lockPartnerClaimableByCreatedAccount({
                tx,
                userId: input.userId,
                email: input.email
            });
            if (!candidate) return { claimed: false };
            claimedPartnerId = candidate.partnerId;

            const result = await writePartnerClaim({
                tx,
                partnerId: candidate.partnerId,
                userId: input.userId,
                origin: 'email_verification',
                extraChanges: []
            });
            return { claimed: result.written };
        });
    } catch (error) {
        const postgresError = extractPostgresErrorCause(error);
        if (
            postgresError?.code === '23505' &&
            postgresError.constraint === 'uq_partners_owner_user_id'
        ) {
            apiLogger.warn(
                { userId: input.userId, partnerId: claimedPartnerId },
                'Partner claim skipped because account already owns a Partner'
            );
            return { claimed: false };
        }
        throw error;
    }
}

/** Writes the owner, role, and audit event for either Partner claim origin. */
export async function writePartnerClaim(input: {
    readonly tx: DrizzleClient;
    readonly partnerId: string;
    readonly userId: string;
    readonly origin: 'email_verification' | 'claim_link';
    readonly extraChanges: readonly {
        readonly field: string;
        readonly old: unknown;
        readonly new: unknown;
    }[];
}): Promise<{ readonly written: boolean }> {
    const changed = await partnerApplicationModel.setPartnerOwnerIfUnclaimed({
        tx: input.tx,
        partnerId: input.partnerId,
        userId: input.userId
    });
    if (!changed) return { written: false };
    const granted = await grantRole({
        userId: input.userId,
        role: RoleEnum.PARTNER_OWNER,
        grantedBy: null,
        reason: RoleGrantReason.PARTNER_CLAIMED,
        ctx: { tx: input.tx }
    });
    if (granted.error) throw granted.error;
    await domainEventModel.insert({
        tx: input.tx,
        eventType: 'partner.claimed',
        entityType: 'partner',
        entityId: input.partnerId,
        actorType: 'owner',
        actorId: input.userId,
        reason: input.origin,
        correlationId: getRequestCorrelationId() ?? randomUUID(),
        occurredAt: getClock().clock.now(),
        changes: [{ field: 'owner_user_id', old: null, new: input.userId }, ...input.extraChanges]
    });
    return { written: true };
}
