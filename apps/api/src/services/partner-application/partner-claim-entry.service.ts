import type { DrizzleClient } from '@repo/db';
import { eq, getDb, partnerApplicationModel, users } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getAuth } from '../../lib/auth';
import { apiLogger } from '../../utils/logger';
import {
    PARTNER_ALREADY_CLAIMED,
    PARTNER_CLAIM_ACCOUNT_EXISTS
} from './partner-application-errors';
import { claimPartnerByLink, verifyPartnerClaimLink } from './partner-link-claim.service';

function accountExistsError(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'An account already exists for this claim email',
        undefined,
        PARTNER_CLAIM_ACCOUNT_EXISTS
    );
}

function isAccountAlreadyExists(error: unknown): boolean {
    return (
        error instanceof Error &&
        /USER_ALREADY_EXISTS|user already exists|email already exists/i.test(error.message)
    );
}

function isPartnerAlreadyClaimed(error: unknown): boolean {
    return error instanceof ServiceError && error.reason === PARTNER_ALREADY_CLAIMED;
}

async function verifyEntryClaimLink(input: {
    readonly tx: DrizzleClient;
    readonly partnerId: string;
    readonly secret: string;
}): Promise<{ readonly claimEmail: string }> {
    try {
        const { claimEmail } = await verifyPartnerClaimLink(input);
        if (!claimEmail) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        return { claimEmail };
    } catch (error) {
        if (isPartnerAlreadyClaimed(error))
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        throw error;
    }
}

/** Looks up the account associated with a valid, unused Partner claim link. */
export async function lookupPartnerClaim(input: {
    readonly partnerId: string;
    readonly secret: string;
}): Promise<{ readonly email: string; readonly accountExists: boolean }> {
    return getDb().transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        const { claimEmail } = await verifyEntryClaimLink({ ...input, tx });
        const account = await partnerApplicationModel.findAccountIdByEmail({
            tx,
            email: claimEmail
        });
        return { email: claimEmail, accountExists: account !== null };
    });
}

/** Creates the verified mailbox account and claims the Partner with its token. */
export async function signUpAndClaimPartner(input: {
    readonly partnerId: string;
    readonly secret: string;
    readonly password: string;
}): Promise<{ readonly claimed: true; readonly partnerId: string; readonly email: string }> {
    const { email } = await getDb().transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        const { claimEmail } = await verifyEntryClaimLink({
            tx,
            partnerId: input.partnerId,
            secret: input.secret
        });
        const account = await partnerApplicationModel.findAccountIdByEmail({
            tx,
            email: claimEmail
        });
        if (account) throw accountExistsError();
        return { email: claimEmail };
    });

    let newUserId: string;
    try {
        const created = await getAuth().api.createUser({
            body: {
                email,
                password: input.password,
                name: '',
                data: { emailVerified: true }
            }
        });
        newUserId = created.user.id;
    } catch (error) {
        if (isAccountAlreadyExists(error)) throw accountExistsError();
        throw error;
    }

    // `createUser` runs Better Auth's `user.create.after` hook (measured in HOS-2299:
    // the baseline USER role is granted by it), so no manual baseline grant is needed.
    // `partner-claim-signup.test.ts` pins that the created account holds USER.

    try {
        await claimPartnerByLink({
            actorUserId: newUserId,
            currentSessionId: null,
            partnerId: input.partnerId,
            secret: input.secret
        });
    } catch (error) {
        try {
            await getDb().delete(users).where(eq(users.id, newUserId));
        } catch (cleanupError) {
            apiLogger.error(
                {
                    userId: newUserId,
                    error:
                        cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                },
                'Partner claim signup cleanup failed'
            );
        }
        if (isAccountAlreadyExists(error)) throw accountExistsError();
        throw error;
    }

    return { claimed: true, partnerId: input.partnerId, email };
}
