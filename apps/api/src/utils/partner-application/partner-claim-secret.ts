import { createHash, randomBytes } from 'node:crypto';
import { getDb, partnerApplicationModel } from '@repo/db';
import type { PartnerClaimSecretIssuer } from '@repo/notifications';

/** Generates a random claim secret and its persisted SHA-256 hash. */
export function generatePartnerClaimSecret(): { readonly secret: string; readonly hash: string } {
    const secret = randomBytes(32).toString('base64url');
    return { secret, hash: hashPartnerClaimSecret({ secret }) };
}

/** Hashes a claim secret for persistence or V7.2 verification; this is the shared verification function. */
export function hashPartnerClaimSecret(input: { readonly secret: string }): string {
    return createHash('sha256').update(input.secret, 'utf8').digest('hex');
}

/** Issues a claim secret and stores only its hash before the sender calls its transport. */
export const issuePartnerClaimSecret: PartnerClaimSecretIssuer = async ({ partnerId }) => {
    const generated = generatePartnerClaimSecret();
    const stored = await partnerApplicationModel.setClaimSecretHashIfUnclaimed({
        tx: getDb(),
        partnerId,
        hash: generated.hash
    });
    return stored ? { secret: generated.secret } : null;
};
