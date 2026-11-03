import { timingSafeEqual } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { getDb, partnerApplicationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { extractPostgresErrorCause, ServiceError } from '@repo/service-core';
import { hashPartnerClaimSecret } from '../../utils/partner-application/partner-claim-secret';
import { userCache } from '../../utils/user-cache';
import {
    PARTNER_ALREADY_CLAIMED,
    PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS
} from './partner-application-errors';
import { writePartnerClaim } from './partner-claim.service';

const NOT_FOUND_MESSAGE = 'Partner not found';

/** Claims a Partner through its single-use secret in one transaction. */
export async function claimPartnerByLink(input: {
    readonly actorUserId: string;
    readonly currentSessionId: string | null;
    readonly partnerId: string;
    readonly secret: string;
}): Promise<{
    readonly claimed: true;
    readonly partnerId: string;
    readonly emailVerified: boolean;
}> {
    const computedHex = hashPartnerClaimSecret({ secret: input.secret });
    let verifiedDuringClaim = false;
    let accountAlreadyOwns = false;
    try {
        const result = await getDb().transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const partner = await partnerApplicationModel.lockPartnerForLinkClaim({
                tx,
                partnerId: input.partnerId
            });
            const storedHex = partner?.claimSecretHash;
            const safeStoredHex =
                storedHex && /^[0-9a-f]{64}$/i.test(storedHex) ? storedHex : '0'.repeat(64);
            const expected = Buffer.from(computedHex, 'hex');
            const actual = Buffer.from(safeStoredHex, 'hex');
            const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
            if (!partner || !storedHex || !/^[0-9a-f]{64}$/i.test(storedHex) || !matches) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
            }
            if (partner.ownerUserId !== null) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Partner already claimed',
                    undefined,
                    PARTNER_ALREADY_CLAIMED
                );
            }
            const account = await partnerApplicationModel.readAccountForClaim({
                tx,
                userId: input.actorUserId
            });
            if (!account) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Account not found');
            const shouldVerify =
                !account.emailVerified &&
                partner.applicationEmail !== null &&
                account.email.toLowerCase() === partner.applicationEmail.toLowerCase();
            if (!account.emailVerified && !shouldVerify) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Email verification required',
                    undefined,
                    'EMAIL_NOT_VERIFIED'
                );
            }
            if (
                await partnerApplicationModel.findOwnedPartnerId({ tx, userId: input.actorUserId })
            ) {
                accountAlreadyOwns = true;
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Account already owns a Partner',
                    undefined,
                    PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS
                );
            }
            let extraChanges: {
                readonly field: string;
                readonly old: unknown;
                readonly new: unknown;
            }[] = [];
            if (shouldVerify) {
                if (!input.currentSessionId)
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Authentication required'
                    );
                const session = await partnerApplicationModel.readSessionAuthMethod({
                    tx,
                    sessionId: input.currentSessionId,
                    userId: input.actorUserId
                });
                if (!session.found)
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Authentication required'
                    );
                const sweep = await partnerApplicationModel.verifyAccountAndRevokeOthers({
                    tx,
                    userId: input.actorUserId,
                    email: account.email,
                    keepSessionId: input.currentSessionId,
                    keepProviderId:
                        session.authMethod === 'email-verification' ? null : session.authMethod
                });
                verifiedDuringClaim = true;
                extraChanges = [
                    { field: 'email_verified', old: false, new: true },
                    {
                        field: 'revoked_session_count',
                        old: null,
                        new: sweep.revokedSessionIds.length
                    },
                    {
                        field: 'removed_credential_providers',
                        old: null,
                        new: sweep.removedProviderIds
                    }
                ];
            }
            const write = await writePartnerClaim({
                tx,
                partnerId: input.partnerId,
                userId: input.actorUserId,
                origin: 'claim_link',
                extraChanges
            });
            if (!write.written)
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Partner already claimed',
                    undefined,
                    PARTNER_ALREADY_CLAIMED
                );
            return {
                claimed: true as const,
                partnerId: input.partnerId,
                emailVerified: account.emailVerified || shouldVerify
            };
        });
        if (verifiedDuringClaim) await userCache.invalidate(input.actorUserId);
        return result;
    } catch (error) {
        const postgresError = extractPostgresErrorCause(error);
        if (
            postgresError?.code === '23505' &&
            postgresError.constraint === 'uq_partners_owner_user_id'
        ) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Account already owns a Partner',
                undefined,
                PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS
            );
        }
        if (accountAlreadyOwns && error instanceof ServiceError) throw error;
        throw error;
    }
}
