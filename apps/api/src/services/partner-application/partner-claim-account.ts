import { randomBytes } from 'node:crypto';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getAuth } from '../../lib/auth';

/** Creates the temporary account whose email verification can claim an approved Partner. */
export async function createClaimAccount(input: {
    readonly email: string;
}): Promise<string | null> {
    const localPart = input.email.split('@', 1)[0] ?? input.email;
    try {
        const result = await getAuth().api.signUpEmail({
            body: {
                email: input.email,
                password: randomBytes(32).toString('base64url'),
                name: localPart
            },
            asResponse: false
        });
        if (!result?.user?.id) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Claim account signup returned no user id'
            );
        }
        return result.user.id;
    } catch (error) {
        if (
            error instanceof Error &&
            /user already exists|email already exists|USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL/i.test(
                error.message
            )
        ) {
            return null;
        }
        throw error;
    }
}
