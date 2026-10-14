import {
    and,
    type DrizzleClient,
    eq,
    isNull,
    permanentGrants,
    permanentGrantVerticals
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { LiveAnchorReader } from '../addon/addon-orphanhood-ports';

/**
 * Reads the live «ancla viva» (glossary row 2; B/02 §2.4: a null revocation
 * timestamp means the grant is live). Coord-362 requires A5 to use this actual
 * database reader: a read error propagates so irreversible provider cancellation
 * never proceeds on an assumed absence. DB values are used only inside the call.
 */
export async function hasLivePermanentGrantAnchor(input: {
    readonly userId: string;
    readonly vertical: string;
    readonly tx: DrizzleClient;
}): Promise<boolean> {
    const parsed = z
        .strictObject({
            userId: z.uuid(),
            vertical: z.string().min(1),
            tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
        })
        .safeParse(input);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid permanent grant live anchor input',
            parsed.error.issues,
            'INVALID_PERMANENT_GRANT_LIVE_ANCHOR_INPUT'
        );
    }

    const rows = await input.tx
        .select({ id: permanentGrantVerticals.id })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, input.userId),
                eq(permanentGrantVerticals.vertical, input.vertical),
                isNull(permanentGrants.revokedAt)
            )
        )
        .limit(1);
    return rows.length > 0;
}

/** The real live-anchor reader used by A5 unless a caller explicitly supplies a port. */
export const permanentGrantLiveAnchors: LiveAnchorReader = {
    hasLiveAnchor: hasLivePermanentGrantAnchor
};
