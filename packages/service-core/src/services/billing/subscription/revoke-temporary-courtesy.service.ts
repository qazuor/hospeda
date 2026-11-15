import { z } from 'zod';
import { resumeSubscription } from './resume-subscription.service.js';

/** Revokes a temporary courtesy through the third S10 event. */
export async function revokeTemporaryCourtesy(
    input: { readonly subscriptionId: string },
    ports: Parameters<typeof resumeSubscription>[1]
): ReturnType<typeof resumeSubscription> {
    const value = z.strictObject({ subscriptionId: z.uuid() }).parse(input);
    return resumeSubscription(
        { subscriptionId: value.subscriptionId, cause: 'COURTESY_REVOKED' },
        ports
    );
}
