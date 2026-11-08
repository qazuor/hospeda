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

/** Finds one live includes-addons grant anchor in the requested vertical. */
export async function findIncludesAddonsAnchor(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly vertical: string;
}): Promise<{ readonly anchorId: string } | null> {
    const parsed = z
        .strictObject({
            tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
            userId: z.uuid(),
            vertical: z.string().min(1)
        })
        .safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid includes-addons anchor input',
            parsed.error.issues,
            'INVALID_INCLUDES_ADDONS_ANCHOR_INPUT'
        );
    const [row] = await input.tx
        .select({ anchorId: permanentGrantVerticals.id })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, input.userId),
                eq(permanentGrantVerticals.vertical, input.vertical),
                isNull(permanentGrants.revokedAt),
                eq(permanentGrants.includesAddons, true)
            )
        )
        .orderBy(permanentGrantVerticals.id)
        .limit(1);
    return row ?? null;
}
