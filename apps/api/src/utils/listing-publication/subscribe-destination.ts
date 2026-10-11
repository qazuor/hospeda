import { getDb, users } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { computeTrialEmailPseudonym, ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { resolveSubscribeDestination } from '../../../../../packages/verticals/src/publication/subscribe-destination';
import { getListingAccessPorts } from '../listing-access/ports';
import { buildTrialStartReader } from './trial-start-reader';

export async function resolveSubscribeDestinationForUser(args: {
    readonly userId: string;
    readonly vertical: PublicationVertical;
}) {
    const db = getDb();
    const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, args.userId))
        .limit(1);
    if (!user) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
    const pseudonym = computeTrialEmailPseudonym({ email: user.email });
    if (!pseudonym.ok)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid owner email');
    return resolveSubscribeDestination({
        reader: buildTrialStartReader({ client: db }),
        billing: getListingAccessPorts().billing,
        input: {
            userId: args.userId,
            vertical: args.vertical,
            event: 'listing_published',
            emailPseudonym: pseudonym.pseudonym
        }
    });
}
